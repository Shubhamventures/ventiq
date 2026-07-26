import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const bucketName = "migration-intake-files";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^a-zA-Z0-9.\-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  const formData = await request.formData();

  const files = formData.getAll("files");
  const categories = formData.getAll("categories");
  const detectedTypes = formData.getAll("detectedTypes");
  const clientIds = formData.getAll("clientIds");
  const notes = formData.getAll("notes");

  if (files.length === 0) {
    return NextResponse.json(
      { error: "No files received for upload." },
      { status: 400 }
    );
  }

  const batchName =
    String(formData.get("batchName") || "").trim() ||
    `Migration Intake ${new Date().toISOString()}`;

  const { data: batch, error: batchError } = await supabase
    .from("migration_intake_batches")
    .insert({
      batch_name: batchName,
      fund_name: "VENTIQ Growth Fund II",
      total_files: files.length,
      uploaded_files: 0,
      status: "Uploading",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return NextResponse.json(
      { error: batchError?.message || "Unable to create intake batch." },
      { status: 500 }
    );
  }

  const uploadedFiles = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    if (!(file instanceof File)) {
      continue;
    }

    const category = String(categories[index] || "other");
    const detectedType = String(detectedTypes[index] || category);
    const clientId = String(clientIds[index] || "");
    const note = String(notes[index] || "");

    const safeName = sanitizeFileName(file.name);
    const storagePath = `${batch.id}/${category}/${Date.now()}-${index}-${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      uploadedFiles.push({
        clientId,
        fileName: file.name,
        category,
        status: "Failed",
        error: uploadError.message,
      });

      continue;
    }

    const { error: insertError } = await supabase
      .from("migration_file_uploads")
      .insert({
        batch_id: batch.id,
        original_file_name: file.name,
        category,
        detected_type: detectedType,
        file_size: file.size,
        storage_bucket: bucketName,
        storage_path: storagePath,
        upload_status: "Uploaded",
        note,
      });

    if (insertError) {
      uploadedFiles.push({
        clientId,
        fileName: file.name,
        category,
        status: "Failed",
        error: insertError.message,
      });

      continue;
    }

    uploadedFiles.push({
      clientId,
      fileName: file.name,
      category,
      status: "Uploaded",
      storagePath,
    });
  }

  const successfulUploads = uploadedFiles.filter(
    (file) => file.status === "Uploaded"
  ).length;

  await supabase
    .from("migration_intake_batches")
    .update({
      uploaded_files: successfulUploads,
      status: successfulUploads === files.length ? "Uploaded" : "Partial Upload",
      updated_at: new Date().toISOString(),
    })
    .eq("id", batch.id);

  return NextResponse.json({
    batchId: batch.id,
    uploadedFiles,
    uploadedCount: successfulUploads,
    totalFiles: files.length,
  });
}
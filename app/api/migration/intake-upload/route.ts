/* eslint-disable @typescript-eslint/no-explicit-any */

import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET_NAME = "migration-intake-files";
const MAX_FILES_PER_REQUEST = 10;
const MAX_SPREADSHEET_SIZE = 50 * 1024 * 1024;
const MAX_PDF_SIZE = 25 * 1024 * 1024;

const VIEW_ROLES = new Set(["fund_admin", "maker", "checker"]);
const UPLOAD_ROLES = new Set(["fund_admin", "maker"]);

type AccessMode = "view" | "upload";

const VALID_DATASET_BY_CATEGORY: Record<string, string> = {
  canonical: "canonical_workbook",
  investor: "legacy_investor",
  portfolio: "legacy_portfolio",
  fund: "legacy_fund",
  compliance: "legacy_compliance",
  pdf: "pdf_dump",
};

type SupabaseAdmin = any;

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
};

type UserProfileRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  default_role: string | null;
  status: string | null;
};

type MembershipRow = {
  role: string | null;
};

type FundAccessRow = {
  can_view: boolean | null;
  can_edit: boolean | null;
};

type IntakeBatchRow = {
  id: string;
  fund_name: string | null;
  processing_status: string | null;
  total_files: number | null;
  uploaded_files: number | null;
  investor_files: number | null;
  portfolio_files: number | null;
  fund_files: number | null;
  investor_pdf_files: number | null;
  compliance_data_files: number | null;
};

type DuplicateFileRow = {
  original_file_name: string;
  storage_path: string | null;
};

type UploadResult = {
  clientId: string;
  fileName: string;
  category: string;
  datasetKey: string;
  status: "Uploaded" | "Duplicate" | "Failed";
  storagePath?: string;
  error?: string;
};

type PreparedUpload = {
  clientId: string;
  category: string;
  datasetKey: string;
  detectedType: string;
  note: string;
  file: File;
  buffer: Buffer;
  fileHash: string;
};

function getSupabaseAdmin(): SupabaseAdmin | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as any;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "migration-file"
  );
}

function slugify(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "fund"
  );
}

function getFileExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot >= 0 ? fileName.slice(lastDot).toLowerCase() : "";
}

function validateFile(file: File, category: string) {
  const extension = getFileExtension(file.name);

  if (category === "pdf") {
    if (extension !== ".pdf") return "PDF Dump accepts PDF files only.";
    if (file.size > MAX_PDF_SIZE) {
      return "PDF exceeds the 25 MB per-file limit.";
    }
    return "";
  }

  if (![".xlsx", ".xls", ".csv"].includes(extension)) {
    return "This dataset accepts .xlsx, .xls or .csv files only.";
  }

  if (category === "canonical" && extension === ".csv") {
    return "Canonical Migration Workbook must be an .xlsx or .xls workbook.";
  }

  if (file.size > MAX_SPREADSHEET_SIZE) {
    return "Spreadsheet exceeds the 50 MB per-file limit.";
  }

  return "";
}

async function ensureStorageBucket(supabase: SupabaseAdmin) {
  const { data: buckets, error: listError } =
    await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(
      `Unable to inspect migration storage: ${listError.message}`
    );
  }

  const exists = Array.isArray(buckets)
    ? buckets.some(
        (bucket: { name?: string }) => bucket.name === BUCKET_NAME
      )
    : false;

  if (exists) return;

  const { error: createError } =
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_SPREADSHEET_SIZE,
    });

  if (createError) {
    throw new Error(
      `Unable to create migration storage: ${createError.message}`
    );
  }
}

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin,
  fundName: string,
  mode: AccessMode
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);
  if (!accessToken) throw new Error("AUTHENTICATION_REQUIRED");

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);
  const user = userResult?.user;

  if (userError || !user) throw new Error("INVALID_SESSION");

  const { data: profileData, error: profileError } = await supabase
    .from("ventiq_user_profiles")
    .select("user_id, email, full_name, default_role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to load VENTIQ profile: ${profileError.message}`
    );
  }

  const profile = profileData as UserProfileRow | null;
  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  const allowedRoles = mode === "upload" ? UPLOAD_ROLES : VIEW_ROLES;
  let role = String(profile.default_role || "").trim();

  if (!allowedRoles.has(role)) {
    const { data: membershipData, error: membershipError } =
      await supabase
        .from("ventiq_organisation_members")
        .select("role")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (membershipError) {
      throw new Error(
        `Unable to load organisation membership: ${membershipError.message}`
      );
    }

    role = String((membershipData as MembershipRow | null)?.role || "").trim();
  }

  if (!allowedRoles.has(role)) throw new Error("ROLE_NOT_ALLOWED");

  if (role !== "fund_admin") {
    const { data: accessData, error: accessError } = await supabase
      .from("ventiq_user_fund_access")
      .select("can_view, can_edit")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (accessError) {
      throw new Error(`Unable to verify fund access: ${accessError.message}`);
    }

    const fundAccess = accessData as FundAccessRow | null;

    if (!fundAccess?.can_view) {
      throw new Error("FUND_VIEW_ACCESS_REQUIRED");
    }

    if (mode === "upload" && !fundAccess?.can_edit) {
      throw new Error("FUND_EDIT_ACCESS_REQUIRED");
    }
  }

  return {
    userId: String(user.id),
    email: String(profile.email || user.email || ""),
    fullName: String(
      profile.full_name || user.email || "VENTIQ User"
    ),
    role,
  };
}

function getAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION"
  ) {
    return NextResponse.json(
      { error: "Please sign in before accessing migration data." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "FUND_VIEW_ACCESS_REQUIRED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED"
  ) {
    return NextResponse.json(
      {
        error:
          message === "FUND_VIEW_ACCESS_REQUIRED"
            ? "You do not have permission to view migration data for this fund."
            : "You do not have permission to upload migration data for this fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

function getBatchErrorResponse(message: string) {
  const messages: Record<string, string> = {
    MIGRATION_BATCH_NOT_FOUND:
      "The migration batch could not be found.",
    MIGRATION_BATCH_FUND_MISMATCH:
      "The selected fund does not match the migration batch.",
    MIGRATION_BATCH_LOCKED:
      "This migration batch is already being processed and cannot accept more files.",
  };

  if (!messages[message]) return null;

  return NextResponse.json(
    { error: messages[message] },
    { status: 409 }
  );
}

async function resolveBatch(
  supabase: SupabaseAdmin,
  requestedBatchId: string,
  batchName: string,
  fundName: string,
  user: AuthorisedUser
): Promise<IntakeBatchRow> {
  const batchSelect =
    "id, fund_name, processing_status, total_files, uploaded_files, investor_files, portfolio_files, fund_files, investor_pdf_files, compliance_data_files";

  if (requestedBatchId) {
    const { data, error } = await supabase
      .from("migration_intake_batches")
      .select(batchSelect)
      .eq("id", requestedBatchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load migration batch: ${error.message}`);
    }

    const batch = data as IntakeBatchRow | null;
    if (!batch) throw new Error("MIGRATION_BATCH_NOT_FOUND");

    if (
      String(batch.fund_name || "").trim().toLowerCase() !==
      fundName.trim().toLowerCase()
    ) {
      throw new Error("MIGRATION_BATCH_FUND_MISMATCH");
    }

    if (["Processing", "Completed"].includes(String(batch.processing_status || ""))) {
      throw new Error("MIGRATION_BATCH_LOCKED");
    }

    return batch;
  }

  const { data, error } = await supabase
    .from("migration_intake_batches")
    .insert({
      batch_name: batchName,
      fund_name: fundName,
      intake_mode: "Canonical",
      total_files: 0,
      uploaded_files: 0,
      processed_files: 0,
      status: "Uploading",
      processing_status: "Not Started",
      processing_summary: {
        createdBy: user.fullName,
        createdByUserId: user.userId,
        createdByRole: user.role,
      },
    })
    .select(batchSelect)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message || "Unable to create migration intake batch."
    );
  }

  return data as IntakeBatchRow;
}


export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const fundName = String(
      request.nextUrl.searchParams.get("fundName") || ""
    ).trim();

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    await authoriseRequest(request, supabase, fundName, "view");

    const { data: batchData, error: batchError } = await supabase
      .from("migration_intake_batches")
      .select(
        "id, batch_name, fund_name, status, processing_status, total_files, uploaded_files, processed_files, total_rows, inserted_rows, updated_rows, rejected_rows, warning_rows, validation_error_count, validation_warning_count, created_at, updated_at, processed_at"
      )
      .ilike("fund_name", fundName)
      .gt("uploaded_files", 0)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (batchError) {
      throw new Error(
        `Unable to load the latest migration batch: ${batchError.message}`
      );
    }

    if (!batchData) {
      return NextResponse.json({
        batch: null,
        files: [],
      });
    }

    const { data: fileData, error: fileError } = await supabase
      .from("migration_file_uploads")
      .select(
        "id, batch_id, original_file_name, category, dataset_key, detected_type, file_size, upload_status, processing_status, note, validation_errors, validation_warnings, created_at"
      )
      .eq("batch_id", batchData.id)
      .order("created_at", { ascending: true });

    if (fileError) {
      throw new Error(
        `Unable to load migration batch files: ${fileError.message}`
      );
    }

    const files = (Array.isArray(fileData) ? fileData : []).map((file: any) => {
      const processingStatus = String(file.processing_status || "");
      const uploadStatus = String(file.upload_status || "Uploaded");

      let status = "Uploaded";

      if (processingStatus.toLowerCase() === "completed") {
        status = "Processed";
      } else if (uploadStatus.toLowerCase().includes("fail")) {
        status = "Failed";
      }

      return {
        id: String(file.id),
        name: String(file.original_file_name || "Uploaded migration file"),
        size: Number(file.file_size || 0),
        category: String(file.category || "canonical"),
        datasetKey: String(file.dataset_key || "canonical_workbook"),
        detectedType: String(file.detected_type || file.category || "Migration File"),
        status,
        note: String(file.note || "Stored in VENTIQ migration intake."),
        error: "",
      };
    });

    return NextResponse.json({
      batch: {
        id: String(batchData.id),
        batchName: String(batchData.batch_name || "Migration Intake Batch"),
        fundName: String(batchData.fund_name || fundName),
        status: String(batchData.status || "Uploaded"),
        processingStatus: String(batchData.processing_status || "Not Started"),
        totalFiles: Number(batchData.total_files || 0),
        uploadedFiles: Number(batchData.uploaded_files || 0),
        processedFiles: Number(batchData.processed_files || 0),
        totalRows: Number(batchData.total_rows || 0),
        insertedRows: Number(batchData.inserted_rows || 0),
        updatedRows: Number(batchData.updated_rows || 0),
        rejectedRows: Number(batchData.rejected_rows || 0),
        warningRows: Number(batchData.warning_rows || 0),
        validationErrorCount: Number(batchData.validation_error_count || 0),
        validationWarningCount: Number(batchData.validation_warning_count || 0),
        createdAt: batchData.created_at || null,
        updatedAt: batchData.updated_at || null,
        processedAt: batchData.processed_at || null,
      },
      files,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load migration intake status.";

    console.error("Migration intake status load failed:", error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll("files");
    const categories = formData.getAll("categories");
    const datasetKeys = formData.getAll("datasetKeys");
    const detectedTypes = formData.getAll("detectedTypes");
    const clientIds = formData.getAll("clientIds");
    const notes = formData.getAll("notes");

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files received for upload." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Upload a maximum of ${MAX_FILES_PER_REQUEST} files per request.`,
        },
        { status: 400 }
      );
    }

    const metadataLengths = [
      categories.length,
      datasetKeys.length,
      detectedTypes.length,
      clientIds.length,
      notes.length,
    ];

    if (metadataLengths.some((length) => length !== files.length)) {
      return NextResponse.json(
        {
          error:
            "Migration file metadata is incomplete or misaligned.",
        },
        { status: 400 }
      );
    }

    const fundName = String(formData.get("fundName") || "").trim();
    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    const authorisedUser = await authoriseRequest(
      request,
      supabase,
      fundName,
      "upload"
    );

    await ensureStorageBucket(supabase);

    const requestedBatchId = String(formData.get("batchId") || "").trim();
    const batchName =
      String(formData.get("batchName") || "").trim() ||
      `VENTIQ Canonical Migration Intake ${new Date().toISOString()}`;

    const uploadedFiles: UploadResult[] = [];
    const preparedUploads: PreparedUpload[] = [];
    let duplicateCount = 0;
    let failedCount = 0;

    /*
     * Validate and check duplicates before creating a migration batch.
     * This prevents an empty batch from being created when every file is a duplicate.
     */
    for (let index = 0; index < files.length; index += 1) {
      const candidate = files[index];
      const clientId = String(clientIds[index] || "");
      const category = String(categories[index] || "").trim();
      const datasetKey = String(datasetKeys[index] || "").trim();
      const detectedType = String(detectedTypes[index] || category).trim();
      const note = String(notes[index] || "").trim();

      if (!(candidate instanceof File)) {
        uploadedFiles.push({
          clientId,
          fileName: "Unknown file",
          category,
          datasetKey,
          status: "Failed",
          error: "Invalid file payload.",
        });
        failedCount += 1;
        continue;
      }

      if (VALID_DATASET_BY_CATEGORY[category] !== datasetKey) {
        uploadedFiles.push({
          clientId,
          fileName: candidate.name,
          category,
          datasetKey,
          status: "Failed",
          error: "Unsupported category and dataset combination.",
        });
        failedCount += 1;
        continue;
      }

      const validationError = validateFile(candidate, category);
      if (validationError) {
        uploadedFiles.push({
          clientId,
          fileName: candidate.name,
          category,
          datasetKey,
          status: "Failed",
          error: validationError,
        });
        failedCount += 1;
        continue;
      }

      const buffer = Buffer.from(await candidate.arrayBuffer());
      const fileHash = createHash("sha256").update(buffer).digest("hex");

      const { data: duplicateData, error: duplicateError } = await supabase
        .from("migration_file_uploads")
        .select("original_file_name, storage_path")
        .eq("fund_name", fundName)
        .eq("dataset_key", datasetKey)
        .eq("file_hash", fileHash)
        .in("upload_status", ["Uploaded", "Processed"])
        .limit(1)
        .maybeSingle();

      if (duplicateError) {
        uploadedFiles.push({
          clientId,
          fileName: candidate.name,
          category,
          datasetKey,
          status: "Failed",
          error: duplicateError.message,
        });
        failedCount += 1;
        continue;
      }

      const duplicate = duplicateData as DuplicateFileRow | null;
      if (duplicate) {
        uploadedFiles.push({
          clientId,
          fileName: candidate.name,
          category,
          datasetKey,
          status: "Duplicate",
          storagePath: duplicate.storage_path || undefined,
          error: `This file was already uploaded as ${duplicate.original_file_name}.`,
        });
        duplicateCount += 1;
        continue;
      }

      preparedUploads.push({
        clientId,
        category,
        datasetKey,
        detectedType,
        note,
        file: candidate,
        buffer,
        fileHash,
      });
    }

    if (preparedUploads.length === 0) {
      return NextResponse.json({
        batchId: requestedBatchId || null,
        uploadedFiles,
        uploadedCount: 0,
        duplicateCount,
        failedCount,
        totalFiles: files.length,
      });
    }

    const batch = await resolveBatch(
      supabase,
      requestedBatchId,
      batchName,
      fundName,
      authorisedUser
    );

    let uploadedCount = 0;
    const categoryIncrements = {
      investor: 0,
      portfolio: 0,
      fund: 0,
      pdf: 0,
      compliance: 0,
    };

    for (const item of preparedUploads) {
      const storagePath = [
        slugify(fundName),
        batch.id,
        item.datasetKey,
        `${Date.now()}-${randomUUID()}-${sanitizeFileName(item.file.name)}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, item.buffer, {
          contentType: item.file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        uploadedFiles.push({
          clientId: item.clientId,
          fileName: item.file.name,
          category: item.category,
          datasetKey: item.datasetKey,
          status: "Failed",
          error: uploadError.message,
        });
        failedCount += 1;
        continue;
      }

      const { error: insertError } = await supabase
        .from("migration_file_uploads")
        .insert({
          batch_id: batch.id,
          fund_name: fundName,
          original_file_name: item.file.name,
          category: item.category,
          dataset_key: item.datasetKey,
          dataset_version: "1.0",
          detected_type: item.detectedType,
          mime_type: item.file.type || "application/octet-stream",
          file_size: item.file.size,
          file_hash: item.fileHash,
          checksum_algorithm: "SHA-256",
          storage_bucket: BUCKET_NAME,
          storage_path: storagePath,
          upload_status: "Uploaded",
          processing_status: "Not Started",
          note: item.note,
        });

      if (insertError) {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);

        uploadedFiles.push({
          clientId: item.clientId,
          fileName: item.file.name,
          category: item.category,
          datasetKey: item.datasetKey,
          status: "Failed",
          error: insertError.message,
        });
        failedCount += 1;
        continue;
      }

      uploadedFiles.push({
        clientId: item.clientId,
        fileName: item.file.name,
        category: item.category,
        datasetKey: item.datasetKey,
        status: "Uploaded",
        storagePath,
      });

      uploadedCount += 1;

      if (item.category === "investor") categoryIncrements.investor += 1;
      if (item.category === "portfolio") categoryIncrements.portfolio += 1;
      if (item.category === "fund") categoryIncrements.fund += 1;
      if (item.category === "pdf") categoryIncrements.pdf += 1;
      if (item.category === "compliance") categoryIncrements.compliance += 1;
    }

    const nextStatus =
      failedCount === 0
        ? "Uploaded"
        : uploadedCount > 0 || duplicateCount > 0
          ? "Partial Upload"
          : "Upload Failed";

    const { error: batchUpdateError } = await supabase
      .from("migration_intake_batches")
      .update({
        total_files:
          Number(batch.total_files || 0) + preparedUploads.length,
        uploaded_files:
          Number(batch.uploaded_files || 0) + uploadedCount,
        investor_files:
          Number(batch.investor_files || 0) + categoryIncrements.investor,
        portfolio_files:
          Number(batch.portfolio_files || 0) + categoryIncrements.portfolio,
        fund_files:
          Number(batch.fund_files || 0) + categoryIncrements.fund,
        investor_pdf_files:
          Number(batch.investor_pdf_files || 0) + categoryIncrements.pdf,
        compliance_data_files:
          Number(batch.compliance_data_files || 0) +
          categoryIncrements.compliance,
        status: nextStatus,
        processing_status: "Not Started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    if (batchUpdateError) {
      throw new Error(
        `Files uploaded, but the batch summary could not be updated: ${batchUpdateError.message}`
      );
    }

    const { error: eventError } = await supabase
      .from("migration_processing_events")
      .insert({
        batch_id: batch.id,
        fund_name: fundName,
        event_type: "Files Uploaded",
        event_title: `${uploadedCount} migration file(s) uploaded`,
        event_description:
          `${duplicateCount} duplicate(s) skipped and ` +
          `${failedCount} file(s) failed in this request.`,
        actor_user_id: authorisedUser.userId,
        actor_name: authorisedUser.fullName,
        actor_role: authorisedUser.role,
        event_status:
          failedCount === 0 ? "Completed" : "Completed With Errors",
        metadata: {
          uploadedCount,
          duplicateCount,
          failedCount,
          totalFiles: files.length,
        },
      });

    if (eventError) {
      console.warn(
        "Migration upload audit event was not created:",
        eventError.message
      );
    }

    return NextResponse.json({
      batchId: batch.id,
      uploadedFiles,
      uploadedCount,
      duplicateCount,
      failedCount,
      totalFiles: files.length,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const message =
      error instanceof Error ? error.message : "Upload failed.";

    const batchResponse = getBatchErrorResponse(message);
    if (batchResponse) return batchResponse;

    console.error("Migration intake upload failed:", error);

    return NextResponse.json(
      {
        error: message || "Unable to upload migration files.",
      },
      { status: 500 }
    );
  }
}
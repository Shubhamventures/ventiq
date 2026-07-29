import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type DataRow = Record<string, unknown>;

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

function getString(row: DataRow | undefined, keys: string[], fallback = "") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase admin client is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const batchId = String(body.batch_id || "").trim();

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required for publishing." },
        { status: 400 }
      );
    }

    const { data: generatedDocuments, error: generatedError } = await supabase
      .from("document_studio_generated_documents")
      .select("*")
      .eq("batch_id", batchId)
      .eq("generation_status", "Generated");

    if (generatedError) {
      return NextResponse.json(
        { error: generatedError.message },
        { status: 500 }
      );
    }

    const generatedRows = (generatedDocuments ?? []) as DataRow[];

    if (generatedRows.length === 0) {
      return NextResponse.json(
        { error: "No generated documents found for this batch." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const portalRows = generatedRows.map((documentRow) => {
      const investorName = getString(documentRow, ["investor_name"]);
      const investorCode = getString(documentRow, ["investor_code"]);
      const documentType = getString(documentRow, [
        "document_type",
        "document_category",
      ]);

      return {
        investor_id: getString(documentRow, ["investor_id"]) || null,
        investor_code: investorCode,
        investor_name: investorName,
        email: getString(documentRow, ["email"]),
        fund_name: "VENTIQ Capital Fund I",
        document_name:
          getString(documentRow, ["document_name"]) ||
          `${documentType} - ${investorName}`,
        document_type: documentType,
        document_category: documentType,
        file_name:
          getString(documentRow, ["file_name"]) ||
          `${investorCode}_${documentType.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        file_url: getString(documentRow, ["file_url"]),
        storage_bucket: getString(documentRow, ["storage_bucket"]),
        storage_path: getString(documentRow, ["storage_path"]),
        source: "Document Studio",
        publish_source: "document_studio",
        migration_status: "Published",
        status: "Published",
        confidence_score: 100,
        period_label: "Q1 FY 2025-26",
        match_signals: [
          "Generated from Document Studio template",
          "Investor matched from investor_master",
          "Ready for Investor Portal",
        ],
        uploaded_at: now,
        published_at: now,
      };
    });

    const { error: insertError } = await supabase
      .from("investor_documents")
      .insert(portalRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const generatedIds = generatedRows
      .map((row) => getString(row, ["id"]))
      .filter(Boolean);

    if (generatedIds.length > 0) {
      const { error: updateDocumentsError } = await supabase
        .from("document_studio_generated_documents")
        .update({
          generation_status: "Published",
          portal_publish_status: "Published",
          published_at: now,
        })
        .in("id", generatedIds);

      if (updateDocumentsError) {
        return NextResponse.json(
          { error: updateDocumentsError.message },
          { status: 500 }
        );
      }
    }

    const { error: updateBatchError } = await supabase
      .from("document_studio_generation_batches")
      .update({
        published_count: portalRows.length,
        generated_count: portalRows.length,
        status: "Published",
        updated_at: now,
      })
      .eq("id", batchId);

    if (updateBatchError) {
      return NextResponse.json(
        { error: updateBatchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Documents published to Investor Portal successfully.",
      batch_id: batchId,
      publishedDocuments: portalRows.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish documents to Investor Portal.",
      },
      { status: 500 }
    );
  }
}
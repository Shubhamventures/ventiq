import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  requireDocumentStudioFundAccess,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

function getString(row: DataRow | undefined, keys: string[], fallback = "") {
  if (!row) return fallback;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

export async function POST(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const body = await request.json();
    const batchId = String(body.batch_id || "").trim();

    if (!batchId) {
      return NextResponse.json(
        { error: "Batch ID is required for publishing." },
        { status: 400 }
      );
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .select("id, organisation_id, fund_name, status")
      .eq("id", batchId)
      .maybeSingle();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    if (!batch || !batch.organisation_id || !batch.fund_name) {
      return NextResponse.json(
        { error: "This batch is legacy/unowned and cannot be published. Prepare a new governed batch." },
        { status: 409 }
      );
    }

    if (String(batch.organisation_id) !== baseActor.organisationId) {
      return NextResponse.json({ error: "Batch not found for your organisation." }, { status: 404 });
    }

    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      batch.fund_name,
      "approve"
    );

    const { data: generatedDocuments, error: generatedError } = await supabaseAdmin
      .from("document_studio_generated_documents")
      .select("*")
      .eq("batch_id", batchId)
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName)
      .eq("generation_status", "Generated");

    if (generatedError) {
      return NextResponse.json({ error: generatedError.message }, { status: 500 });
    }

    const generatedRows = (generatedDocuments ?? []) as DataRow[];

    if (generatedRows.length === 0) {
      return NextResponse.json(
        { error: "No generated documents found for this governed batch." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    const portalRows = generatedRows.map((documentRow) => {
      const investorName = getString(documentRow, ["investor_name"]);
      const investorCode = getString(documentRow, ["investor_code"]);
      const documentType = getString(documentRow, ["document_type", "document_category"]);

      return {
        investor_id: getString(documentRow, ["investor_id"]) || null,
        investor_code: investorCode,
        investor_name: investorName,
        email: getString(documentRow, ["email"]),
        fund_name: actor.fundName,
        document_name:
          getString(documentRow, ["document_name"]) || `${documentType} - ${investorName}`,
        document_type: documentType,
        document_category: documentType,
        file_name:
          getString(documentRow, ["file_name"]) ||
          `${investorCode}_${documentType.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        file_url: null,
        storage_bucket: getString(documentRow, ["storage_bucket"]),
        storage_path: getString(documentRow, ["storage_path"]),
        source: "Document Studio",
        publish_source: "document_studio",
        migration_status: "Published",
        status: "Published",
        portal_status: "available",
        confidence_score: 100,
        period_label: "Q1 FY 2025-26",
        match_signals: [
          "Generated from governed Document Studio template",
          "Investor matched from fund-scoped investor_master",
          "Stored in private Supabase Storage; no permanent public URL",
          "Published by authorised VENTIQ approver",
        ],
        uploaded_at: now,
        published_at: now,
      };
    });

    const { error: insertError } = await supabaseAdmin
      .from("investor_documents")
      .insert(portalRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const generatedIds = generatedRows
      .map((row) => getString(row, ["id"]))
      .filter(Boolean);

    if (generatedIds.length > 0) {
      const { error: updateDocumentsError } = await supabaseAdmin
        .from("document_studio_generated_documents")
        .update({
          generation_status: "Published",
          portal_publish_status: "Published",
          published_at: now,
        })
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .in("id", generatedIds);

      if (updateDocumentsError) {
        return NextResponse.json({ error: updateDocumentsError.message }, { status: 500 });
      }
    }

    const { error: updateBatchError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .update({
        published_count: portalRows.length,
        generated_count: portalRows.length,
        status: "Published",
        updated_at: now,
      })
      .eq("id", batchId)
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName);

    if (updateBatchError) {
      return NextResponse.json({ error: updateBatchError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: "Documents published to Investor Portal successfully.",
      batch_id: batchId,
      publishedDocuments: portalRows.length,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

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
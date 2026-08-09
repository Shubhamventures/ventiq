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


export async function GET(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const url = new URL(request.url);
    const requestedFundName = String(url.searchParams.get("fund_name") || "").trim();
    const requestedBatchId = String(url.searchParams.get("batch_id") || "").trim();

    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      requestedFundName,
      "view"
    );

    const { data: recentBatches, error: recentBatchesError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .select(
        "id, batch_name, document_type, total_investors, ready_count, review_count, generated_count, published_count, status, created_at"
      )
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName)
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentBatchesError) {
      return NextResponse.json({ error: recentBatchesError.message }, { status: 500 });
    }

    let batchQuery = supabaseAdmin
      .from("document_studio_generation_batches")
      .select("*")
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName);

    if (requestedBatchId) {
      batchQuery = batchQuery.eq("id", requestedBatchId);
    } else {
      batchQuery = batchQuery.order("created_at", { ascending: false }).limit(1);
    }

    const { data: batch, error: batchError } = await batchQuery.maybeSingle();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    if (!batch) {
      return NextResponse.json({
        message: requestedBatchId
          ? "The requested governed batch was not found for this fund."
          : "No governed batch exists for this fund yet.",
        batch: null,
        queuedDocuments: 0,
        documents: [],
        recentBatches: recentBatches ?? [],
      });
    }

    const { data: documents, error: documentsError } = await supabaseAdmin
      .from("document_studio_generated_documents")
      .select("*")
      .eq("batch_id", batch.id)
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName)
      .order("investor_name", { ascending: true });

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }

    return NextResponse.json({
      message: requestedBatchId
        ? "Selected governed batch loaded successfully."
        : "Latest governed batch loaded successfully.",
      batch,
      queuedDocuments: documents?.length ?? 0,
      documents: documents ?? [],
      recentBatches: recentBatches ?? [],
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the governed batch queue.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseActor = await authenticateDocumentStudioUser(request);
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      body.fund_name,
      "edit"
    );

    const templateId = String(body.template_id || "").trim();
    const documentType = String(
      body.document_type || "Statement of Account (SOA)"
    ).trim();

    if (templateId) {
      const { data: template, error: templateError } = await supabaseAdmin
        .from("document_studio_templates")
        .select("id")
        .eq("id", templateId)
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .maybeSingle();

      if (templateError) {
        return NextResponse.json({ error: templateError.message }, { status: 500 });
      }

      if (!template) {
        return NextResponse.json(
          { error: "Template not found for the selected fund." },
          { status: 404 }
        );
      }
    }

    const { data: investors, error: investorError } = await supabaseAdmin
      .from("investor_master")
      .select("*")
      .eq("fund_name", actor.fundName)
      .order("investor_code", { ascending: true });

    if (investorError) {
      return NextResponse.json({ error: investorError.message }, { status: 500 });
    }

    const investorRows = ((investors ?? []) as DataRow[]).slice(0, 500);

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .insert({
        template_id: templateId || null,
        batch_name: `${documentType} Batch - ${new Date().toLocaleDateString("en-IN")}`,
        document_type: documentType,
        total_investors: investorRows.length,
        ready_count: investorRows.length,
        review_count: 0,
        generated_count: 0,
        published_count: 0,
        status: "Prepared",
        organisation_id: actor.organisationId,
        fund_name: actor.fundName,
        created_by: actor.userId,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    const generatedRows = investorRows.map((investor) => {
      const investorName = getString(investor, ["investor_name", "name", "full_name"]);
      const investorCode = getString(investor, ["investor_code", "code"]);

      return {
        batch_id: batch.id,
        template_id: templateId || null,
        investor_id: getString(investor, ["id"]) || null,
        investor_code: investorCode,
        investor_name: investorName,
        email: getString(investor, ["email", "investor_email"]),
        document_type: documentType,
        document_name: `${documentType} - ${investorName}`,
        file_name: `${investorCode || "INV"}_${documentType.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        preview_data: {
          investor_code: investorCode,
          investor_name: investorName,
          fund_name: actor.fundName,
          document_type: documentType,
          status: "Ready for generation",
        },
        generation_status: "Ready",
        portal_publish_status: "Not Published",
        organisation_id: actor.organisationId,
        fund_name: actor.fundName,
        created_by: actor.userId,
      };
    });

    let documents: DataRow[] = [];

    if (generatedRows.length > 0) {
      const { data, error: documentError } = await supabaseAdmin
        .from("document_studio_generated_documents")
        .insert(generatedRows)
        .select("*");

      if (documentError) {
        await supabaseAdmin
          .from("document_studio_generation_batches")
          .delete()
          .eq("id", batch.id)
          .eq("organisation_id", actor.organisationId)
          .eq("fund_name", actor.fundName);

        return NextResponse.json({ error: documentError.message }, { status: 500 });
      }

      documents = (data ?? []) as DataRow[];
    }

    return NextResponse.json({
      message: "Batch generation queue prepared successfully.",
      batch,
      queuedDocuments: generatedRows.length,
      documents,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare batch generation.",
      },
      { status: 500 }
    );
  }
}
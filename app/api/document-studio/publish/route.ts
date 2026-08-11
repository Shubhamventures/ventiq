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

type CanonicalPublication = {
  documentRow: DataRow;
  investorMasterId: string;
  snapshot: DataRow;
  snapshotControl: DataRow;
  fundMemory: DataRow;
  mergedFields: DataRow;
  periodLabel: string;
};

function getString(
  row: DataRow | null | undefined,
  keys: string[],
  fallback = ""
) {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function getNumber(
  row: DataRow | null | undefined,
  keys: string[],
  fallback = 0
) {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value))
    ) {
      return Number(value);
    }
  }

  return fallback;
}

function asObject(value: unknown): DataRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as DataRow;
}

function getBoolean(
  row: DataRow | null | undefined,
  keys: string[],
  fallback = false
) {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];

    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }

  return fallback;
}

function formatIsoDate(value: string) {
  const raw = value.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return raw || "Unavailable";

  const [, year, month, day] = match;
  const monthName =
    [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ][Number(month) - 1] || month;

  return `${day}-${monthName}-${year}`;
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function validateCanonicalPublication(args: {
  documentRow: DataRow;
  organisationId: string;
  fundName: string;
}): Promise<
  | { ok: true; publication: CanonicalPublication }
  | { ok: false; reason: string }
> {
  const { documentRow, organisationId, fundName } = args;

  const documentId = getString(documentRow, ["id"]);
  const investorMasterId = getString(documentRow, ["investor_id"]);
  const storageBucket = getString(documentRow, ["storage_bucket"]);
  const storagePath = getString(documentRow, ["storage_path"]);

  if (!documentId) {
    return { ok: false, reason: "Generated document id is missing." };
  }

  if (!investorMasterId) {
    return {
      ok: false,
      reason: `Generated document ${documentId} has no governed investor_master id.`,
    };
  }

  if (!storageBucket || !storagePath) {
    return {
      ok: false,
      reason: `Generated document ${documentId} does not have a private stored PDF.`,
    };
  }

  const previewData = asObject(documentRow.preview_data);

  if (!previewData || !getBoolean(previewData, ["canonical"])) {
    return {
      ok: false,
      reason: `Generated document ${documentId} is not backed by a canonical batch payload.`,
    };
  }

  const fundMemory = asObject(previewData.fundMemory);
  const mergedFields = asObject(previewData.mergedFields);

  if (!fundMemory || !mergedFields) {
    return {
      ok: false,
      reason: `Generated document ${documentId} is missing canonical Fund Memory merge lineage.`,
    };
  }

  const snapshotId = getString(fundMemory, ["snapshot_id"]);

  if (!snapshotId || !getBoolean(fundMemory, ["eligible"])) {
    return {
      ok: false,
      reason: `Generated document ${documentId} does not reference an eligible Fund Memory snapshot.`,
    };
  }

  const { data: control, error: controlError } = await supabaseAdmin
    .from("investor_position_snapshot_controls")
    .select(
      "snapshot_id, organisation_id, fund_name, investor_id, reporting_date, reporting_period, snapshot_version, investor_statement_eligible, blocker_codes"
    )
    .eq("snapshot_id", snapshotId)
    .eq("organisation_id", organisationId)
    .eq("fund_name", fundName)
    .eq("investor_id", investorMasterId)
    .eq("investor_statement_eligible", true)
    .limit(1)
    .maybeSingle();

  if (controlError) {
    return {
      ok: false,
      reason: `Unable to revalidate Fund Memory eligibility for ${documentId}: ${controlError.message}`,
    };
  }

  if (!control) {
    return {
      ok: false,
      reason: `Fund Memory snapshot ${snapshotId} is no longer statement eligible.`,
    };
  }

  const { data: snapshot, error: snapshotError } = await supabaseAdmin
    .from("investor_position_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("organisation_id", organisationId)
    .eq("fund_name", fundName)
    .eq("investor_id", investorMasterId)
    .eq("approval_status", "approved")
    .is("superseded_at", null)
    .limit(1)
    .maybeSingle();

  if (snapshotError) {
    return {
      ok: false,
      reason: `Unable to revalidate canonical Fund Memory for ${documentId}: ${snapshotError.message}`,
    };
  }

  if (!snapshot) {
    return {
      ok: false,
      reason: `Approved live Fund Memory snapshot ${snapshotId} could not be loaded.`,
    };
  }

  const reportingDate = getString(snapshot as DataRow, ["reporting_date"]);
  const reportingPeriod = getString(snapshot as DataRow, ["reporting_period"]);
  const payloadReportingDate = getString(fundMemory, ["reporting_date"]);

  if (!reportingDate) {
    return {
      ok: false,
      reason: `Fund Memory snapshot ${snapshotId} has no authoritative reporting date.`,
    };
  }

  if (payloadReportingDate && payloadReportingDate !== reportingDate) {
    return {
      ok: false,
      reason: `Generated document ${documentId} no longer matches its authoritative reporting date.`,
    };
  }

  const payloadSnapshotVersion = getNumber(fundMemory, ["snapshot_version"], 0);
  const databaseSnapshotVersion = getNumber(
    snapshot as DataRow,
    ["snapshot_version"],
    0
  );

  if (
    payloadSnapshotVersion > 0 &&
    databaseSnapshotVersion > 0 &&
    payloadSnapshotVersion !== databaseSnapshotVersion
  ) {
    return {
      ok: false,
      reason: `Generated document ${documentId} no longer matches its canonical snapshot version.`,
    };
  }

  const periodLabel =
    reportingPeriod ||
    getString(mergedFields, ["statement_period"]) ||
    `As of ${formatIsoDate(reportingDate)}`;

  return {
    ok: true,
    publication: {
      documentRow,
      investorMasterId,
      snapshot: snapshot as DataRow,
      snapshotControl: control as DataRow,
      fundMemory,
      mergedFields,
      periodLabel,
    },
  };
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
      .select(
        "id, organisation_id, fund_name, document_type, status, total_investors, ready_count, review_count, generated_count, published_count"
      )
      .eq("id", batchId)
      .limit(1)
      .maybeSingle();

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    if (!batch || !batch.organisation_id || !batch.fund_name) {
      return NextResponse.json(
        {
          error:
            "This batch is legacy/unowned and cannot be published. Prepare a new governed batch.",
        },
        { status: 409 }
      );
    }

    if (String(batch.organisation_id) !== baseActor.organisationId) {
      return NextResponse.json(
        { error: "Batch not found for your organisation." },
        { status: 404 }
      );
    }

    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      batch.fund_name,
      "approve"
    );

    // Portal publication may be authorised by either:
    // 1) Full-fund activation; or
    // 2) Scoped Investor Documents Portal activation.
    // Scoped activation supports modular VENTIQ adoption without falsely
    // marking unrelated portfolio/compliance/accounting workflows as Active.
    const [fullActivationResult, moduleActivationResult] = await Promise.all([
      supabaseAdmin
        .from("fund_activation_status")
        .select("status, activated_at, activated_by")
        .eq("fund_name", actor.fundName)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("status, activated_at, activated_by_name, module_key")
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .eq("module_key", "investor_documents_portal")
        .limit(1)
        .maybeSingle(),
    ]);

    if (fullActivationResult.error) {
      return NextResponse.json(
        {
          error: `Unable to verify full-fund activation: ${fullActivationResult.error.message}`,
        },
        { status: 500 }
      );
    }

    if (moduleActivationResult.error) {
      return NextResponse.json(
        {
          error: `Unable to verify Investor Documents activation: ${moduleActivationResult.error.message}`,
        },
        { status: 500 }
      );
    }

    const fullFundActive =
      String(fullActivationResult.data?.status || "") === "Active";
    const investorDocumentsActive =
      String(moduleActivationResult.data?.status || "") === "Active";

    if (!fullFundActive && !investorDocumentsActive) {
      return NextResponse.json(
        {
          code: "PORTAL_ACTIVATION_REQUIRED",
          error:
            "Investor Documents Portal is not Active. Activate this governed module in Document Studio or complete Full Fund Activation before publishing.",
        },
        { status: 409 }
      );
    }

    const { data: generatedDocuments, error: generatedError } =
      await supabaseAdmin
        .from("document_studio_generated_documents")
        .select("*")
        .eq("batch_id", batchId)
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .in("generation_status", ["Generated", "Published"])
        .order("investor_name", { ascending: true });

    if (generatedError) {
      return NextResponse.json(
        { error: generatedError.message },
        { status: 500 }
      );
    }

    const generatedRows = (generatedDocuments ?? []) as DataRow[];

    if (generatedRows.length === 0) {
      return NextResponse.json(
        { error: "No generated documents found for this governed batch." },
        { status: 404 }
      );
    }

    const validationResults = await Promise.all(
      generatedRows.map((documentRow) =>
        validateCanonicalPublication({
          documentRow,
          organisationId: actor.organisationId,
          fundName: actor.fundName,
        })
      )
    );

    const blockers = validationResults
      .filter(
        (
          result
        ): result is { ok: false; reason: string } => result.ok === false
      )
      .map((result) => result.reason);

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          code: "CANONICAL_PUBLISH_BLOCKED",
          error:
            "Publishing is blocked because one or more PDFs no longer have valid canonical Fund Memory authority.",
          blockers,
        },
        { status: 409 }
      );
    }

    const publications = validationResults
      .filter(
        (
          result
        ): result is { ok: true; publication: CanonicalPublication } =>
          result.ok === true
      )
      .map((result) => result.publication);

    const now = new Date().toISOString();

    const portalRows = publications.map((publication) => {
      const documentRow = publication.documentRow;
      const snapshot = publication.snapshot;
      const fundMemory = publication.fundMemory;

      const generatedDocumentId = getString(documentRow, ["id"]);
      const investorName = getString(documentRow, ["investor_name"]);
      const investorCode = getString(documentRow, ["investor_code"]);
      const documentType =
        getString(documentRow, ["document_type", "document_category"]) ||
        "Investor Document";
      const fileName =
        getString(documentRow, ["file_name"]) ||
        `${safeFileName(investorCode || "INV")}_${safeFileName(
          documentType
        )}.pdf`;

      const snapshotId = getString(snapshot, ["id"]);
      const reportingDate = getString(snapshot, ["reporting_date"]);
      const reportingPeriod = getString(snapshot, ["reporting_period"]);
      const snapshotVersion = getNumber(snapshot, ["snapshot_version"], 1);
      const sourceKind = getString(snapshot, ["source_kind"]);

      const lineage = {
        canonical: true,
        organisation_id: actor.organisationId,
        fund_name: actor.fundName,
        investor_master_id: publication.investorMasterId,
        document_studio: {
          batch_id: batchId,
          generated_document_id: generatedDocumentId,
          template_id: getString(documentRow, ["template_id"]) || null,
        },
        fund_memory: {
          snapshot_id: snapshotId,
          reporting_date: reportingDate,
          reporting_period: reportingPeriod || null,
          snapshot_version: snapshotVersion,
          source_kind: sourceKind || null,
          source_batch_id: getString(snapshot, ["source_batch_id"]) || null,
          source_file_name: getString(snapshot, ["source_file_name"]) || null,
          calculation_version:
            getString(snapshot, ["calculation_version"]) || null,
          approved_at: getString(snapshot, ["approved_at"]) || null,
        },
        published_by: {
          user_id: actor.userId,
          email: actor.email,
          name: actor.fullName,
          role: actor.role,
          published_at: now,
        },
      };

      return {
        // Keep legacy investor_id NULL: it references public.investors, not
        // the governed investor_master table.
        investor_id: null,
        investor_master_id: publication.investorMasterId,
        investor_code: investorCode || null,
        investor_name: investorName || null,
        investor_email: getString(documentRow, ["email"]) || null,
        email: getString(documentRow, ["email"]) || null,

        organisation_id: actor.organisationId,
        fund_name: actor.fundName,

        document_name:
          getString(documentRow, ["document_name"]) ||
          `${documentType} - ${investorName || investorCode || "Investor"}`,
        document_type: documentType,
        document_category: documentType,

        file_name: fileName,
        file_url: null,
        storage_url: null,
        storage_bucket: getString(documentRow, ["storage_bucket"]) || null,
        storage_path: getString(documentRow, ["storage_path"]) || null,

        source: "Document Studio",
        publish_source: "document_studio",
        migration_status: "Published",
        status: "Published",
        portal_status: "available",
        confidence_score: 100,
        period_label: publication.periodLabel,

        document_studio_batch_id: batchId,
        document_studio_generated_document_id: generatedDocumentId,

        fund_memory_snapshot_id: snapshotId,
        fund_memory_reporting_date: reportingDate,
        fund_memory_reporting_period: reportingPeriod || null,
        fund_memory_snapshot_version: snapshotVersion,
        fund_memory_source_kind: sourceKind || null,
        canonical_lineage: lineage,

        published_by_user_id: actor.userId,
        published_by_email: actor.email,
        published_by_name: actor.fullName,

        generated_by: actor.fullName,
        generated_at: getString(documentRow, ["generated_at"]) || now,
        uploaded_at: now,
        published_at: now,

        match_signals: [
          "Generated from governed Document Studio template",
          `Governed investor_master id: ${publication.investorMasterId}`,
          `Canonical Fund Memory snapshot: ${snapshotId}`,
          `Canonical reporting period: ${publication.periodLabel}`,
          `Canonical reporting date: ${reportingDate}`,
          `Canonical snapshot version: ${snapshotVersion}`,
          "Fund Memory eligibility revalidated immediately before publishing",
          "Stored in private Supabase Storage; no permanent public URL",
          `Published by authorised ${actor.role}: ${actor.fullName}`,
          `Fund Memory source kind: ${
            getString(fundMemory, ["source_kind"]) || sourceKind || "governed"
          }`,
        ],
      };
    });

    const generatedIds = portalRows
      .map((row) => String(row.document_studio_generated_document_id || "").trim())
      .filter(Boolean);

    const { data: existingPublishedRows, error: existingPublishedError } =
      generatedIds.length > 0
        ? await supabaseAdmin
            .from("investor_documents")
            .select(
              "id, document_studio_generated_document_id, investor_master_id, investor_code, investor_name, period_label, fund_memory_snapshot_id, fund_memory_reporting_date, fund_memory_snapshot_version, portal_status, published_at"
            )
            .in("document_studio_generated_document_id", generatedIds)
        : { data: [], error: null };

    if (existingPublishedError) {
      return NextResponse.json(
        { error: existingPublishedError.message },
        { status: 500 }
      );
    }

    const alreadyPublishedIds = new Set(
      ((existingPublishedRows ?? []) as Array<Record<string, unknown>>)
        .map((row) =>
          String(row.document_studio_generated_document_id || "").trim()
        )
        .filter(Boolean)
    );

    const rowsToCreate = portalRows.filter(
      (row) =>
        !alreadyPublishedIds.has(
          String(row.document_studio_generated_document_id || "").trim()
        )
    );

    const { data: newlyPublishedRows, error: upsertError } =
      rowsToCreate.length > 0
        ? await supabaseAdmin
            .from("investor_documents")
            .upsert(rowsToCreate, {
              onConflict: "document_studio_generated_document_id",
              // ON CONFLICT DO NOTHING preserves original publication evidence.
              ignoreDuplicates: true,
            })
            .select(
              "id, document_studio_generated_document_id, investor_master_id, investor_code, investor_name, period_label, fund_memory_snapshot_id, fund_memory_reporting_date, fund_memory_snapshot_version, portal_status, published_at"
            )
        : { data: [], error: null };

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const newlyPublishedGeneratedIds = rowsToCreate
      .map((row) =>
        String(row.document_studio_generated_document_id || "").trim()
      )
      .filter(Boolean);

    if (newlyPublishedGeneratedIds.length > 0) {
      const { error: updateDocumentsError } = await supabaseAdmin
        .from("document_studio_generated_documents")
        .update({
          generation_status: "Published",
          portal_publish_status: "Published",
          published_at: now,
        })
        .eq("organisation_id", actor.organisationId)
        .eq("fund_name", actor.fundName)
        .in("id", newlyPublishedGeneratedIds);

      if (updateDocumentsError) {
        return NextResponse.json(
          { error: updateDocumentsError.message },
          { status: 500 }
        );
      }
    }

    const publishedRows = [
      ...((existingPublishedRows ?? []) as Array<Record<string, unknown>>),
      ...((newlyPublishedRows ?? []) as Array<Record<string, unknown>>),
    ];

    const { count: publishedCount, error: countError } = await supabaseAdmin
      .from("investor_documents")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName)
      .eq("document_studio_batch_id", batchId)
      .eq("publish_source", "document_studio");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const finalPublishedCount = publishedCount ?? portalRows.length;

    const { error: updateBatchError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .update({
        published_count: finalPublishedCount,
        generated_count: generatedRows.length,
        status:
          finalPublishedCount >= generatedRows.length
            ? "Published"
            : "Partially Published",
        updated_at: now,
      })
      .eq("id", batchId)
      .eq("organisation_id", actor.organisationId)
      .eq("fund_name", actor.fundName);

    if (updateBatchError) {
      return NextResponse.json(
        { error: updateBatchError.message },
        { status: 500 }
      );
    }

    const createdCount = rowsToCreate.length;
    const alreadyPublishedCount = alreadyPublishedIds.size;

    return NextResponse.json({
      message:
        createdCount === 0
          ? `${finalPublishedCount} canonical document(s) were already published. No publication evidence was changed.`
          : alreadyPublishedCount > 0
            ? `${createdCount} canonical document(s) published; ${alreadyPublishedCount} already-published document(s) were left unchanged.`
            : createdCount === 1
              ? "1 canonical document published to Investor Portal successfully."
              : `${createdCount} canonical documents published to Investor Portal successfully.`,
      batch_id: batchId,
      publishedDocuments: finalPublishedCount,
      created_count: createdCount,
      already_published_count: alreadyPublishedCount,
      documents: publishedRows,
      canonical: true,
      idempotent: true,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Document Studio canonical publish failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish canonical documents to Investor Portal.",
      },
      { status: 500 }
    );
  }
}

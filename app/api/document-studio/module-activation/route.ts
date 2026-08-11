import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  requireDocumentStudioFundAccess,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_KEY = "investor_documents_portal";
const MODULE_NAME = "Investor Documents Portal";

type DataRow = Record<string, unknown>;

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function asRecord(value: unknown): DataRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DataRow;
}

async function getModuleReadiness(args: {
  organisationId: string;
  fundName: string;
}) {
  const { organisationId, fundName } = args;

  const [investorResult, controlsResult, generatedResult, activationResult] =
    await Promise.all([
      // investor_master is a legacy fund-scoped table and does not carry
      // organisation_id. Organisation isolation is established by the
      // authenticated fund-access check plus the organisation-scoped
      // Fund Memory / generated-document controls below.
      supabaseAdmin
        .from("investor_master")
        .select("id, investor_code", { count: "exact" })
        .eq("fund_name", fundName),
      supabaseAdmin
        .from("investor_position_snapshot_controls")
        .select("snapshot_id, investor_id, investor_statement_eligible", {
          count: "exact",
        })
        .eq("organisation_id", organisationId)
        .eq("fund_name", fundName)
        .eq("investor_statement_eligible", true),
      supabaseAdmin
        .from("document_studio_generated_documents")
        .select("id, investor_id, investor_code, generation_status, preview_data")
        .eq("organisation_id", organisationId)
        .eq("fund_name", fundName)
        .in("generation_status", ["Generated", "Published"])
        .limit(500),
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("*")
        .eq("organisation_id", organisationId)
        .eq("fund_name", fundName)
        .eq("module_key", MODULE_KEY)
        .limit(1)
        .maybeSingle(),
    ]);

  if (investorResult.error) {
    throw new Error(`Unable to verify governed investors: ${investorResult.error.message}`);
  }
  if (controlsResult.error) {
    throw new Error(`Unable to verify Fund Memory eligibility: ${controlsResult.error.message}`);
  }
  if (generatedResult.error) {
    throw new Error(`Unable to verify generated documents: ${generatedResult.error.message}`);
  }
  if (activationResult.error) {
    throw new Error(`Unable to load module activation: ${activationResult.error.message}`);
  }

  const generatedRows = (generatedResult.data ?? []) as DataRow[];
  const canonicalGeneratedRows = generatedRows.filter((row) => {
    const preview = asRecord(row.preview_data);
    const fundMemory = asRecord(preview.fundMemory);
    return preview.canonical === true && Boolean(normalizeText(fundMemory.snapshot_id, 80));
  });

  const investorCount = Number(investorResult.count ?? (investorResult.data ?? []).length);
  const eligibleSnapshotCount = Number(
    controlsResult.count ?? (controlsResult.data ?? []).length
  );
  const canonicalGeneratedCount = canonicalGeneratedRows.length;

  const criteria = [
    {
      key: "governed_investor",
      label: "Governed investor identity",
      passed: investorCount > 0,
      detail: `${investorCount} governed investor(s) available for this fund.`,
    },
    {
      key: "approved_fund_memory",
      label: "Approved Fund Memory",
      passed: eligibleSnapshotCount > 0,
      detail: `${eligibleSnapshotCount} investor statement-eligible snapshot(s) available.`,
    },
    {
      key: "canonical_generated_pdf",
      label: "Canonical generated PDF",
      passed: canonicalGeneratedCount > 0,
      detail: `${canonicalGeneratedCount} generated/published PDF(s) carry canonical Fund Memory lineage.`,
    },
  ];

  const passedCount = criteria.filter((criterion) => criterion.passed).length;
  const readinessScore = Math.round((passedCount / criteria.length) * 100);
  const ready = criteria.every((criterion) => criterion.passed);
  const persisted = (activationResult.data as DataRow | null) ?? null;
  const status =
    normalizeText(persisted?.status, 80) === "Active"
      ? "Active"
      : ready
        ? "Ready for Activation"
        : "Setup Not Started";

  return {
    module_key: MODULE_KEY,
    module_name: MODULE_NAME,
    status,
    readiness_score: readinessScore,
    ready,
    criteria,
    counts: {
      governed_investors: investorCount,
      eligible_snapshots: eligibleSnapshotCount,
      canonical_generated_pdfs: canonicalGeneratedCount,
    },
    activation: persisted,
    canonical_generated_document_ids: canonicalGeneratedRows
      .map((row) => normalizeText(row.id, 80))
      .filter(Boolean),
    eligible_snapshot_ids: ((controlsResult.data ?? []) as DataRow[])
      .map((row) => normalizeText(row.snapshot_id, 80))
      .filter(Boolean),
  };
}

export async function GET(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const fundName = normalizeText(request.nextUrl.searchParams.get("fund_name"), 240);
    const actor = await requireDocumentStudioFundAccess(baseActor, fundName, "view");
    const readiness = await getModuleReadiness({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
    });

    return NextResponse.json({
      fund_name: actor.fundName,
      ...readiness,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Investor Documents activation readiness.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const body = await request.json();
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      body.fund_name,
      "approve"
    );

    const readiness = await getModuleReadiness({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
    });

    if (!readiness.ready) {
      return NextResponse.json(
        {
          code: "MODULE_NOT_READY",
          error:
            "Investor Documents Portal is not ready for activation. Complete the governed readiness checks first.",
          readiness,
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const readinessEvidence = {
      rule:
        "Scoped Investor Documents activation requires governed investor identity, approved statement-eligible Fund Memory, and at least one canonical generated PDF.",
      criteria: readiness.criteria,
      counts: readiness.counts,
      eligible_snapshot_ids: readiness.eligible_snapshot_ids,
      canonical_generated_document_ids:
        readiness.canonical_generated_document_ids,
      activated_at: now,
    };

    const { data, error } = await supabaseAdmin
      .from("ventiq_module_activation_status")
      .upsert(
        {
          organisation_id: actor.organisationId,
          fund_name: actor.fundName,
          module_key: MODULE_KEY,
          module_name: MODULE_NAME,
          status: "Active",
          readiness_score: 100,
          readiness_evidence: readinessEvidence,
          activated_at: now,
          activated_by_user_id: actor.userId,
          activated_by_email: actor.email,
          activated_by_name: actor.fullName,
          updated_at: now,
        },
        { onConflict: "organisation_id,fund_name,module_key" }
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Unable to activate Investor Documents Portal: ${error.message}`);
    }

    return NextResponse.json({
      message:
        "Investor Documents Portal activated for this fund. Full-fund activation remains unchanged.",
      fund_name: actor.fundName,
      module_activation: data,
      readiness: { ...readiness, status: "Active", readiness_score: 100 },
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate Investor Documents Portal.",
      },
      { status: 500 }
    );
  }
}

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

type SnapshotControlRow = {
  snapshot_id: string;
  organisation_id: string;
  fund_name: string;
  investor_id: string;
  investor_code: string | null;
  investor_name: string | null;
  class_name: string | null;
  reporting_date: string;
  reporting_period: string | null;
  snapshot_version: number;
  investor_statement_eligible: boolean;
  blocker_codes: string[] | null;
};

type BatchException = {
  investor_id: string;
  investor_code: string;
  investor_name: string;
  code: string;
  blockers: string[];
  message: string;
};

type CanonicalReadyInvestor = {
  investor: DataRow;
  control: SnapshotControlRow;
  snapshot: DataRow;
  cashflows: DataRow[];
};

const SNAPSHOT_DOCUMENT_TYPES = new Set([
  "Statement of Account (SOA)",
  "Unit Statement",
  "Annual Income Report",
]);

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getString(
  row: DataRow | null | undefined,
  keys: string[],
  fallback = ""
) {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return fallback;
}

function getNullableNumber(
  row: DataRow | null | undefined,
  keys: string[]
): number | null {
  if (!row) return null;

  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (
      typeof value === "string" &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return null;
}

function formatMoney(value: number | null, currency = "INR") {
  if (value === null || !Number.isFinite(value)) return "Unavailable";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || "INR"} ${new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(value)}`;
  }
}

function formatMultiple(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percentValue.toFixed(2)}%`;
}

function formatIsoDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

function blockerList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
}

function chunk<T>(items: T[], size = 100) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function loadControls(args: {
  organisationId: string;
  fundName: string;
  investorIds: string[];
  eligibleOnly: boolean;
}) {
  const { organisationId, fundName, investorIds, eligibleOnly } = args;
  const rows: SnapshotControlRow[] = [];

  for (const investorIdChunk of chunk(investorIds, 100)) {
    if (investorIdChunk.length === 0) continue;

    let query = supabaseAdmin
      .from("investor_position_snapshot_controls")
      .select(
        [
          "snapshot_id",
          "organisation_id",
          "fund_name",
          "investor_id",
          "investor_code",
          "investor_name",
          "class_name",
          "reporting_date",
          "reporting_period",
          "snapshot_version",
          "investor_statement_eligible",
          "blocker_codes",
        ].join(",")
      )
      .eq("organisation_id", organisationId)
      .eq("fund_name", fundName)
      .in("investor_id", investorIdChunk)
      .order("reporting_date", { ascending: false })
      .order("snapshot_version", { ascending: false });

    if (eligibleOnly) {
      query = query.eq("investor_statement_eligible", true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        `Unable to evaluate Fund Memory statement eligibility: ${error.message}`
      );
    }

    const controlRows = (data ?? []) as unknown as SnapshotControlRow[];
    rows.push(...controlRows);
  }

  const latestByInvestor = new Map<string, SnapshotControlRow>();
  for (const row of rows) {
    if (!latestByInvestor.has(row.investor_id)) {
      latestByInvestor.set(row.investor_id, row);
    }
  }

  return latestByInvestor;
}

async function loadApprovedSnapshots(args: {
  organisationId: string;
  fundName: string;
  controls: SnapshotControlRow[];
}) {
  const { organisationId, fundName, controls } = args;
  const snapshotIds = controls.map((control) => control.snapshot_id).filter(Boolean);
  const result = new Map<string, DataRow>();

  for (const snapshotIdChunk of chunk(snapshotIds, 100)) {
    if (snapshotIdChunk.length === 0) continue;

    const { data, error } = await supabaseAdmin
      .from("investor_position_snapshots")
      .select("*")
      .eq("organisation_id", organisationId)
      .eq("fund_name", fundName)
      .eq("approval_status", "approved")
      .is("superseded_at", null)
      .in("id", snapshotIdChunk);

    if (error) {
      throw new Error(`Unable to load canonical Fund Memory: ${error.message}`);
    }

    for (const snapshot of (data ?? []) as DataRow[]) {
      const id = getString(snapshot, ["id"]);
      if (id) result.set(id, snapshot);
    }
  }

  return result;
}

async function loadCashflows(args: {
  fundName: string;
  investorId: string;
  reportingDate: string;
}) {
  const { fundName, investorId, reportingDate } = args;

  const { data, error } = await supabaseAdmin
    .from("investor_cashflows")
    .select("*")
    .eq("fund_name", fundName)
    .eq("investor_id", investorId)
    .lte("cashflow_date", reportingDate)
    .order("cashflow_date", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(
      `Unable to load point-in-time investor cashflows: ${error.message}`
    );
  }

  return (data ?? []) as DataRow[];
}

async function evaluateFundMemory(args: {
  organisationId: string;
  fundName: string;
}) {
  const { organisationId, fundName } = args;

  const { data: investorData, error: investorError } = await supabaseAdmin
    .from("investor_master")
    .select("*")
    .eq("fund_name", fundName)
    .order("investor_code", { ascending: true })
    .limit(500);

  if (investorError) {
    throw new Error(`Unable to load governed fund investors: ${investorError.message}`);
  }

  const investors = ((investorData ?? []) as DataRow[]).filter((row) =>
    Boolean(getString(row, ["id"]))
  );
  const investorIds = investors.map((row) => getString(row, ["id"]));

  const [eligibleControls, latestControls] = await Promise.all([
    loadControls({ organisationId, fundName, investorIds, eligibleOnly: true }),
    loadControls({ organisationId, fundName, investorIds, eligibleOnly: false }),
  ]);

  const approvedSnapshots = await loadApprovedSnapshots({
    organisationId,
    fundName,
    controls: Array.from(eligibleControls.values()),
  });

  const readyWithoutCashflows: Array<{
    investor: DataRow;
    control: SnapshotControlRow;
    snapshot: DataRow;
  }> = [];
  const exceptions: BatchException[] = [];

  for (const investor of investors) {
    const investorId = getString(investor, ["id"]);
    const investorCode = getString(investor, ["investor_code", "code"]);
    const investorName = getString(investor, [
      "investor_name",
      "name",
      "full_name",
    ]);
    const eligibleControl = eligibleControls.get(investorId);

    if (!eligibleControl) {
      const latestControl = latestControls.get(investorId);
      exceptions.push({
        investor_id: investorId,
        investor_code: investorCode,
        investor_name: investorName,
        code: latestControl
          ? "FUND_MEMORY_NOT_STATEMENT_ELIGIBLE"
          : "FUND_MEMORY_SNAPSHOT_REQUIRED",
        blockers: latestControl ? blockerList(latestControl.blocker_codes) : [],
        message: latestControl
          ? "Latest Fund Memory is not statement eligible."
          : "No canonical Fund Memory snapshot exists for this investor.",
      });
      continue;
    }

    const snapshot = approvedSnapshots.get(eligibleControl.snapshot_id);
    if (!snapshot) {
      exceptions.push({
        investor_id: investorId,
        investor_code: investorCode,
        investor_name: investorName,
        code: "ELIGIBLE_FUND_MEMORY_NOT_FOUND",
        blockers: [],
        message:
          "Fund Memory eligibility passed, but the approved canonical snapshot could not be loaded.",
      });
      continue;
    }

    const reportingDate = getString(snapshot, ["reporting_date"]);
    if (!reportingDate) {
      exceptions.push({
        investor_id: investorId,
        investor_code: investorCode,
        investor_name: investorName,
        code: "FUND_MEMORY_REPORTING_DATE_REQUIRED",
        blockers: [],
        message:
          "The approved Fund Memory snapshot does not contain an authoritative reporting date.",
      });
      continue;
    }

    readyWithoutCashflows.push({ investor, control: eligibleControl, snapshot });
  }

  const ready: CanonicalReadyInvestor[] = [];
  for (const group of chunk(readyWithoutCashflows, 20)) {
    const groupResults = await Promise.all(
      group.map(async (entry) => {
        const investorId = getString(entry.investor, ["id"]);
        const reportingDate = getString(entry.snapshot, ["reporting_date"]);
        const cashflows = await loadCashflows({ fundName, investorId, reportingDate });
        return { ...entry, cashflows };
      })
    );
    ready.push(...groupResults);
  }

  return { investors, ready, exceptions };
}

function buildCanonicalPreviewData(args: {
  fundName: string;
  documentType: string;
  entry: CanonicalReadyInvestor;
}) {
  const { fundName, documentType, entry } = args;
  const { investor, control, snapshot, cashflows } = entry;

  const investorId = getString(investor, ["id"]);
  const investorCode = getString(investor, ["investor_code", "code"]);
  const investorName = getString(investor, [
    "investor_name",
    "name",
    "full_name",
  ]);
  const reportingDate = getString(snapshot, ["reporting_date"]);
  const reportingPeriod = getString(snapshot, ["reporting_period"]);
  const currency = getString(snapshot, ["currency"], "INR");

  const commitmentAmount = getNullableNumber(snapshot, ["commitment_amount"]);
  const capitalCalled = getNullableNumber(snapshot, ["capital_called"]);
  const uncalledCapital = getNullableNumber(snapshot, ["uncalled_capital"]);
  const distributions = getNullableNumber(snapshot, ["distributions_to_date"]);
  const netContributed = getNullableNumber(snapshot, ["net_contributed"]);
  const currentNav = getNullableNumber(snapshot, ["current_nav"]);

  const investorDpi = getNullableNumber(snapshot, ["investor_dpi"]);
  const investorTvpi = getNullableNumber(snapshot, ["investor_tvpi"]);
  const investorMoic = getNullableNumber(snapshot, ["investor_moic"]);
  const investorIrr = getNullableNumber(snapshot, ["investor_irr"]);
  const grossIrr = getNullableNumber(snapshot, ["gross_irr"]);
  const netIrr = getNullableNumber(snapshot, ["net_irr"]);

  const unitsHeld = getNullableNumber(snapshot, ["units_held"]);
  const navPerUnit = getNullableNumber(snapshot, ["nav_per_unit"]);
  const openingCapital = getNullableNumber(snapshot, ["opening_capital"]);
  const periodCapitalContributions = getNullableNumber(snapshot, [
    "period_capital_contributions",
  ]);
  const periodCapitalDistributions = getNullableNumber(snapshot, [
    "period_capital_distributions",
  ]);
  const periodIncomeAllocation = getNullableNumber(snapshot, [
    "period_income_allocation",
  ]);
  const periodExpenseAllocation = getNullableNumber(snapshot, [
    "period_expense_allocation",
  ]);
  const closingCapital = getNullableNumber(snapshot, ["closing_capital"]);

  const formattedDistribution = formatMoney(distributions, currency);
  const formattedPeriodDistribution = formatMoney(
    periodCapitalDistributions,
    currency
  );

  const mergedFields: Record<string, string | number> = {
    investor_id: investorId,
    investor_code: investorCode,
    investor_name: investorName,
    email: getString(investor, ["email", "investor_email"]),
    investor_type: getString(investor, ["investor_type", "type"], "Investor"),

    fund_name: fundName,
    class_name: getString(snapshot, ["class_name"]),
    statement_period: reportingPeriod || `As of ${formatIsoDate(reportingDate)}`,
    report_date: formatIsoDate(reportingDate),
    generated_on: new Date().toLocaleDateString("en-IN"),

    commitment_amount: formatMoney(commitmentAmount, currency),
    capital_called: formatMoney(capitalCalled, currency),
    uncalled_capital: formatMoney(uncalledCapital, currency),
    distribution_amount: formattedDistribution,
    net_contributed: formatMoney(netContributed, currency),
    current_nav: formatMoney(currentNav, currency),

    units_held:
      unitsHeld === null
        ? "Unavailable"
        : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 6 }).format(
            unitsHeld
          ),
    nav_per_unit: formatMoney(navPerUnit, currency),

    opening_capital: formatMoney(openingCapital, currency),
    period_capital_contributions: formatMoney(
      periodCapitalContributions,
      currency
    ),
    period_capital_distributions: formattedPeriodDistribution,
    period_income_allocation: formatMoney(periodIncomeAllocation, currency),
    period_expense_allocation: formatMoney(periodExpenseAllocation, currency),
    closing_capital: formatMoney(closingCapital, currency),

    // Canonical aliases used by existing editable VENTIQ table mappings.
    capital_contribution: formatMoney(periodCapitalContributions, currency),
    income_allocation: formatMoney(periodIncomeAllocation, currency),
    distribution: formattedPeriodDistribution,
    current_value: formatMoney(currentNav, currency),
    nav: formatMoney(navPerUnit, currency),

    dpi: formatMultiple(investorDpi),
    tvpi: formatMultiple(investorTvpi),
    moic: formatMultiple(investorMoic),
    irr: formatPercent(investorIrr),
    gross_irr: formatPercent(grossIrr),
    net_irr: formatPercent(netIrr),

    cashflow_count: cashflows.length,
  };

  const transactions = cashflows.map((row) => ({
    transaction_date: formatIsoDate(
      getString(row, ["cashflow_date", "transaction_date", "date"])
    ),
    transaction_description: getString(row, [
      "description",
      "remarks",
      "cashflow_type",
      "transaction_type",
    ]),
    transaction_amount: formatMoney(
      getNullableNumber(row, ["amount", "cashflow_amount", "transaction_amount"]),
      currency
    ),
    transaction_type: getString(row, [
      "cashflow_type",
      "transaction_type",
      "type",
    ]),
    cashflow_date: formatIsoDate(
      getString(row, ["cashflow_date", "transaction_date", "date"])
    ),
    cashflow_type: getString(row, [
      "cashflow_type",
      "transaction_type",
      "type",
    ]),
    amount: formatMoney(
      getNullableNumber(row, ["amount", "cashflow_amount", "transaction_amount"]),
      currency
    ),
    remarks: getString(row, ["remarks", "description"]),
  }));

  return {
    canonical: true,
    documentType,
    investor: {
      id: investorId,
      investor_code: investorCode,
      investor_name: investorName,
    },
    fundMemory: {
      snapshot_id: control.snapshot_id,
      reporting_date: reportingDate,
      reporting_period: reportingPeriod || null,
      snapshot_version: Number(control.snapshot_version || 1),
      eligible: true,
      blockers: [],
      source_kind: getString(snapshot, ["source_kind"]),
      source_batch_id: getString(snapshot, ["source_batch_id"]),
      source_file_name: getString(snapshot, ["source_file_name"]),
      source_record_refs: snapshot.source_record_refs ?? [],
      calculation_version: getString(snapshot, ["calculation_version"]),
      reconciliation_status: getString(snapshot, ["reconciliation_status"]),
      validation_status: getString(snapshot, ["validation_status"]),
      approval_status: getString(snapshot, ["approval_status"]),
      approved_at: getString(snapshot, ["approved_at"]),
    },
    mergedFields,
    tables: {
      transactions,
      cashflows: transactions,
      capitalAccount: [
        {
          opening_capital: mergedFields.opening_capital,
          capital_contribution: mergedFields.capital_contribution,
          income_allocation: mergedFields.income_allocation,
          distribution: mergedFields.distribution,
          closing_capital: mergedFields.closing_capital,
        },
      ],
    },
    sourceCounts: {
      canonicalSnapshots: 1,
      cashflowRows: cashflows.length,
    },
  };
}

async function loadBatchExceptions(args: {
  organisationId: string;
  fundName: string;
  documentType: string;
}) {
  if (!SNAPSHOT_DOCUMENT_TYPES.has(args.documentType)) return [] as BatchException[];
  const evaluation = await evaluateFundMemory({
    organisationId: args.organisationId,
    fundName: args.fundName,
  });
  return evaluation.exceptions;
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
        exceptions: [],
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

    const exceptions = await loadBatchExceptions({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
      documentType: String(batch.document_type || ""),
    });

    return NextResponse.json({
      message: requestedBatchId
        ? "Selected governed batch loaded successfully."
        : "Latest governed batch loaded successfully.",
      batch,
      queuedDocuments: documents?.length ?? 0,
      documents: documents ?? [],
      exceptions,
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

    const templateId = normalizeText(body.template_id, 80);
    const documentType =
      normalizeText(body.document_type, 160) || "Statement of Account (SOA)";

    if (!SNAPSHOT_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json(
        {
          code: "GOVERNED_DOCUMENT_SOURCE_NOT_CONNECTED",
          error:
            `${documentType} is not yet connected to its governed canonical event source. ` +
            "VENTIQ will not batch-generate investor documents from legacy/default values.",
          documentType,
        },
        { status: 409 }
      );
    }

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

    const evaluation = await evaluateFundMemory({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
    });

    const { data: batch, error: batchError } = await supabaseAdmin
      .from("document_studio_generation_batches")
      .insert({
        template_id: templateId || null,
        batch_name: `${documentType} Batch - ${new Date().toLocaleDateString("en-IN")}`,
        document_type: documentType,
        total_investors: evaluation.investors.length,
        ready_count: evaluation.ready.length,
        review_count: evaluation.exceptions.length,
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

    const generatedRows = evaluation.ready.map((entry) => {
      const investorName = getString(entry.investor, [
        "investor_name",
        "name",
        "full_name",
      ]);
      const investorCode = getString(entry.investor, ["investor_code", "code"]);
      const previewData = buildCanonicalPreviewData({
        fundName: actor.fundName,
        documentType,
        entry,
      });

      return {
        batch_id: batch.id,
        template_id: templateId || null,
        investor_id: getString(entry.investor, ["id"]) || null,
        investor_code: investorCode,
        investor_name: investorName,
        email: getString(entry.investor, ["email", "investor_email"]),
        document_type: documentType,
        document_name: `${documentType} - ${investorName}`,
        file_name: `${investorCode || "INV"}_${documentType.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        preview_data: previewData,
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
      message:
        `Canonical batch prepared. ${generatedRows.length} investor(s) are ready for PDF generation` +
        `${evaluation.exceptions.length > 0 ? `; ${evaluation.exceptions.length} investor(s) require Fund Memory review.` : "."}`,
      batch,
      queuedDocuments: generatedRows.length,
      documents,
      exceptions: evaluation.exceptions,
      eligibilitySummary: {
        totalInvestors: evaluation.investors.length,
        ready: evaluation.ready.length,
        review: evaluation.exceptions.length,
      },
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("Document Studio canonical batch failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to prepare canonical batch generation.",
      },
      { status: 500 }
    );
  }
}

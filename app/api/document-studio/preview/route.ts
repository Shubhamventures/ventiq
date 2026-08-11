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

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
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

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

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
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

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
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return `${value.toFixed(2)}x`;
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

  /*
   * Historical VENTIQ investor metrics have been stored both as decimals
   * (0.187 = 18.7%) and percentage values (18.7 = 18.7%).
   * Preserve the stored economic meaning without manufacturing a default.
   */
  const percentValue = Math.abs(value) <= 1 ? value * 100 : value;
  return `${percentValue.toFixed(2)}%`;
}

function formatIsoDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return raw || "Unavailable";

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
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
    ][monthIndex] || month;

  return `${day}-${monthName}-${year}`;
}

function blockerList(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter(
    (item): item is string => typeof item === "string" && Boolean(item.trim())
  );
}

async function loadInvestor(args: {
  fundName: string;
  investorId: string;
  investorCode: string;
}) {
  const { fundName, investorId, investorCode } = args;

  if (!investorId && !investorCode) {
    throw new Error("INVESTOR_SELECTION_REQUIRED");
  }

  let query = supabaseAdmin
    .from("investor_master")
    .select("*")
    .eq("fund_name", fundName);

  if (investorId) {
    query = query.eq("id", investorId);
  } else {
    query = query.eq("investor_code", investorCode);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Unable to load investor master record: ${error.message}`);
  }

  return (data ?? null) as DataRow | null;
}

async function loadLatestEligibleControl(args: {
  organisationId: string;
  fundName: string;
  investorId: string;
}) {
  const { organisationId, fundName, investorId } = args;

  const { data, error } = await supabaseAdmin
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
    .eq("investor_id", investorId)
    .eq("investor_statement_eligible", true)
    .order("reporting_date", { ascending: false })
    .order("snapshot_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to evaluate Fund Memory statement eligibility: ${error.message}`
    );
  }

  return (data ?? null) as SnapshotControlRow | null;
}

async function loadLatestControl(args: {
  organisationId: string;
  fundName: string;
  investorId: string;
}) {
  const { organisationId, fundName, investorId } = args;

  const { data, error } = await supabaseAdmin
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
    .eq("investor_id", investorId)
    .order("reporting_date", { ascending: false })
    .order("snapshot_version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to inspect the latest Fund Memory snapshot: ${error.message}`
    );
  }

  return (data ?? null) as SnapshotControlRow | null;
}

async function loadSnapshot(args: {
  organisationId: string;
  fundName: string;
  investorId: string;
  snapshotId: string;
}) {
  const { organisationId, fundName, investorId, snapshotId } = args;

  const { data, error } = await supabaseAdmin
    .from("investor_position_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("organisation_id", organisationId)
    .eq("fund_name", fundName)
    .eq("investor_id", investorId)
    .eq("approval_status", "approved")
    .is("superseded_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load canonical Fund Memory: ${error.message}`);
  }

  return (data ?? null) as DataRow | null;
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


export async function GET(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fund_name"),
      240
    );
    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      fundName,
      "view"
    );

    const { data, error } = await supabaseAdmin
      .from("investor_master")
      .select("*")
      .eq("fund_name", actor.fundName)
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { error: `Unable to load governed fund investors: ${error.message}` },
        { status: 500 }
      );
    }

    const investors = ((data ?? []) as DataRow[])
      .map((row) => ({
        id: getString(row, ["id"]),
        investor_code: getString(row, ["investor_code", "code"]),
        investor_name: getString(row, [
          "investor_name",
          "name",
          "full_name",
        ]),
        investor_type: getString(row, ["investor_type", "type"], "Investor"),
        email: getString(row, ["email", "investor_email"]),
      }))
      .filter((row) => Boolean(row.id))
      .sort((a, b) =>
        (a.investor_name || a.investor_code || a.id).localeCompare(
          b.investor_name || b.investor_code || b.id
        )
      );

    return NextResponse.json({
      message: "Governed fund investors loaded successfully.",
      fund_name: actor.fundName,
      investors,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load governed Document Studio investors.",
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
      "view"
    );

    const documentType =
      normalizeText(body.document_type, 160) || "Statement of Account (SOA)";

    /*
     * A6 begins with statement-style documents backed by canonical point-in-time
     * Fund Memory. Event-driven documents (capital calls, distributions, unit
     * allotments, reminders and tax outputs) will be connected to their own
     * governed event sources instead of being allowed to fall back to positions.
     */
    if (!SNAPSHOT_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json(
        {
          code: "GOVERNED_DOCUMENT_SOURCE_NOT_CONNECTED",
          error:
            `${documentType} is not yet connected to its governed canonical event source. ` +
            "VENTIQ will not generate a financial preview from legacy/default values.",
          documentType,
        },
        { status: 409 }
      );
    }

    const investorId = normalizeText(body.investor_id, 80);
    const investorCode = normalizeText(body.investor_code, 160);

    if (!investorId && !investorCode) {
      return NextResponse.json(
        {
          code: "INVESTOR_SELECTION_REQUIRED",
          error:
            "Select a governed investor before generating a Document Studio preview.",
        },
        { status: 400 }
      );
    }

    const investor = await loadInvestor({
      fundName: actor.fundName,
      investorId,
      investorCode,
    });

    if (!investor) {
      return NextResponse.json(
        {
          code: "INVESTOR_NOT_FOUND_IN_FUND",
          error:
            "The selected investor was not found inside the governed active fund.",
        },
        { status: 404 }
      );
    }

    const resolvedInvestorId = getString(investor, ["id"]);
    const resolvedInvestorCode = getString(investor, [
      "investor_code",
      "code",
    ]);
    const resolvedInvestorName = getString(investor, [
      "investor_name",
      "name",
      "full_name",
    ]);

    if (!resolvedInvestorId) {
      return NextResponse.json(
        {
          code: "INVESTOR_ID_MISSING",
          error:
            "The governed investor master record does not contain a usable investor id.",
        },
        { status: 409 }
      );
    }

    const eligibleControl = await loadLatestEligibleControl({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
      investorId: resolvedInvestorId,
    });

    if (!eligibleControl) {
      const latestControl = await loadLatestControl({
        organisationId: actor.organisationId,
        fundName: actor.fundName,
        investorId: resolvedInvestorId,
      });

      return NextResponse.json(
        {
          code: latestControl
            ? "FUND_MEMORY_NOT_STATEMENT_ELIGIBLE"
            : "FUND_MEMORY_SNAPSHOT_REQUIRED",
          error: latestControl
            ? "The latest Fund Memory snapshot is not eligible for investor-facing statements."
            : "No canonical Fund Memory snapshot exists for this investor.",
          investor: {
            id: resolvedInvestorId,
            investor_code: resolvedInvestorCode,
            investor_name: resolvedInvestorName,
          },
          fundMemory: latestControl
            ? {
                snapshot_id: latestControl.snapshot_id,
                reporting_date: latestControl.reporting_date,
                reporting_period: latestControl.reporting_period,
                snapshot_version: latestControl.snapshot_version,
                eligible: false,
                blockers: blockerList(latestControl.blocker_codes),
              }
            : null,
        },
        { status: 409 }
      );
    }

    const snapshot = await loadSnapshot({
      organisationId: actor.organisationId,
      fundName: actor.fundName,
      investorId: resolvedInvestorId,
      snapshotId: eligibleControl.snapshot_id,
    });

    if (!snapshot) {
      return NextResponse.json(
        {
          code: "ELIGIBLE_FUND_MEMORY_NOT_FOUND",
          error:
            "Fund Memory eligibility passed, but the approved canonical snapshot could not be loaded.",
        },
        { status: 409 }
      );
    }

    const reportingDate = getString(snapshot, ["reporting_date"]);
    const reportingPeriod = getString(snapshot, ["reporting_period"]);
    const currency = getString(snapshot, ["currency"], "INR");

    if (!reportingDate) {
      return NextResponse.json(
        {
          code: "FUND_MEMORY_REPORTING_DATE_REQUIRED",
          error:
            "The approved Fund Memory snapshot does not contain an authoritative reporting date.",
        },
        { status: 409 }
      );
    }

    const cashflowRows = await loadCashflows({
      fundName: actor.fundName,
      investorId: resolvedInvestorId,
      reportingDate,
    });

    const commitmentAmount = getNullableNumber(snapshot, [
      "commitment_amount",
    ]);
    const capitalCalled = getNullableNumber(snapshot, ["capital_called"]);
    const uncalledCapital = getNullableNumber(snapshot, ["uncalled_capital"]);
    const distributions = getNullableNumber(snapshot, [
      "distributions_to_date",
    ]);
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

    const mergedFields = {
      investor_id: resolvedInvestorId,
      investor_code: resolvedInvestorCode,
      investor_name: resolvedInvestorName,
      email: getString(investor, ["email", "investor_email"]),
      investor_type: getString(investor, ["investor_type", "type"], "Investor"),

      fund_name: actor.fundName,
      class_name: getString(snapshot, ["class_name"]),
      statement_period:
        reportingPeriod || `As of ${formatIsoDate(reportingDate)}`,
      report_date: formatIsoDate(reportingDate),
      generated_on: new Date().toLocaleDateString("en-IN"),

      commitment_amount: formatMoney(commitmentAmount, currency),
      capital_called: formatMoney(capitalCalled, currency),
      uncalled_capital: formatMoney(uncalledCapital, currency),
      distribution_amount: formatMoney(distributions, currency),
      net_contributed: formatMoney(netContributed, currency),
      current_nav: formatMoney(currentNav, currency),

      units_held:
        unitsHeld === null
          ? "Unavailable"
          : new Intl.NumberFormat("en-IN", {
              maximumFractionDigits: 6,
            }).format(unitsHeld),
      nav_per_unit: formatMoney(navPerUnit, currency),

      opening_capital: formatMoney(openingCapital, currency),
      period_capital_contributions: formatMoney(
        periodCapitalContributions,
        currency
      ),
      period_capital_distributions: formatMoney(
        periodCapitalDistributions,
        currency
      ),
      period_income_allocation: formatMoney(
        periodIncomeAllocation,
        currency
      ),
      period_expense_allocation: formatMoney(
        periodExpenseAllocation,
        currency
      ),
      closing_capital: formatMoney(closingCapital, currency),

      dpi: formatMultiple(investorDpi),
      tvpi: formatMultiple(investorTvpi),
      moic: formatMultiple(investorMoic),
      irr: formatPercent(investorIrr),
      gross_irr: formatPercent(grossIrr),
      net_irr: formatPercent(netIrr),

      cashflow_count: cashflowRows.length,
    };

    const transactions = cashflowRows.map((row) => ({
      date: formatIsoDate(
        getString(row, ["cashflow_date", "transaction_date", "date"])
      ),
      description: getString(row, [
        "description",
        "remarks",
        "cashflow_type",
        "transaction_type",
      ]),
      amount: formatMoney(
        getNullableNumber(row, [
          "amount",
          "cashflow_amount",
          "transaction_amount",
        ]),
        currency
      ),
      type: getString(row, [
        "cashflow_type",
        "transaction_type",
        "type",
      ]),
    }));

    return NextResponse.json({
      message:
        "Preview merge data loaded from approved, statement-eligible Fund Memory.",
      documentType,
      investor: {
        id: resolvedInvestorId,
        investor_code: resolvedInvestorCode,
        investor_name: resolvedInvestorName,
      },
      fundMemory: {
        snapshot_id: eligibleControl.snapshot_id,
        reporting_date: reportingDate,
        reporting_period: reportingPeriod || null,
        snapshot_version: Number(eligibleControl.snapshot_version || 1),
        eligible: true,
        blockers: [],
        source_kind: getString(snapshot, ["source_kind"]),
        source_batch_id: getString(snapshot, ["source_batch_id"]),
        source_file_name: getString(snapshot, ["source_file_name"]),
        source_record_refs: snapshot.source_record_refs ?? [],
        calculation_version: getString(snapshot, ["calculation_version"]),
        reconciliation_status: getString(snapshot, [
          "reconciliation_status",
        ]),
        validation_status: getString(snapshot, ["validation_status"]),
        approval_status: getString(snapshot, ["approval_status"]),
        approved_at: getString(snapshot, ["approved_at"]),
      },
      mergedFields,
      tables: {
        transactions,
      },
      sourceCounts: {
        canonicalSnapshots: 1,
        cashflowRows: cashflowRows.length,
      },
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const message = error instanceof Error ? error.message : "";

    if (message === "INVESTOR_SELECTION_REQUIRED") {
      return NextResponse.json(
        {
          code: "INVESTOR_SELECTION_REQUIRED",
          error:
            "Select a governed investor before generating a Document Studio preview.",
        },
        { status: 400 }
      );
    }

    console.error("Document Studio canonical preview failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate canonical Fund Memory preview.",
      },
      { status: 500 }
    );
  }
}

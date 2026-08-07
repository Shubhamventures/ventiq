/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const INSERT_CHUNK_SIZE = 250;
const CALCULATION_VERSION = "1.2";

const VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
]);

const CALCULATE_ROLES = new Set([
  "fund_admin",
  "finance_head",
  "maker",
]);

type SupabaseAdmin = any;
type DatabaseRow = Record<string, any>;

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
};

type AccessMode = "view" | "calculate";

type CalculationSettings = {
  fund_name: string;
  base_currency: string;
  nav_allocation_method:
    | "Paid-in Capital Pro Rata"
    | "Commitment Pro Rata"
    | "Uploaded Investor NAV";
  require_final_portfolio_valuations: boolean;
  include_cashflow_statuses: string[] | null;
  xirr_initial_guess: number | string | null;
  xirr_tolerance: number | string | null;
  xirr_max_iterations: number | string | null;
  reconciliation_amount_tolerance: number | string | null;
  reconciliation_percentage_tolerance: number | string | null;
  performance_distribution_basis: "Net Cash" | "Gross Distribution";
  nav_distribution_basis: "Gross Distribution" | "Net Cash";
  is_active: boolean;
};

type PortfolioMasterRow = {
  portfolio_code: string | null;
  portfolio_company: string | null;
  instrument_code: string | null;
  instrument_type: string | null;
  investment_date: string | null;
  migration_status: string | null;
  source_batch_id: string | null;
};

type PortfolioCashflowRow = {
  cashflow_code: string | null;
  portfolio_code: string | null;
  portfolio_company: string | null;
  instrument_code: string | null;
  instrument_type: string | null;
  cashflow_date: string | null;
  cashflow_type: string | null;
  cashflow_direction: string | null;
  gross_amount: number | string | null;
  net_amount: number | string | null;
  currency: string | null;
  status: string | null;
  source_batch_id: string | null;
};

type PortfolioValuationRow = {
  valuation_code: string | null;
  portfolio_code: string | null;
  portfolio_company: string | null;
  instrument_code: string | null;
  instrument_type: string | null;
  valuation_date: string | null;
  currency: string | null;
  investment_cost: number | string | null;
  fair_value: number | string | null;
  realised_value_to_date: number | string | null;
  valuation_status: string | null;
  is_final: boolean | null;
  source_batch_id: string | null;
};

type CommitmentRow = {
  commitment_code: string | null;
  investor_code: string | null;
  investor_name: string | null;
  class_name: string | null;
  commitment_date: string | null;
  commitment_amount: number | string | null;
  commitment_status: string | null;
  status: string | null;
  source_batch_id: string | null;
};

type InvestorMasterRow = {
  investor_code: string | null;
  investor_name: string | null;
  source_batch_id: string | null;
};

type InvestorCashflowRow = {
  cashflow_code: string | null;
  investor_code: string | null;
  investor_name: string | null;
  class_name: string | null;
  cashflow_date: string | null;
  cashflow_type: string | null;
  amount: number | string | null;
  cashflow_amount: number | string | null;
  direction: string | null;
  currency: string | null;
  status: string | null;
  source_batch_id: string | null;
};

type DistributionEventRow = {
  distribution_code: string | null;
  distribution_date: string | null;
  payment_date: string | null;
  distribution_amount: number | string | null;
  currency: string | null;
  status: string | null;
  source_batch_id: string | null;
};

type DistributionAllocationRow = {
  distribution_allocation_code: string | null;
  distribution_code: string | null;
  investor_code: string | null;
  investor_name: string | null;
  class_name: string | null;
  declaration_date: string | null;
  record_date: string | null;
  payment_date: string | null;
  gross_distribution: number | string | null;
  tax_withheld: number | string | null;
  other_deductions: number | string | null;
  net_distribution: number | string | null;
  currency: string | null;
  payment_status: string | null;
  source_batch_id: string | null;
};

type FundNavRow = {
  nav_code: string | null;
  reporting_date: string | null;
  currency: string | null;
  gross_nav: number | string | null;
  net_nav: number | string | null;
  investment_fair_value: number | string | null;
  total_assets: number | string | null;
  total_liabilities: number | string | null;
  commitments: number | string | null;
  paid_in_capital: number | string | null;
  distributions_to_date: number | string | null;
  uncalled_commitment: number | string | null;
  status: string | null;
  source_batch_id: string | null;
};

type DatedCashflow = {
  date: string;
  amount: number;
};

type PortfolioMetricOutput = {
  calculation_run_id: string;
  fund_name: string;
  portfolio_code: string;
  portfolio_company: string | null;
  instrument_code: string | null;
  instrument_type: string | null;
  as_of_date: string;
  currency: string;
  invested_capital: number;
  realised_proceeds: number;
  terminal_fair_value: number;
  total_value: number;
  gross_profit: number;
  gross_moic: number | null;
  gross_irr: number | null;
  cashflow_count: number;
  first_cashflow_date: string | null;
  last_cashflow_date: string | null;
  valuation_date: string | null;
  calculation_status:
    | "Calculated"
    | "Insufficient Data"
    | "Calculation Error";
  calculation_note: string | null;
};

type InvestorMetricOutput = {
  calculation_run_id: string;
  fund_name: string;
  investor_code: string;
  investor_name: string | null;
  class_name: string | null;
  as_of_date: string;
  currency: string;
  commitment_amount: number;
  paid_in_capital: number;
  total_distributions: number;
  gross_distributions: number;
  withholding_tax: number;
  net_distributions: number;
  performance_distribution_basis: string;
  uncalled_commitment: number;
  nav_allocation_percentage: number;
  allocated_nav: number;
  dpi: number | null;
  rvpi: number | null;
  tvpi: number | null;
  net_irr: number | null;
  cashflow_count: number;
  nav_allocation_method: string;
  calculation_status:
    | "Calculated"
    | "Insufficient Data"
    | "Calculation Error";
  calculation_note: string | null;
};

function getSupabaseAdmin(): SupabaseAdmin | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

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

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin,
  fundName: string,
  mode: AccessMode
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const {
    data: userResult,
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  const user = userResult?.user;

  if (userError || !user) {
    throw new Error("INVALID_SESSION");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("ventiq_user_profiles")
    .select("user_id, email, full_name, default_role, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to load VENTIQ profile: ${profileError.message}`
    );
  }

  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  const allowedRoles = mode === "calculate" ? CALCULATE_ROLES : VIEW_ROLES;
  let role = String(profile.default_role || "").trim();

  if (!allowedRoles.has(role)) {
    const {
      data: membership,
      error: membershipError,
    } = await supabase
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

    role = String(membership?.role || "").trim();
  }

  if (!allowedRoles.has(role)) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  if (role !== "fund_admin") {
    const {
      data: fundAccess,
      error: fundAccessError,
    } = await supabase
      .from("ventiq_user_fund_access")
      .select("can_view, can_edit")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .eq("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify fund access: ${fundAccessError.message}`
      );
    }

    const hasRequiredAccess =
      Boolean(fundAccess?.can_view) &&
      (mode === "view" || Boolean(fundAccess?.can_edit));

    if (!hasRequiredAccess) {
      throw new Error(
        mode === "calculate"
          ? "FUND_EDIT_ACCESS_REQUIRED"
          : "FUND_VIEW_ACCESS_REQUIRED"
      );
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
      { error: "Please sign in before accessing performance calculations." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED" ||
    message === "FUND_VIEW_ACCESS_REQUIRED"
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to access performance calculations for this fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

function normalizeIdentity(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/%/g, "")
    .trim();

  if (!cleaned) {
    return fallback;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundNumber(value: number, decimals = 8) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function nullableMetric(value: number | null, decimals = 10) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return roundNumber(value, decimals);
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function compareIsoDates(left: string | null, right: string | null) {
  return String(left || "").localeCompare(String(right || ""));
}

function minDate(values: Array<string | null>) {
  const valid = values.filter((value): value is string => Boolean(value));

  if (valid.length === 0) {
    return null;
  }

  return valid.sort(compareIsoDates)[0];
}

function maxDate(values: Array<string | null>) {
  const valid = values.filter((value): value is string => Boolean(value));

  if (valid.length === 0) {
    return null;
  }

  return valid.sort(compareIsoDates).at(-1) || null;
}

function mergeCashflows(cashflows: DatedCashflow[]) {
  const amountsByDate = new Map<string, number>();

  cashflows.forEach((cashflow) => {
    if (!cashflow.date || !Number.isFinite(cashflow.amount)) {
      return;
    }

    amountsByDate.set(
      cashflow.date,
      (amountsByDate.get(cashflow.date) || 0) + cashflow.amount
    );
  });

  return Array.from(amountsByDate.entries())
    .map(([date, amount]) => ({ date, amount }))
    .filter((cashflow) => Math.abs(cashflow.amount) > 0.0000001)
    .sort((left, right) => compareIsoDates(left.date, right.date));
}

function yearFraction(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const end = new Date(`${endDate}T00:00:00.000Z`).getTime();
  return (end - start) / (365 * 24 * 60 * 60 * 1000);
}

function xnpv(rate: number, cashflows: DatedCashflow[]) {
  if (rate <= -1) {
    return Number.POSITIVE_INFINITY;
  }

  const merged = mergeCashflows(cashflows);

  if (merged.length === 0) {
    return 0;
  }

  const firstDate = merged[0].date;

  return merged.reduce((total, cashflow) => {
    const years = yearFraction(firstDate, cashflow.date);
    return total + cashflow.amount / Math.pow(1 + rate, years);
  }, 0);
}

function xnpvDerivative(rate: number, cashflows: DatedCashflow[]) {
  if (rate <= -1) {
    return Number.NaN;
  }

  const merged = mergeCashflows(cashflows);

  if (merged.length === 0) {
    return 0;
  }

  const firstDate = merged[0].date;

  return merged.reduce((total, cashflow) => {
    const years = yearFraction(firstDate, cashflow.date);

    if (years === 0) {
      return total;
    }

    return (
      total -
      (years * cashflow.amount) /
        Math.pow(1 + rate, years + 1)
    );
  }, 0);
}

function calculateXirr(
  cashflows: DatedCashflow[],
  guess: number,
  tolerance: number,
  maxIterations: number
) {
  const merged = mergeCashflows(cashflows);
  const hasPositive = merged.some((cashflow) => cashflow.amount > 0);
  const hasNegative = merged.some((cashflow) => cashflow.amount < 0);

  if (merged.length < 2 || !hasPositive || !hasNegative) {
    return null;
  }

  let rate = Math.max(-0.95, Number.isFinite(guess) ? guess : 0.15);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const value = xnpv(rate, merged);
    const derivative = xnpvDerivative(rate, merged);

    if (!Number.isFinite(value) || !Number.isFinite(derivative)) {
      break;
    }

    if (Math.abs(value) <= tolerance) {
      return rate;
    }

    if (Math.abs(derivative) < 1e-14) {
      break;
    }

    const nextRate = rate - value / derivative;

    if (!Number.isFinite(nextRate) || nextRate <= -0.999999 || nextRate > 1_000_000) {
      break;
    }

    if (Math.abs(nextRate - rate) <= tolerance) {
      return nextRate;
    }

    rate = nextRate;
  }

  const minLogRate = Math.log(0.000001);
  const maxLogRate = Math.log(1_000_001);
  const scanSteps = 800;

  let previousLogRate = minLogRate;
  let previousRate = Math.exp(previousLogRate) - 1;
  let previousValue = xnpv(previousRate, merged);

  for (let index = 1; index <= scanSteps; index += 1) {
    const currentLogRate =
      minLogRate +
      ((maxLogRate - minLogRate) * index) / scanSteps;
    const currentRate = Math.exp(currentLogRate) - 1;
    const currentValue = xnpv(currentRate, merged);

    if (Number.isFinite(previousValue) && Number.isFinite(currentValue)) {
      if (Math.abs(currentValue) <= tolerance) {
        return currentRate;
      }

      if (previousValue * currentValue < 0) {
        let lowerLogRate = previousLogRate;
        let upperLogRate = currentLogRate;
        let lowerValue = previousValue;

        for (
          let iteration = 0;
          iteration < maxIterations;
          iteration += 1
        ) {
          const middleLogRate = (lowerLogRate + upperLogRate) / 2;
          const middleRate = Math.exp(middleLogRate) - 1;
          const middleValue = xnpv(middleRate, merged);

          if (!Number.isFinite(middleValue)) {
            break;
          }

          if (
            Math.abs(middleValue) <= tolerance ||
            Math.abs(upperLogRate - lowerLogRate) <= tolerance
          ) {
            return middleRate;
          }

          if (lowerValue * middleValue <= 0) {
            upperLogRate = middleLogRate;
          } else {
            lowerLogRate = middleLogRate;
            lowerValue = middleValue;
          }
        }
      }
    }

    previousLogRate = currentLogRate;
    previousRate = currentRate;
    previousValue = currentValue;
  }

  return null;
}

function includedStatus(status: string | null, allowedStatuses: Set<string>) {
  if (!status) {
    return true;
  }

  return allowedStatuses.has(normalizeIdentity(status));
}

function signedPortfolioCashflow(row: PortfolioCashflowRow) {
  const amount = Math.abs(
    toNumber(row.net_amount, toNumber(row.gross_amount, 0))
  );
  const direction = normalizeIdentity(row.cashflow_direction);
  const type = normalizeIdentity(row.cashflow_type);

  if (!amount) {
    return 0;
  }

  if (
    ["outflow", "debit", "payment"].includes(direction) ||
    type.includes("investment") ||
    type.includes("disbursement")
  ) {
    return -amount;
  }

  if (["inflow", "credit", "receipt"].includes(direction)) {
    return amount;
  }

  return amount;
}

function signedInvestorCashflow(row: InvestorCashflowRow) {
  const amount = Math.abs(
    toNumber(row.amount, toNumber(row.cashflow_amount, 0))
  );
  const direction = normalizeIdentity(row.direction);
  const type = normalizeIdentity(row.cashflow_type);

  if (!amount) {
    return 0;
  }

  if (
    ["outflow", "debit", "contribution"].includes(direction) ||
    type.includes("contribution") ||
    type.includes("capital call")
  ) {
    return -amount;
  }

  if (
    ["inflow", "credit", "distribution"].includes(direction) ||
    type.includes("distribution")
  ) {
    return amount;
  }

  return amount;
}

function isInvestorDistributionCashflow(row: InvestorCashflowRow) {
  const direction = normalizeIdentity(row.direction);
  const type = normalizeIdentity(row.cashflow_type);

  return (
    type.includes("distribution") ||
    ["distribution"].includes(direction)
  );
}

function distributionPaymentDate(row: DistributionAllocationRow) {
  return (
    normalizeText(row.payment_date) ||
    normalizeText(row.declaration_date) ||
    normalizeText(row.record_date)
  );
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }

  return chunks;
}

async function insertRows(
  supabase: SupabaseAdmin,
  table: string,
  rows: DatabaseRow[]
) {
  if (rows.length === 0) {
    return;
  }

  for (const chunk of chunkRows(rows, INSERT_CHUNK_SIZE)) {
    const { error } = await supabase.from(table).insert(chunk);

    if (error) {
      throw new Error(`Unable to insert ${table}: ${error.message}`);
    }
  }
}

async function fetchAllRows(
  supabase: SupabaseAdmin,
  input: {
    table: string;
    columns: string;
    filters?: Array<{
      operator: "eq" | "lte" | "gte";
      column: string;
      value: unknown;
    }>;
    order?: { column: string; ascending?: boolean };
  }
) {
  const rows: DatabaseRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(input.table).select(input.columns);

    for (const filter of input.filters || []) {
      if (filter.operator === "eq") {
        query = query.eq(filter.column, filter.value);
      } else if (filter.operator === "lte") {
        query = query.lte(filter.column, filter.value);
      } else if (filter.operator === "gte") {
        query = query.gte(filter.column, filter.value);
      }
    }

    if (input.order) {
      query = query.order(input.order.column, {
        ascending: input.order.ascending ?? true,
      });
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Unable to load ${input.table}: ${error.message}`);
    }

    const page = (data || []) as DatabaseRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

function collectSourceBatchIds(collections: DatabaseRow[][]) {
  const ids = new Set<string>();

  collections.flat().forEach((row) => {
    const sourceBatchId = normalizeText(row.source_batch_id);

    if (sourceBatchId) {
      ids.add(sourceBatchId);
    }
  });

  return Array.from(ids).sort();
}

function latestByDate<T>(
  rows: T[],
  getDateValue: (row: T) => string | null
) {
  return [...rows]
    .filter((row) => Boolean(getDateValue(row)))
    .sort((left, right) =>
      compareIsoDates(getDateValue(right), getDateValue(left))
    )[0] || null;
}

function makeReconciliation(input: {
  calculationRunId: string;
  fundName: string;
  asOfDate: string;
  reconciliationType: string;
  metricName: string;
  sourceValue: number | null;
  calculatedValue: number | null;
  amountTolerance: number;
  percentageTolerance: number;
  sourceReference: string;
  calculationReference: string;
  details?: Record<string, unknown>;
}) {
  const sourceValue = input.sourceValue;
  const calculatedValue = input.calculatedValue;

  if (sourceValue === null || calculatedValue === null) {
    return {
      calculation_run_id: input.calculationRunId,
      fund_name: input.fundName,
      as_of_date: input.asOfDate,
      reconciliation_type: input.reconciliationType,
      metric_name: input.metricName,
      source_value: sourceValue,
      calculated_value: calculatedValue,
      difference_amount: null,
      difference_percentage: null,
      amount_tolerance: input.amountTolerance,
      percentage_tolerance: input.percentageTolerance,
      reconciliation_status: "Not Applicable",
      source_reference: input.sourceReference,
      calculation_reference: input.calculationReference,
      details: input.details || {},
    };
  }

  const difference = calculatedValue - sourceValue;
  const differenceRatio =
    Math.abs(sourceValue) > 0
      ? Math.abs(difference) / Math.abs(sourceValue)
      : Math.abs(difference) > 0
        ? 1
        : 0;

  let reconciliationStatus: "Pass" | "Warning" | "Fail" = "Fail";

  if (
    Math.abs(difference) <= input.amountTolerance ||
    differenceRatio <= input.percentageTolerance
  ) {
    reconciliationStatus = "Pass";
  } else if (differenceRatio <= input.percentageTolerance * 5) {
    reconciliationStatus = "Warning";
  }

  return {
    calculation_run_id: input.calculationRunId,
    fund_name: input.fundName,
    as_of_date: input.asOfDate,
    reconciliation_type: input.reconciliationType,
    metric_name: input.metricName,
    source_value: roundNumber(sourceValue, 8),
    calculated_value: roundNumber(calculatedValue, 8),
    difference_amount: roundNumber(difference, 8),
    difference_percentage: roundNumber(differenceRatio, 10),
    amount_tolerance: input.amountTolerance,
    percentage_tolerance: input.percentageTolerance,
    reconciliation_status: reconciliationStatus,
    source_reference: input.sourceReference,
    calculation_reference: input.calculationReference,
    details: input.details || {},
  };
}

async function resolveSourceBatchId(
  supabase: SupabaseAdmin,
  fundName: string,
  requestedSourceBatchId: string
) {
  if (requestedSourceBatchId) {
    const {
      data: requestedBatch,
      error: requestedBatchError,
    } = await supabase
      .from("migration_intake_batches")
      .select("id, processing_status, status, total_rows")
      .eq("id", requestedSourceBatchId)
      .eq("fund_name", fundName)
      .maybeSingle();

    if (requestedBatchError) {
      throw new Error(
        `Unable to verify the requested source batch: ${requestedBatchError.message}`
      );
    }

    if (
      !requestedBatch ||
      requestedBatch.processing_status !== "Completed" ||
      toNumber(requestedBatch.total_rows) <= 0
    ) {
      throw new Error("SOURCE_BATCH_NOT_AVAILABLE");
    }

    return String(requestedBatch.id);
  }

  const {
    data: latestBatch,
    error: latestBatchError,
  } = await supabase
    .from("migration_intake_batches")
    .select("id, processing_status, status, total_rows, processed_at, created_at")
    .eq("fund_name", fundName)
    .eq("processing_status", "Completed")
    .eq("intake_mode", "Canonical")
    .gt("total_rows", 0)
    .order("processed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBatchError) {
    throw new Error(
      `Unable to identify the latest completed canonical batch: ${latestBatchError.message}`
    );
  }

  if (!latestBatch?.id) {
    throw new Error("SOURCE_BATCH_NOT_AVAILABLE");
  }

  return String(latestBatch.id);
}

async function resolveAsOfDate(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  requestedAsOfDate: string
) {
  if (requestedAsOfDate) {
    if (!isIsoDate(requestedAsOfDate)) {
      throw new Error("AS_OF_DATE_INVALID");
    }

    return requestedAsOfDate;
  }

  const {
    data: latestNav,
    error: navError,
  } = await supabase
    .from("fund_nav_snapshots")
    .select("reporting_date")
    .eq("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .order("reporting_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (navError) {
    throw new Error(`Unable to identify the latest NAV date: ${navError.message}`);
  }

  const navDate = normalizeText(latestNav?.reporting_date);

  if (navDate && isIsoDate(navDate)) {
    return navDate;
  }

  const {
    data: latestValuation,
    error: valuationError,
  } = await supabase
    .from("portfolio_valuations")
    .select("valuation_date")
    .eq("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .order("valuation_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (valuationError) {
    throw new Error(
      `Unable to identify the latest valuation date: ${valuationError.message}`
    );
  }

  const valuationDate = normalizeText(latestValuation?.valuation_date);

  if (valuationDate && isIsoDate(valuationDate)) {
    return valuationDate;
  }

  throw new Error("AS_OF_DATE_NOT_AVAILABLE");
}

async function calculateMetrics(input: {
  supabase: SupabaseAdmin;
  fundName: string;
  sourceBatchId: string;
  asOfDate: string;
  settings: CalculationSettings;
  actor: AuthorisedUser;
  calculationRunId: string;
}) {
  const {
    supabase,
    fundName,
    sourceBatchId,
    asOfDate,
    settings,
    calculationRunId,
  } = input;

  const allowedStatuses = new Set(
    (settings.include_cashflow_statuses || ["Confirmed", "Received", "Paid"])
      .map(normalizeIdentity)
      .filter(Boolean)
  );

  const [
    portfolioMasterData,
    portfolioCashflowData,
    portfolioValuationData,
    commitmentData,
    investorMasterData,
    investorCashflowData,
    distributionEventData,
    distributionAllocationData,
    navData,
  ] = await Promise.all([
    fetchAllRows(supabase, {
      table: "portfolio_investments",
      columns:
        "portfolio_code, portfolio_company, instrument_code, instrument_type, investment_date, migration_status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
      ],
      order: { column: "portfolio_code", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "portfolio_cashflows",
      columns:
        "cashflow_code, portfolio_code, portfolio_company, instrument_code, instrument_type, cashflow_date, cashflow_type, cashflow_direction, gross_amount, net_amount, currency, status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "cashflow_date", value: asOfDate },
      ],
      order: { column: "cashflow_date", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "portfolio_valuations",
      columns:
        "valuation_code, portfolio_code, portfolio_company, instrument_code, instrument_type, valuation_date, currency, investment_cost, fair_value, realised_value_to_date, valuation_status, is_final, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "valuation_date", value: asOfDate },
      ],
      order: { column: "valuation_date", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "fund_commitments",
      columns:
        "commitment_code, investor_code, investor_name, class_name, commitment_date, commitment_amount, commitment_status, status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
      ],
      order: { column: "investor_code", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "investor_master",
      columns: "investor_code, investor_name, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
      ],
      order: { column: "investor_code", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "investor_cashflows",
      columns:
        "cashflow_code, investor_code, investor_name, class_name, cashflow_date, cashflow_type, amount, cashflow_amount, direction, currency, status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "cashflow_date", value: asOfDate },
      ],
      order: { column: "cashflow_date", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "distributions",
      columns:
        "distribution_code, distribution_date, payment_date, distribution_amount, currency, status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "payment_date", value: asOfDate },
      ],
      order: { column: "payment_date", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "distribution_allocations",
      columns:
        "distribution_allocation_code, distribution_code, investor_code, investor_name, class_name, declaration_date, record_date, payment_date, gross_distribution, tax_withheld, other_deductions, net_distribution, currency, payment_status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "payment_date", value: asOfDate },
      ],
      order: { column: "payment_date", ascending: true },
    }),
    fetchAllRows(supabase, {
      table: "fund_nav_snapshots",
      columns:
        "nav_code, reporting_date, currency, gross_nav, net_nav, investment_fair_value, total_assets, total_liabilities, commitments, paid_in_capital, distributions_to_date, uncalled_commitment, status, source_batch_id",
      filters: [
        { operator: "eq", column: "fund_name", value: fundName },
        { operator: "eq", column: "source_batch_id", value: sourceBatchId },
        { operator: "lte", column: "reporting_date", value: asOfDate },
      ],
      order: { column: "reporting_date", ascending: true },
    }),
  ]);

  const portfolioMaster = portfolioMasterData as PortfolioMasterRow[];
  const portfolioCashflows = (portfolioCashflowData as PortfolioCashflowRow[])
    .filter((row) => includedStatus(row.status, allowedStatuses));
  const portfolioValuations = portfolioValuationData as PortfolioValuationRow[];
  const commitments = (commitmentData as CommitmentRow[]).filter((row) => {
    const status = `${normalizeIdentity(row.commitment_status)} ${normalizeIdentity(
      row.status
    )}`;
    return !status.includes("cancel") && !status.includes("void");
  });
  const investorMaster = investorMasterData as InvestorMasterRow[];
  const investorCashflows = (investorCashflowData as InvestorCashflowRow[])
    .filter((row) => includedStatus(row.status, allowedStatuses));
  const distributionEvents = (distributionEventData as DistributionEventRow[])
    .filter((row) => includedStatus(row.status, allowedStatuses));
  const distributionAllocations = (
    distributionAllocationData as DistributionAllocationRow[]
  ).filter((row) => includedStatus(row.payment_status, allowedStatuses));
  const navSnapshots = navData as FundNavRow[];

  const latestNav = latestByDate(
    navSnapshots,
    (row) => row.reporting_date
  );

  const valuationRowsByPortfolio = new Map<string, PortfolioValuationRow[]>();

  portfolioValuations.forEach((valuation) => {
    const portfolioCode = normalizeText(valuation.portfolio_code);

    if (!portfolioCode) {
      return;
    }

    const key = normalizeIdentity(portfolioCode);
    const rows = valuationRowsByPortfolio.get(key) || [];
    rows.push(valuation);
    valuationRowsByPortfolio.set(key, rows);
  });

  const latestValuationByPortfolio = new Map<string, PortfolioValuationRow>();

  valuationRowsByPortfolio.forEach((rows, key) => {
    const eligibleRows = settings.require_final_portfolio_valuations
      ? rows.filter((row) => Boolean(row.is_final))
      : rows;
    const latest = latestByDate(eligibleRows, (row) => row.valuation_date);

    if (latest) {
      latestValuationByPortfolio.set(key, latest);
    }
  });

  const masterByPortfolio = new Map<string, PortfolioMasterRow>();

  portfolioMaster.forEach((row) => {
    const key = normalizeIdentity(row.portfolio_code);

    if (key) {
      masterByPortfolio.set(key, row);
    }
  });

  const cashflowsByPortfolio = new Map<string, PortfolioCashflowRow[]>();

  portfolioCashflows.forEach((row) => {
    const key = normalizeIdentity(row.portfolio_code);

    if (!key) {
      return;
    }

    const rows = cashflowsByPortfolio.get(key) || [];
    rows.push(row);
    cashflowsByPortfolio.set(key, rows);
  });

  const portfolioKeys = new Set<string>([
    ...masterByPortfolio.keys(),
    ...cashflowsByPortfolio.keys(),
    ...latestValuationByPortfolio.keys(),
  ]);

  const portfolioMetricRows: PortfolioMetricOutput[] = [];
  const grossFundCashflows: DatedCashflow[] = [];

  let portfolioInvestmentCost = 0;
  let portfolioRealisedProceeds = 0;
  let portfolioTerminalFairValue = 0;

  for (const portfolioKey of Array.from(portfolioKeys).sort()) {
    const master = masterByPortfolio.get(portfolioKey) || null;
    const valuation = latestValuationByPortfolio.get(portfolioKey) || null;
    const cashflows = (cashflowsByPortfolio.get(portfolioKey) || [])
      .filter((row) => Boolean(row.cashflow_date))
      .sort((left, right) =>
        compareIsoDates(left.cashflow_date, right.cashflow_date)
      );

    const portfolioCode =
      normalizeText(master?.portfolio_code) ||
      normalizeText(valuation?.portfolio_code) ||
      normalizeText(cashflows[0]?.portfolio_code);

    if (!portfolioCode) {
      continue;
    }

    const actualDatedCashflows = cashflows
      .map((row) => ({
        date: normalizeText(row.cashflow_date),
        amount: signedPortfolioCashflow(row),
      }))
      .filter((row) => Boolean(row.date) && row.amount !== 0);

    const investedCapital = actualDatedCashflows
      .filter((cashflow) => cashflow.amount < 0)
      .reduce((total, cashflow) => total + Math.abs(cashflow.amount), 0);

    const realisedProceeds = actualDatedCashflows
      .filter((cashflow) => cashflow.amount > 0)
      .reduce((total, cashflow) => total + cashflow.amount, 0);

    const terminalFairValue = valuation
      ? Math.max(0, toNumber(valuation.fair_value))
      : 0;

    const xirrCashflows = [...actualDatedCashflows];

    if (terminalFairValue > 0) {
      xirrCashflows.push({ date: asOfDate, amount: terminalFairValue });
    }

    const totalValue = realisedProceeds + terminalFairValue;
    const grossMoic =
      investedCapital > 0 ? totalValue / investedCapital : null;
    const grossIrr = calculateXirr(
      xirrCashflows,
      toNumber(settings.xirr_initial_guess, 0.15),
      toNumber(settings.xirr_tolerance, 0.0000001),
      Math.max(20, Math.floor(toNumber(settings.xirr_max_iterations, 200)))
    );

    let calculationStatus: PortfolioMetricOutput["calculation_status"] =
      "Calculated";
    const notes: string[] = [];

    if (investedCapital <= 0) {
      calculationStatus = "Insufficient Data";
      notes.push("No investment outflow was available on or before the as-of date.");
    }

    if (!valuation && settings.require_final_portfolio_valuations) {
      calculationStatus = "Insufficient Data";
      notes.push("No final portfolio valuation was available on or before the as-of date.");
    }

    if (grossIrr === null) {
      notes.push("XIRR could not be calculated because the cashflows did not produce a valid root.");
    }

    const portfolioCompany =
      normalizeText(master?.portfolio_company) ||
      normalizeText(valuation?.portfolio_company) ||
      normalizeText(cashflows[0]?.portfolio_company) ||
      null;

    portfolioMetricRows.push({
      calculation_run_id: calculationRunId,
      fund_name: fundName,
      portfolio_code: portfolioCode,
      portfolio_company: portfolioCompany,
      instrument_code:
        normalizeText(master?.instrument_code) ||
        normalizeText(valuation?.instrument_code) ||
        normalizeText(cashflows[0]?.instrument_code) ||
        null,
      instrument_type:
        normalizeText(master?.instrument_type) ||
        normalizeText(valuation?.instrument_type) ||
        normalizeText(cashflows[0]?.instrument_type) ||
        null,
      as_of_date: asOfDate,
      currency:
        normalizeText(valuation?.currency) ||
        normalizeText(cashflows[0]?.currency) ||
        settings.base_currency ||
        "INR",
      invested_capital: roundNumber(investedCapital, 2),
      realised_proceeds: roundNumber(realisedProceeds, 2),
      terminal_fair_value: roundNumber(terminalFairValue, 2),
      total_value: roundNumber(totalValue, 2),
      gross_profit: roundNumber(totalValue - investedCapital, 2),
      gross_moic: nullableMetric(grossMoic),
      gross_irr: nullableMetric(grossIrr),
      cashflow_count: actualDatedCashflows.length,
      first_cashflow_date: minDate(
        actualDatedCashflows.map((cashflow) => cashflow.date)
      ),
      last_cashflow_date: maxDate(
        actualDatedCashflows.map((cashflow) => cashflow.date)
      ),
      valuation_date: normalizeText(valuation?.valuation_date) || null,
      calculation_status: calculationStatus,
      calculation_note: notes.length > 0 ? notes.join(" ") : null,
    });

    grossFundCashflows.push(...actualDatedCashflows);

    if (terminalFairValue > 0) {
      grossFundCashflows.push({ date: asOfDate, amount: terminalFairValue });
    }

    portfolioInvestmentCost += investedCapital;
    portfolioRealisedProceeds += realisedProceeds;
    portfolioTerminalFairValue += terminalFairValue;
  }

  const grossIrr = calculateXirr(
    grossFundCashflows,
    toNumber(settings.xirr_initial_guess, 0.15),
    toNumber(settings.xirr_tolerance, 0.0000001),
    Math.max(20, Math.floor(toNumber(settings.xirr_max_iterations, 200)))
  );

  const grossMoic =
    portfolioInvestmentCost > 0
      ? (portfolioRealisedProceeds + portfolioTerminalFairValue) /
        portfolioInvestmentCost
      : null;

  const investorNameByCode = new Map<string, string>();

  investorMaster.forEach((row) => {
    const key = normalizeIdentity(row.investor_code);

    if (key) {
      investorNameByCode.set(key, normalizeText(row.investor_name));
    }
  });

  const commitmentsByInvestor = new Map<
    string,
    {
      investorCode: string;
      investorName: string;
      className: string;
      commitmentAmount: number;
    }
  >();

  commitments.forEach((row) => {
    const investorCode = normalizeText(row.investor_code);
    const key = normalizeIdentity(investorCode);

    if (!key) {
      return;
    }

    const current = commitmentsByInvestor.get(key) || {
      investorCode,
      investorName:
        normalizeText(row.investor_name) ||
        investorNameByCode.get(key) ||
        investorCode,
      className: normalizeText(row.class_name),
      commitmentAmount: 0,
    };

    current.commitmentAmount += Math.max(0, toNumber(row.commitment_amount));

    if (!current.investorName) {
      current.investorName =
        normalizeText(row.investor_name) ||
        investorNameByCode.get(key) ||
        investorCode;
    }

    if (!current.className) {
      current.className = normalizeText(row.class_name);
    }

    commitmentsByInvestor.set(key, current);
  });

  const cashflowsByInvestor = new Map<string, InvestorCashflowRow[]>();

  investorCashflows.forEach((row) => {
    const key = normalizeIdentity(row.investor_code);

    if (!key) {
      return;
    }

    const rows = cashflowsByInvestor.get(key) || [];
    rows.push(row);
    cashflowsByInvestor.set(key, rows);
  });

  const distributionAllocationsByInvestor = new Map<
    string,
    DistributionAllocationRow[]
  >();

  distributionAllocations.forEach((row) => {
    const key = normalizeIdentity(row.investor_code);

    if (!key) {
      return;
    }

    const rows = distributionAllocationsByInvestor.get(key) || [];
    rows.push(row);
    distributionAllocationsByInvestor.set(key, rows);
  });

  const investorKeys = new Set<string>([
    ...investorNameByCode.keys(),
    ...commitmentsByInvestor.keys(),
    ...cashflowsByInvestor.keys(),
    ...distributionAllocationsByInvestor.keys(),
  ]);

  const investorInterim = Array.from(investorKeys)
    .sort()
    .map((key) => {
      const commitment = commitmentsByInvestor.get(key) || null;
      const cashflows = (cashflowsByInvestor.get(key) || [])
        .filter((row) => Boolean(row.cashflow_date))
        .sort((left, right) =>
          compareIsoDates(left.cashflow_date, right.cashflow_date)
        );
      const allocations = (distributionAllocationsByInvestor.get(key) || [])
        .filter((row) => Boolean(distributionPaymentDate(row)))
        .sort((left, right) =>
          compareIsoDates(
            distributionPaymentDate(left),
            distributionPaymentDate(right)
          )
        );

      const sourceDatedCashflows = cashflows
        .map((row) => ({
          date: normalizeText(row.cashflow_date),
          amount: signedInvestorCashflow(row),
          isDistribution: isInvestorDistributionCashflow(row),
        }))
        .filter((row) => Boolean(row.date) && row.amount !== 0);

      const contributionAndOtherCashflows = sourceDatedCashflows
        .filter((row) => row.amount < 0 || !row.isDistribution)
        .map(({ date, amount }) => ({ date, amount }));

      const netDistributionCashflowsFromLedger = sourceDatedCashflows
        .filter((row) => row.amount > 0 && row.isDistribution)
        .map(({ date, amount }) => ({ date, amount }));

      const allocationDistributionCashflows = allocations
        .map((row) => {
          const date = distributionPaymentDate(row);
          const grossDistribution = Math.max(
            0,
            toNumber(row.gross_distribution)
          );
          const withholdingTax = Math.max(0, toNumber(row.tax_withheld));
          const otherDeductions = Math.max(0, toNumber(row.other_deductions));
          const uploadedNetDistribution = Math.max(
            0,
            toNumber(row.net_distribution)
          );
          const derivedNetDistribution = Math.max(
            0,
            grossDistribution - withholdingTax - otherDeductions
          );
          const netDistribution =
            uploadedNetDistribution > 0
              ? uploadedNetDistribution
              : derivedNetDistribution;

          return {
            date,
            grossDistribution,
            withholdingTax,
            otherDeductions,
            netDistribution,
          };
        })
        .filter((row) => Boolean(row.date));

      const grossDistributions = allocationDistributionCashflows.reduce(
        (total, row) => total + row.grossDistribution,
        0
      );
      const withholdingTax = allocationDistributionCashflows.reduce(
        (total, row) => total + row.withholdingTax,
        0
      );
      const otherDistributionDeductions = allocationDistributionCashflows.reduce(
        (total, row) => total + row.otherDeductions,
        0
      );
      const uploadedNetDistributions = allocationDistributionCashflows.reduce(
        (total, row) => total + row.netDistribution,
        0
      );
      const ledgerNetDistributions = netDistributionCashflowsFromLedger.reduce(
        (total, row) => total + row.amount,
        0
      );
      const netDistributions =
        allocationDistributionCashflows.length > 0
          ? uploadedNetDistributions
          : ledgerNetDistributions;
      const effectiveGrossDistributions =
        allocationDistributionCashflows.length > 0
          ? grossDistributions
          : ledgerNetDistributions;
      const effectiveWithholdingTax =
        allocationDistributionCashflows.length > 0 ? withholdingTax : 0;

      const distributionCashflowsForPerformance: DatedCashflow[] =
        allocationDistributionCashflows.length > 0
          ? allocationDistributionCashflows
              .map((row) => ({
                date: row.date,
                amount:
                  settings.performance_distribution_basis ===
                  "Gross Distribution"
                    ? row.grossDistribution
                    : row.netDistribution,
              }))
              .filter((row) => row.amount !== 0)
          : netDistributionCashflowsFromLedger;

      const performanceDatedCashflows = [
        ...contributionAndOtherCashflows,
        ...distributionCashflowsForPerformance,
      ].sort((left, right) => compareIsoDates(left.date, right.date));

      const paidInCapital = sourceDatedCashflows
        .filter((cashflow) => cashflow.amount < 0)
        .reduce((total, cashflow) => total + Math.abs(cashflow.amount), 0);
      const performanceDistributions =
        settings.performance_distribution_basis === "Gross Distribution"
          ? effectiveGrossDistributions
          : netDistributions;
      const investorCode =
        commitment?.investorCode ||
        normalizeText(cashflows[0]?.investor_code) ||
        normalizeText(allocations[0]?.investor_code) ||
        key;

      return {
        key,
        investorCode,
        investorName:
          commitment?.investorName ||
          normalizeText(cashflows[0]?.investor_name) ||
          normalizeText(allocations[0]?.investor_name) ||
          investorNameByCode.get(key) ||
          investorCode,
        className:
          commitment?.className ||
          normalizeText(cashflows[0]?.class_name) ||
          normalizeText(allocations[0]?.class_name),
        commitmentAmount: commitment?.commitmentAmount || 0,
        performanceDatedCashflows,
        paidInCapital,
        grossDistributions: effectiveGrossDistributions,
        withholdingTax: effectiveWithholdingTax,
        otherDistributionDeductions,
        netDistributions,
        performanceDistributions,
        distributionAllocationCount: allocations.length,
        ledgerDistributionCashflowCount:
          netDistributionCashflowsFromLedger.length,
      };
    });

  const totalPaidInCapital = investorInterim.reduce(
    (total, investor) => total + investor.paidInCapital,
    0
  );
  const totalCommitments = investorInterim.reduce(
    (total, investor) => total + investor.commitmentAmount,
    0
  );
  const totalGrossDistributions = investorInterim.reduce(
    (total, investor) => total + investor.grossDistributions,
    0
  );
  const totalWithholdingTax = investorInterim.reduce(
    (total, investor) => total + investor.withholdingTax,
    0
  );
  const totalOtherDistributionDeductions = investorInterim.reduce(
    (total, investor) => total + investor.otherDistributionDeductions,
    0
  );
  const totalNetDistributions = investorInterim.reduce(
    (total, investor) => total + investor.netDistributions,
    0
  );
  const totalDistributions = investorInterim.reduce(
    (total, investor) => total + investor.performanceDistributions,
    0
  );
  const latestNetNav = latestNav ? toNumber(latestNav.net_nav) : 0;
  const latestGrossNav = latestNav ? toNumber(latestNav.gross_nav) : 0;

  const netFundCashflows = investorInterim.flatMap(
    (investor) => investor.performanceDatedCashflows
  );

  if (latestNetNav > 0) {
    netFundCashflows.push({ date: asOfDate, amount: latestNetNav });
  }

  const netIrr = calculateXirr(
    netFundCashflows,
    toNumber(settings.xirr_initial_guess, 0.15),
    toNumber(settings.xirr_tolerance, 0.0000001),
    Math.max(20, Math.floor(toNumber(settings.xirr_max_iterations, 200)))
  );

  const investorMetricRows: InvestorMetricOutput[] = investorInterim.map(
    (investor) => {
      let allocationPercentage = 0;

      if (
        settings.nav_allocation_method === "Commitment Pro Rata" &&
        totalCommitments > 0
      ) {
        allocationPercentage = investor.commitmentAmount / totalCommitments;
      } else if (totalPaidInCapital > 0) {
        allocationPercentage = investor.paidInCapital / totalPaidInCapital;
      }

      const allocatedNav = latestNetNav * allocationPercentage;
      const investorXirrCashflows = [
        ...investor.performanceDatedCashflows,
      ];

      if (allocatedNav > 0) {
        investorXirrCashflows.push({ date: asOfDate, amount: allocatedNav });
      }

      const investorNetIrr = calculateXirr(
        investorXirrCashflows,
        toNumber(settings.xirr_initial_guess, 0.15),
        toNumber(settings.xirr_tolerance, 0.0000001),
        Math.max(20, Math.floor(toNumber(settings.xirr_max_iterations, 200)))
      );
      const dpi =
        investor.paidInCapital > 0
          ? investor.performanceDistributions / investor.paidInCapital
          : null;
      const rvpi =
        investor.paidInCapital > 0
          ? allocatedNav / investor.paidInCapital
          : null;
      const tvpi =
        investor.paidInCapital > 0
          ? (investor.performanceDistributions + allocatedNav) /
            investor.paidInCapital
          : null;
      const notes: string[] = [];
      let calculationStatus: InvestorMetricOutput["calculation_status"] =
        "Calculated";

      if (investor.paidInCapital <= 0) {
        calculationStatus = "Insufficient Data";
        notes.push("No paid-in capital cashflow was available.");
      }

      if (!latestNav) {
        calculationStatus = "Insufficient Data";
        notes.push("No fund NAV snapshot was available on or before the as-of date.");
      }

      if (investorNetIrr === null) {
        notes.push("Investor XIRR could not be calculated from the available cashflows.");
      }

      return {
        calculation_run_id: calculationRunId,
        fund_name: fundName,
        investor_code: investor.investorCode,
        investor_name: investor.investorName || null,
        class_name: investor.className || null,
        as_of_date: asOfDate,
        currency: normalizeText(latestNav?.currency) || settings.base_currency || "INR",
        commitment_amount: roundNumber(investor.commitmentAmount, 2),
        paid_in_capital: roundNumber(investor.paidInCapital, 2),
        total_distributions: roundNumber(
          investor.performanceDistributions,
          2
        ),
        gross_distributions: roundNumber(investor.grossDistributions, 2),
        withholding_tax: roundNumber(investor.withholdingTax, 2),
        net_distributions: roundNumber(investor.netDistributions, 2),
        performance_distribution_basis:
          settings.performance_distribution_basis,
        uncalled_commitment: roundNumber(
          Math.max(0, investor.commitmentAmount - investor.paidInCapital),
          2
        ),
        nav_allocation_percentage: roundNumber(allocationPercentage, 12),
        allocated_nav: roundNumber(allocatedNav, 2),
        dpi: nullableMetric(dpi),
        rvpi: nullableMetric(rvpi),
        tvpi: nullableMetric(tvpi),
        net_irr: nullableMetric(investorNetIrr),
        cashflow_count: investor.performanceDatedCashflows.length,
        nav_allocation_method: settings.nav_allocation_method,
        calculation_status: calculationStatus,
        calculation_note: notes.length > 0 ? notes.join(" ") : null,
      };
    }
  );

  const calculatedUncalledCommitment = Math.max(
    0,
    totalCommitments - totalPaidInCapital
  );
  const dpi =
    totalPaidInCapital > 0 ? totalDistributions / totalPaidInCapital : null;
  const rvpi =
    totalPaidInCapital > 0 ? latestNetNav / totalPaidInCapital : null;
  const tvpi =
    totalPaidInCapital > 0
      ? (totalDistributions + latestNetNav) / totalPaidInCapital
      : null;
  const sourceValuationDate = maxDate(
    Array.from(latestValuationByPortfolio.values()).map(
      (valuation) => valuation.valuation_date
    )
  );

  const fundCalculationNotes: string[] = [];

  if (!latestNav) {
    fundCalculationNotes.push(
      "No fund NAV snapshot was available on or before the as-of date."
    );
  }

  if (grossIrr === null) {
    fundCalculationNotes.push(
      "Gross XIRR could not be calculated from the available portfolio cashflows."
    );
  }

  if (netIrr === null) {
    fundCalculationNotes.push(
      "Net XIRR could not be calculated from the available investor cashflows and NAV."
    );
  }

  const fundMetricRow = {
    calculation_run_id: calculationRunId,
    fund_name: fundName,
    as_of_date: asOfDate,
    currency: normalizeText(latestNav?.currency) || settings.base_currency || "INR",
    total_commitments: roundNumber(totalCommitments, 2),
    paid_in_capital: roundNumber(totalPaidInCapital, 2),
    total_distributions: roundNumber(totalDistributions, 2),
    gross_distributions: roundNumber(totalGrossDistributions, 2),
    withholding_tax: roundNumber(totalWithholdingTax, 2),
    net_distributions: roundNumber(totalNetDistributions, 2),
    performance_distribution_basis:
      settings.performance_distribution_basis,
    uncalled_commitment: roundNumber(calculatedUncalledCommitment, 2),
    latest_gross_nav: roundNumber(latestGrossNav, 2),
    latest_net_nav: roundNumber(latestNetNav, 2),
    portfolio_investment_cost: roundNumber(portfolioInvestmentCost, 2),
    portfolio_realised_proceeds: roundNumber(portfolioRealisedProceeds, 2),
    portfolio_terminal_fair_value: roundNumber(portfolioTerminalFairValue, 2),
    gross_irr: nullableMetric(grossIrr),
    net_irr: nullableMetric(netIrr),
    gross_moic: nullableMetric(grossMoic),
    dpi: nullableMetric(dpi),
    rvpi: nullableMetric(rvpi),
    tvpi: nullableMetric(tvpi),
    source_nav_date: normalizeText(latestNav?.reporting_date) || null,
    source_valuation_date: sourceValuationDate,
    portfolio_count: portfolioMetricRows.length,
    investor_count: investorMetricRows.length,
    calculation_status:
      latestNav && totalPaidInCapital > 0
        ? "Calculated"
        : "Insufficient Data",
    calculation_note:
      fundCalculationNotes.length > 0
        ? fundCalculationNotes.join(" ")
        : null,
  };

  const amountTolerance = toNumber(
    settings.reconciliation_amount_tolerance,
    1
  );
  const percentageTolerance = toNumber(
    settings.reconciliation_percentage_tolerance,
    0.01
  );
  const allocatedInvestorNav = investorMetricRows.reduce(
    (total, investor) => total + investor.allocated_nav,
    0
  );

  const reconciliations = [
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Fund NAV",
      metricName: "Total Commitments",
      sourceValue: latestNav ? toNumber(latestNav.commitments) : null,
      calculatedValue: totalCommitments,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: "fund_commitments.commitment_amount",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Fund NAV",
      metricName: "Paid-in Capital",
      sourceValue: latestNav ? toNumber(latestNav.paid_in_capital) : null,
      calculatedValue: totalPaidInCapital,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: "investor_cashflows contribution outflows",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Fund NAV",
      metricName:
        settings.nav_distribution_basis === "Gross Distribution"
          ? "Gross Distributions to Date"
          : "Net Distributions to Date",
      sourceValue: latestNav ? toNumber(latestNav.distributions_to_date) : null,
      calculatedValue:
        settings.nav_distribution_basis === "Gross Distribution"
          ? totalGrossDistributions
          : totalNetDistributions,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference:
        settings.nav_distribution_basis === "Gross Distribution"
          ? "distribution_allocations.gross_distribution"
          : "distribution_allocations.net_distribution",
      details: {
        navDistributionBasis: settings.nav_distribution_basis,
      },
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Distribution",
      metricName: "Gross Distribution Event to Allocation",
      sourceValue: distributionEvents.reduce(
        (total, row) => total + Math.max(0, toNumber(row.distribution_amount)),
        0
      ),
      calculatedValue: totalGrossDistributions,
      amountTolerance,
      percentageTolerance,
      sourceReference: "distributions.distribution_amount",
      calculationReference: "distribution_allocations.gross_distribution",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Distribution",
      metricName: "Net Distribution Cashflow",
      sourceValue: investorCashflows
        .filter((row) => isInvestorDistributionCashflow(row))
        .reduce(
          (total, row) =>
            total + Math.max(0, signedInvestorCashflow(row)),
          0
        ),
      calculatedValue: totalNetDistributions,
      amountTolerance,
      percentageTolerance,
      sourceReference: "investor_cashflows distribution inflows",
      calculationReference: "distribution_allocations.net_distribution",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Distribution",
      metricName: "Withholding Tax Arithmetic",
      sourceValue: totalWithholdingTax + totalOtherDistributionDeductions,
      calculatedValue: Math.max(
        0,
        totalGrossDistributions - totalNetDistributions
      ),
      amountTolerance,
      percentageTolerance,
      sourceReference:
        "distribution_allocations.tax_withheld plus other_deductions",
      calculationReference:
        "gross_distribution less net_distribution",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Fund NAV",
      metricName: "Uncalled Commitment",
      sourceValue: latestNav ? toNumber(latestNav.uncalled_commitment) : null,
      calculatedValue: calculatedUncalledCommitment,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: "Total commitments less paid-in capital",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Portfolio Valuation",
      metricName: "Investment Fair Value",
      sourceValue: latestNav ? toNumber(latestNav.investment_fair_value) : null,
      calculatedValue: portfolioTerminalFairValue,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: "Latest final portfolio valuations",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Fund NAV",
      metricName: "Net NAV Arithmetic",
      sourceValue: latestNav ? toNumber(latestNav.net_nav) : null,
      calculatedValue: latestNav
        ? toNumber(latestNav.total_assets) - toNumber(latestNav.total_liabilities)
        : null,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: "Total assets less total liabilities",
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Investor Allocation",
      metricName: "Allocated Investor NAV",
      sourceValue: latestNav ? toNumber(latestNav.net_nav) : null,
      calculatedValue: allocatedInvestorNav,
      amountTolerance,
      percentageTolerance,
      sourceReference: latestNav?.nav_code || "Latest fund NAV snapshot",
      calculationReference: settings.nav_allocation_method,
    }),
    makeReconciliation({
      calculationRunId,
      fundName,
      asOfDate,
      reconciliationType: "Portfolio Coverage",
      metricName: "Portfolio Valuation Coverage",
      sourceValue: portfolioMetricRows.length,
      calculatedValue: latestValuationByPortfolio.size,
      amountTolerance: 0,
      percentageTolerance: 0,
      sourceReference: "Portfolio master and cashflow universe",
      calculationReference: "Latest eligible portfolio valuations",
      details: {
        requireFinalValuations: settings.require_final_portfolio_valuations,
      },
    }),
  ];

  const sourceBatchIds = [sourceBatchId];

  const inputSummary = {
    sourceBatchId,
    portfolioMasterRows: portfolioMaster.length,
    portfolioCashflowRows: portfolioCashflows.length,
    portfolioValuationRows: portfolioValuations.length,
    eligibleLatestValuations: latestValuationByPortfolio.size,
    commitmentRows: commitments.length,
    investorMasterRows: investorMaster.length,
    investorCashflowRows: investorCashflows.length,
    distributionEventRows: distributionEvents.length,
    distributionAllocationRows: distributionAllocations.length,
    performanceDistributionBasis:
      settings.performance_distribution_basis,
    navDistributionBasis: settings.nav_distribution_basis,
    grossDistributions: roundNumber(totalGrossDistributions, 2),
    withholdingTax: roundNumber(totalWithholdingTax, 2),
    otherDistributionDeductions: roundNumber(
      totalOtherDistributionDeductions,
      2
    ),
    netDistributions: roundNumber(totalNetDistributions, 2),
    navSnapshotRows: navSnapshots.length,
    latestNavDate: latestNav?.reporting_date || null,
  };

  const reconciliationSummary = reconciliations.reduce(
    (summary, reconciliation) => {
      const key = normalizeText(reconciliation.reconciliation_status);
      summary[key] = (summary[key] || 0) + 1;
      return summary;
    },
    {} as Record<string, number>
  );

  const outputSummary = {
    portfolioMetricRows: portfolioMetricRows.length,
    investorMetricRows: investorMetricRows.length,
    fundMetricRows: 1,
    reconciliationRows: reconciliations.length,
    reconciliationSummary,
    metrics: {
      grossIrr: nullableMetric(grossIrr),
      netIrr: nullableMetric(netIrr),
      grossMoic: nullableMetric(grossMoic),
      dpi: nullableMetric(dpi),
      performanceDistributionBasis:
        settings.performance_distribution_basis,
      grossDistributions: roundNumber(totalGrossDistributions, 2),
      withholdingTax: roundNumber(totalWithholdingTax, 2),
      netDistributions: roundNumber(totalNetDistributions, 2),
      rvpi: nullableMetric(rvpi),
      tvpi: nullableMetric(tvpi),
    },
  };

  return {
    sourceBatchIds,
    inputSummary,
    outputSummary,
    portfolioMetricRows,
    investorMetricRows,
    fundMetricRow,
    reconciliations,
  };
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
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName")
    );

    if (!fundName) {
      return NextResponse.json(
        { error: "Fund name is required." },
        { status: 400 }
      );
    }

    await authoriseRequest(request, supabase, fundName, "view");

    const {
      data: run,
      error: runError,
    } = await supabase
      .from("metric_calculation_runs")
      .select(
        "id, fund_name, as_of_date, calculation_version, calculation_status, nav_allocation_method, source_batch_ids, input_summary, output_summary, calculation_notes, initiated_by_name, started_at, completed_at, created_at"
      )
      .eq("fund_name", fundName)
      .eq("calculation_status", "Completed")
      .order("as_of_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      throw new Error(
        `Unable to load the latest calculation run: ${runError.message}`
      );
    }

    if (!run) {
      return NextResponse.json({ run: null });
    }

    const sourceBatchIds = Array.isArray(run.source_batch_ids)
      ? run.source_batch_ids
          .map((value: unknown) => normalizeText(value))
          .filter(Boolean)
      : [];

    let portfolioValuationQuery = supabase
      .from("portfolio_valuations")
      .select("*")
      .eq("fund_name", fundName)
      .lte("valuation_date", run.as_of_date)
      .order("valuation_date", { ascending: false });

    if (sourceBatchIds.length > 0) {
      portfolioValuationQuery = portfolioValuationQuery.in(
        "source_batch_id",
        sourceBatchIds
      );
    }

    const [
      fundMetricResult,
      portfolioMetricResult,
      investorMetricResult,
      reconciliationResult,
      portfolioValuationResult,
    ] = await Promise.all([
      supabase
        .from("calculated_fund_performance_metrics")
        .select("*")
        .eq("calculation_run_id", run.id)
        .maybeSingle(),
      supabase
        .from("portfolio_performance_metrics")
        .select("*")
        .eq("calculation_run_id", run.id)
        .order("gross_irr", { ascending: false, nullsFirst: false }),
      supabase
        .from("investor_performance_metrics")
        .select("*")
        .eq("calculation_run_id", run.id)
        .order("tvpi", { ascending: false, nullsFirst: false }),
      supabase
        .from("metric_reconciliation_results")
        .select("*")
        .eq("calculation_run_id", run.id)
        .order("reconciliation_type", { ascending: true })
        .order("metric_name", { ascending: true }),
      portfolioValuationQuery,
    ]);

    const firstError =
      fundMetricResult.error ||
      portfolioMetricResult.error ||
      investorMetricResult.error ||
      reconciliationResult.error ||
      portfolioValuationResult.error;

    if (firstError) {
      throw new Error(
        `Unable to load calculated metric outputs: ${firstError.message}`
      );
    }

    return NextResponse.json({
      run,
      fundMetric: fundMetricResult.data || null,
      portfolioMetrics: portfolioMetricResult.data || [],
      investorMetrics: investorMetricResult.data || [],
      reconciliations: reconciliationResult.data || [],
      portfolioValuations: portfolioValuationResult.data || [],
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load performance calculations.";

    console.error("Load metric calculations failed:", error);

    return NextResponse.json({ error: message }, { status: 500 });
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

  let calculationRunId = "";

  try {
    const body = (await request.json()) as {
      fundName?: string;
      sourceBatchId?: string;
      asOfDate?: string;
    };
    const fundName = normalizeText(body.fundName);
    const requestedSourceBatchId = normalizeText(body.sourceBatchId);
    const requestedAsOfDate = normalizeText(body.asOfDate);

    if (!fundName) {
      return NextResponse.json(
        { error: "Fund name is required." },
        { status: 400 }
      );
    }

    const actor = await authoriseRequest(
      request,
      supabase,
      fundName,
      "calculate"
    );
    const sourceBatchId = await resolveSourceBatchId(
      supabase,
      fundName,
      requestedSourceBatchId
    );
    const asOfDate = await resolveAsOfDate(
      supabase,
      fundName,
      sourceBatchId,
      requestedAsOfDate
    );

    const {
      data: settingsData,
      error: settingsError,
    } = await supabase
      .from("metric_calculation_settings")
      .select("*")
      .eq("fund_name", fundName)
      .eq("is_active", true)
      .maybeSingle();

    if (settingsError) {
      throw new Error(
        `Unable to load calculation settings: ${settingsError.message}`
      );
    }

    if (!settingsData) {
      throw new Error("CALCULATION_SETTINGS_NOT_FOUND");
    }

    const settings = settingsData as CalculationSettings;

    const {
      data: activeRun,
      error: activeRunError,
    } = await supabase
      .from("metric_calculation_runs")
      .select("id")
      .eq("fund_name", fundName)
      .eq("calculation_status", "Processing")
      .limit(1)
      .maybeSingle();

    if (activeRunError) {
      throw new Error(
        `Unable to check active calculations: ${activeRunError.message}`
      );
    }

    if (activeRun) {
      return NextResponse.json(
        { error: "A performance calculation is already running for this fund." },
        { status: 409 }
      );
    }

    const {
      data: run,
      error: runError,
    } = await supabase
      .from("metric_calculation_runs")
      .insert({
        fund_name: fundName,
        as_of_date: asOfDate,
        calculation_version: CALCULATION_VERSION,
        calculation_status: "Processing",
        nav_allocation_method: settings.nav_allocation_method,
        source_batch_ids: [sourceBatchId],
        input_summary: {
          sourceBatchId,
        },
        output_summary: {},
        calculation_notes: [
          "IRR values are stored as decimal rates. For example, 0.20 represents 20%.",
          "Deal XIRR uses dated portfolio cashflows plus the latest eligible fair value as a terminal inflow on the calculation as-of date.",
          "Fund Net IRR uses investor contributions and the configured distribution basis plus the latest Fund NAV as a terminal inflow.",
          `Calculation source batch: ${sourceBatchId}.`,
          `Investor NAV allocation method: ${settings.nav_allocation_method}.`,
          `Performance distribution basis: ${settings.performance_distribution_basis}.`,
          `NAV distribution reconciliation basis: ${settings.nav_distribution_basis}.`,
        ],
        initiated_by: actor.userId,
        initiated_by_name: actor.fullName,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (runError || !run) {
      throw new Error(
        runError?.message || "Unable to create a calculation run."
      );
    }

    calculationRunId = String(run.id);

    const calculation = await calculateMetrics({
      supabase,
      fundName,
      sourceBatchId,
      asOfDate,
      settings,
      actor,
      calculationRunId,
    });

    await insertRows(
      supabase,
      "portfolio_performance_metrics",
      calculation.portfolioMetricRows
    );
    await insertRows(
      supabase,
      "investor_performance_metrics",
      calculation.investorMetricRows
    );
    await insertRows(
      supabase,
      "calculated_fund_performance_metrics",
      [calculation.fundMetricRow]
    );
    await insertRows(
      supabase,
      "metric_reconciliation_results",
      calculation.reconciliations
    );

    const {
      error: completionError,
    } = await supabase
      .from("metric_calculation_runs")
      .update({
        calculation_status: "Completed",
        source_batch_ids: calculation.sourceBatchIds,
        input_summary: calculation.inputSummary,
        output_summary: calculation.outputSummary,
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", calculationRunId);

    if (completionError) {
      throw new Error(
        `Metrics were calculated, but the run could not be completed: ${completionError.message}`
      );
    }

    return NextResponse.json({
      calculationRunId,
      fundName,
      sourceBatchId,
      asOfDate,
      calculationStatus: "Completed",
      inputSummary: calculation.inputSummary,
      outputSummary: calculation.outputSummary,
      fundMetric: calculation.fundMetricRow,
      reconciliationSummary:
        calculation.outputSummary.reconciliationSummary,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Performance calculation failed.";

    if (calculationRunId) {
      await supabase
        .from("metric_calculation_runs")
        .update({
          calculation_status: "Failed",
          completed_at: new Date().toISOString(),
          error_message: message,
        })
        .eq("id", calculationRunId);
    }

    if (message === "AS_OF_DATE_INVALID") {
      return NextResponse.json(
        { error: "As-of date must use YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    if (message === "SOURCE_BATCH_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          error:
            "No completed canonical migration batch with structured data is available for this fund.",
        },
        { status: 409 }
      );
    }

    if (message === "AS_OF_DATE_NOT_AVAILABLE") {
      return NextResponse.json(
        {
          error:
            "No NAV or portfolio valuation date is available for this fund.",
        },
        { status: 409 }
      );
    }

    if (message === "CALCULATION_SETTINGS_NOT_FOUND") {
      return NextResponse.json(
        {
          error:
            "Active calculation settings were not found for this fund.",
        },
        { status: 409 }
      );
    }

    console.error("Metric calculation failed:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
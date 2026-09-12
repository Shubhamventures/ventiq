import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function getId(row: DataRow | null | undefined) {
  return normalizeText(row?.id, 120);
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
  }

  return fallback;
}

function jsonResponse(body: DataRow, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(error: string, status: number, code: string) {
  return jsonResponse({ error, code }, status);
}

function createUserScopedClient(accessToken: string) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError(
        "Please sign in before opening Portfolio Intelligence.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const activeFundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );

    if (!activeFundName) {
      return jsonError(
        "Fund name is required.",
        400,
        "FUND_NAME_REQUIRED"
      );
    }

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !userResult?.user) {
      return jsonError(
        "Your session is no longer valid.",
        401,
        "INVALID_SESSION"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    const fundResult = await userDb
      .from("funds")
      .select("id")
      .eq("name", activeFundName)
      .limit(2);

    if (fundResult.error) {
      return jsonError(
        fundResult.error.message,
        500,
        "FUND_QUERY_FAILED"
      );
    }

    const fundRows = (fundResult.data ?? []) as unknown as DataRow[];

    if (fundRows.length !== 1) {
      return jsonError(
        fundRows.length === 0
          ? `No Portfolio Intelligence fund record was found for ${activeFundName}.`
          : `Multiple Portfolio Intelligence fund records matched ${activeFundName}; refusing ambiguous fund scope.`,
        fundRows.length === 0 ? 404 : 409,
        fundRows.length === 0
          ? "FUND_RECORD_NOT_FOUND"
          : "AMBIGUOUS_FUND_SCOPE"
      );
    }

    const selectedFund = fundRows[0];
    const selectedFundId = getId(selectedFund);

    if (!selectedFundId) {
      return jsonError(
        `The governed fund record for ${activeFundName} has no usable fund ID.`,
        422,
        "FUND_ID_UNUSABLE"
      );
    }

    const investmentsResult = await userDb
      .from("fund_investments")
      .select("current_fair_value,id,investment_type,original_investment_amount,portfolio_company_id,projected_gross_irr,realized_value,unrealized_value")
      .eq("fund_id", selectedFundId);

    if (investmentsResult.error) {
      return jsonError(
        investmentsResult.error.message,
        500,
        "INVESTMENTS_QUERY_FAILED"
      );
    }

    const scopedInvestments =
      (investmentsResult.data ?? []) as unknown as DataRow[];

    const selectedInvestmentIds = Array.from(
      new Set(scopedInvestments.map(getId).filter(Boolean))
    );

    const selectedCompanyIds = Array.from(
      new Set(
        scopedInvestments
          .map((investment) =>
            getString(
              investment,
              [
                "portfolio_company_id",
                "company_id",
                "investee_company_id",
              ],
              ""
            )
          )
          .filter(Boolean)
      )
    );

    const emptyResult = Promise.resolve({
      data: [] as DataRow[],
      error: null,
    });

    const [
      companiesResult,
      repaymentByInvestmentResult,
      repaymentByCompanyResult,
      companyMetricsResult,
      newsAlertsResult,
      fundMetricsResult,
    ] = await Promise.all([
      selectedCompanyIds.length > 0
        ? userDb
            .from("portfolio_companies")
            .select("id")
            .in("id", selectedCompanyIds)
        : emptyResult,

      selectedInvestmentIds.length > 0
        ? userDb
            .from("debt_repayment_schedules")
            .select("due_date,id,interest_due,investment_id,notice_status,payment_status,portfolio_company_id,principal_due,total_due")
            .in("investment_id", selectedInvestmentIds)
            .order("due_date")
        : emptyResult,

      selectedCompanyIds.length > 0
        ? userDb
            .from("debt_repayment_schedules")
            .select("due_date,id,interest_due,investment_id,notice_status,payment_status,portfolio_company_id,principal_due,total_due")
            .in("portfolio_company_id", selectedCompanyIds)
            .order("due_date")
        : emptyResult,

      selectedCompanyIds.length > 0
        ? userDb
            .from("portfolio_company_metrics")
            .select("gross_irr,id,metric_date,moic,nav_value,next_action,performance_status,portfolio_company_id,revenue_growth_percentage,runway_months")
            .in("portfolio_company_id", selectedCompanyIds)
            .order("metric_date", { ascending: false })
        : emptyResult,

      selectedCompanyIds.length > 0
        ? userDb
            .from("portfolio_news_alerts")
            .select("alert_date,alert_type,id,impact_level,portfolio_company_id,source_url,status,summary,title")
            .in("portfolio_company_id", selectedCompanyIds)
            .order("alert_date", { ascending: false })
        : emptyResult,

      userDb
        .from("fund_performance_metrics")
        .select("dpi,fund_id,gross_irr,net_irr,tvpi")
        .eq("fund_id", selectedFundId)
        .order("reporting_date", { ascending: false }),
    ]);

    const firstError =
      companiesResult.error ||
      repaymentByInvestmentResult.error ||
      repaymentByCompanyResult.error ||
      companyMetricsResult.error ||
      newsAlertsResult.error ||
      fundMetricsResult.error;

    if (firstError) {
      return jsonError(
        firstError.message,
        500,
        "PORTFOLIO_INTELLIGENCE_QUERY_FAILED"
      );
    }

    return jsonResponse({
      selectedFund,
      scopedInvestments,
      companies: companiesResult.data ?? [],
      repaymentByInvestment:
        repaymentByInvestmentResult.data ?? [],
      repaymentByCompany:
        repaymentByCompanyResult.data ?? [],
      companyMetrics: companyMetricsResult.data ?? [],
      newsAlerts: newsAlertsResult.data ?? [],
      fundMetrics: fundMetricsResult.data ?? [],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Portfolio Intelligence.",
      500,
      "PORTFOLIO_INTELLIGENCE_OVERVIEW_FAILED"
    );
  }
}

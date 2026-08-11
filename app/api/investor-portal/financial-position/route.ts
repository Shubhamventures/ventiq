import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_KEY = "investor_financials_portal";

type DataRow = Record<string, unknown>;

const INTERNAL_VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investor_relations",
  "maker",
  "checker",
]);

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function isFutureOrNoExpiry(value: unknown) {
  const text = normalizeText(value, 100);
  if (!text) return true;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function jsonResponse(body: DataRow, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(error: string, status: number, code?: string) {
  return jsonResponse(
    {
      error,
      ...(code ? { code } : {}),
    },
    status
  );
}

function unavailable(
  fundName: string,
  investorCode: string,
  reason: string,
  message: string
) {
  return jsonResponse({
    available: false,
    fund_name: fundName,
    investor_code: investorCode,
    reason,
    message,
  });
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError(
        "Please sign in before opening your financial position.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const requestedInvestorCode = normalizeText(
      request.nextUrl.searchParams.get("investorCode"),
      160
    );

    if (!fundName) {
      return jsonError("Fund name is required.", 400, "FUND_NAME_REQUIRED");
    }

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.getUser(accessToken);

    const user = userResult?.user;

    if (userError || !user) {
      return jsonError(
        "Your session is no longer valid.",
        401,
        "INVALID_SESSION"
      );
    }

    const { data: rawProfile, error: profileError } = await supabaseAdmin
      .from("ventiq_user_profiles")
      .select(
        "user_id,email,full_name,default_role,active_organisation_id,investor_id,status"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
    }

    const profile = rawProfile as unknown as DataRow | null;

    if (
      !profile ||
      normalizeText(profile.status, 40).toLowerCase() !== "active"
    ) {
      return jsonError(
        "Your VENTIQ profile is not active.",
        403,
        "PROFILE_NOT_ACTIVE"
      );
    }

    const { data: rawFundAccess, error: fundAccessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .select(
        "organisation_id,role,can_view,investor_id,status"
      )
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify governed fund access: ${fundAccessError.message}`
      );
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;

    if (!fundAccess || !Boolean(fundAccess.can_view)) {
      return jsonError(
        "The requested financial position was not found.",
        404,
        "FINANCIAL_POSITION_NOT_FOUND"
      );
    }

    const organisationId = normalizeText(fundAccess.organisation_id, 80);
    const activeOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );

    if (
      activeOrganisationId &&
      organisationId &&
      activeOrganisationId !== organisationId
    ) {
      return jsonError(
        "The requested financial position was not found.",
        404,
        "FINANCIAL_POSITION_NOT_FOUND"
      );
    }

    const governedRole =
      normalizeText(fundAccess.role, 80).toLowerCase() ||
      normalizeText(profile.default_role, 80).toLowerCase();

    if (
      governedRole !== "investor" &&
      !INTERNAL_VIEW_ROLES.has(governedRole)
    ) {
      return jsonError(
        "You do not have access to investor financial positions.",
        403,
        "ROLE_NOT_ALLOWED"
      );
    }

    // Financials can be independently activated without falsely activating
    // the whole fund. Full-fund activation remains an alternative gate.
    const [moduleResult, fullFundResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("status,readiness_score,readiness_evidence")
        .eq("organisation_id", organisationId)
        .ilike("fund_name", fundName)
        .eq("module_key", MODULE_KEY)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("fund_activation_status")
        .select("status")
        .ilike("fund_name", fundName)
        .limit(1)
        .maybeSingle(),
    ]);

    if (moduleResult.error) {
      throw new Error(
        `Unable to verify Investor Financials activation: ${moduleResult.error.message}`
      );
    }

    if (fullFundResult.error) {
      throw new Error(
        `Unable to verify full-fund activation: ${fullFundResult.error.message}`
      );
    }

    const moduleActive =
      normalizeText(
        (moduleResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    const fullFundActive =
      normalizeText(
        (fullFundResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    if (!moduleActive && !fullFundActive) {
      return unavailable(
        fundName,
        "",
        "FINANCIALS_NOT_ACTIVE",
        "Verified performance data is not available for this fund yet."
      );
    }

    let investorCode = "";
    let entitlementBasis = `ventiq_user_fund_access:${governedRole}`;

    if (governedRole === "investor") {
      const { data: entitlementData, error: entitlementError } =
        await supabaseAdmin
          .from("ventiq_user_investor_access")
          .select(
            "investor_code,status,expires_at,can_view_financials"
          )
          .eq("user_id", user.id)
          .eq("status", "Active")
          .ilike("fund_name", fundName);

      if (entitlementError) {
        throw new Error(
          `Unable to verify investor financial entitlement: ${entitlementError.message}`
        );
      }

      const eligibleEntitlements = (
        (entitlementData ?? []) as unknown as DataRow[]
      ).filter(
        (row) =>
          isFutureOrNoExpiry(row.expires_at) &&
          Boolean(row.can_view_financials) &&
          Boolean(normalizeText(row.investor_code, 160))
      );

      const entitlementCodes = Array.from(
        new Set(
          eligibleEntitlements
            .map((row) => normalizeText(row.investor_code, 160))
            .filter(Boolean)
        )
      );

      if (entitlementCodes.length === 0) {
        return jsonError(
          "The requested financial position was not found.",
          404,
          "FINANCIAL_POSITION_NOT_FOUND"
        );
      }

      // Investor-role URL investorCode is deliberately ignored.
      // Identity comes only from governed profile/fund entitlement.
      const preferredCodes = [
        normalizeText(profile.investor_id, 160),
        normalizeText(fundAccess.investor_id, 160),
      ].filter(Boolean);

      investorCode =
        preferredCodes.find((code) =>
          entitlementCodes.some(
            (entitledCode) =>
              entitledCode.toLowerCase() === code.toLowerCase()
          )
        ) ||
        (entitlementCodes.length === 1 ? entitlementCodes[0] : "");

      if (!investorCode) {
        return unavailable(
          fundName,
          "",
          "INVESTOR_CONTEXT_AMBIGUOUS",
          "Your investor account context could not be resolved."
        );
      }

      entitlementBasis = `ventiq_user_investor_access:${investorCode}:financials`;
    } else {
      investorCode = requestedInvestorCode;

      if (!investorCode) {
        return jsonError(
          "Investor code is required for internal support view.",
          400,
          "INVESTOR_CODE_REQUIRED"
        );
      }
    }

    // investor_master is canonically scoped by fund_name + investor_code.
    // It does not carry organisation_id in the current schema.
    // Organisation isolation has already been enforced above through:
    // 1) the signed-in user's active ventiq_user_fund_access row, and
    // 2) the organisation-scoped Investor Financials module activation.
    // For Investor role, investorCode is additionally derived only from the
    // user's active, non-expired can_view_financials entitlement.
    const { data: rawInvestor, error: investorError } = await supabaseAdmin
      .from("investor_master")
      .select("id,investor_code,investor_name,fund_name")
      .ilike("fund_name", fundName)
      .ilike("investor_code", investorCode)
      .limit(1)
      .maybeSingle();

    if (investorError) {
      throw new Error(
        `Unable to verify governed investor: ${investorError.message}`
      );
    }

    const investorRecord = rawInvestor as unknown as DataRow | null;

    if (!investorRecord) {
      return jsonError(
        "The requested financial position was not found.",
        404,
        "FINANCIAL_POSITION_NOT_FOUND"
      );
    }

    // Latest Completed calculation only.
    const { data: rawRun, error: runError } = await supabaseAdmin
      .from("metric_calculation_runs")
      .select(
        "id,fund_name,as_of_date,calculation_version,calculation_status,completed_at"
      )
      .eq("fund_name", fundName)
      .eq("calculation_status", "Completed")
      .order("as_of_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      throw new Error(
        `Unable to load verified calculation: ${runError.message}`
      );
    }

    const run = rawRun as unknown as DataRow | null;

    if (!run) {
      return unavailable(
        fundName,
        investorCode,
        "NO_COMPLETED_CALCULATION",
        "Verified performance data is not available for this fund yet."
      );
    }

    const calculationRunId = normalizeText(run.id, 80);

    const { data: reconciliationData, error: reconciliationError } =
      await supabaseAdmin
        .from("metric_reconciliation_results")
        .select("reconciliation_status")
        .eq("calculation_run_id", calculationRunId);

    if (reconciliationError) {
      throw new Error(
        `Unable to verify calculation reconciliation: ${reconciliationError.message}`
      );
    }

    const reconciliationRows = (
      (reconciliationData ?? []) as unknown as DataRow[]
    );

    const passedControls = reconciliationRows.filter(
      (row) =>
        normalizeText(row.reconciliation_status, 80).toLowerCase() === "pass"
    ).length;

    const allControlsPassed =
      reconciliationRows.length > 0 &&
      passedControls === reconciliationRows.length;

    if (!allControlsPassed) {
      return unavailable(
        fundName,
        investorCode,
        "CALCULATION_NOT_FULLY_RECONCILED",
        "Verified performance data is not available for this fund yet."
      );
    }

    const { data: rawMetric, error: metricError } = await supabaseAdmin
      .from("investor_performance_metrics")
      .select(
        [
          "calculation_run_id",
          "fund_name",
          "investor_code",
          "investor_name",
          "class_name",
          "as_of_date",
          "currency",
          "commitment_amount",
          "paid_in_capital",
          "total_distributions",
          "gross_distributions",
          "withholding_tax",
          "net_distributions",
          "performance_distribution_basis",
          "uncalled_commitment",
          "nav_allocation_percentage",
          "allocated_nav",
          "dpi",
          "rvpi",
          "tvpi",
          "net_irr",
          "cashflow_count",
          "nav_allocation_method",
          "calculation_status",
        ].join(",")
      )
      .eq("calculation_run_id", calculationRunId)
      .ilike("investor_code", investorCode)
      .eq("calculation_status", "Calculated")
      .limit(1)
      .maybeSingle();

    if (metricError) {
      throw new Error(
        `Unable to load verified investor metric: ${metricError.message}`
      );
    }

    const metric = rawMetric as unknown as DataRow | null;

    if (!metric) {
      return unavailable(
        fundName,
        investorCode,
        "INVESTOR_METRIC_NOT_CALCULATED",
        "Verified performance data is not available for this investor yet."
      );
    }

    // Audit before release. If audit fails, fail closed.
    const { error: auditError } = await supabaseAdmin
      .from("ventiq_investor_financial_access_events")
      .insert({
        organisation_id: organisationId,
        fund_name: fundName,
        investor_code: investorCode,
        calculation_run_id: calculationRunId,
        as_of_date: normalizeText(run.as_of_date, 40) || null,
        actor_user_id: user.id,
        actor_email:
          normalizeText(profile.email, 320) ||
          normalizeText(user.email, 320) ||
          null,
        actor_name: normalizeText(profile.full_name, 240) || null,
        actor_role: governedRole,
        entitlement_basis: entitlementBasis,
      });

    if (auditError) {
      throw new Error(
        `Investor financial data was not released because audit evidence could not be recorded: ${auditError.message}`
      );
    }

    return jsonResponse({
      available: true,
      fund_name: fundName,
      investor_code: normalizeText(metric.investor_code, 160),
      investor_name: normalizeText(metric.investor_name, 240),
      class_name: normalizeText(metric.class_name, 160) || null,
      currency: normalizeText(metric.currency, 20) || "INR",

      verification: {
        calculation_version: normalizeText(run.calculation_version, 80),
        as_of_date: normalizeText(run.as_of_date, 40),
        calculation_status: "Completed",
        reconciliation_status: "Pass",
        controls_passed: passedControls,
        controls_total: reconciliationRows.length,
      },

      financial_position: {
        commitment_amount: metric.commitment_amount ?? null,
        paid_in_capital: metric.paid_in_capital ?? null,
        total_distributions: metric.total_distributions ?? null,
        gross_distributions: metric.gross_distributions ?? null,
        withholding_tax: metric.withholding_tax ?? null,
        net_distributions: metric.net_distributions ?? null,
        performance_distribution_basis:
          normalizeText(metric.performance_distribution_basis, 120) || null,
        uncalled_commitment: metric.uncalled_commitment ?? null,
        allocated_nav: metric.allocated_nav ?? null,
        nav_allocation_percentage:
          metric.nav_allocation_percentage ?? null,
        nav_allocation_method:
          normalizeText(metric.nav_allocation_method, 160) || null,
        dpi: metric.dpi ?? null,
        rvpi: metric.rvpi ?? null,
        tvpi: metric.tvpi ?? null,
        net_irr: metric.net_irr ?? null,
        cashflow_count: metric.cashflow_count ?? null,
        calculation_status:
          normalizeText(metric.calculation_status, 80) || null,
      },
    });
  } catch (error) {
    console.error("Investor Portal financial position access failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load verified investor financial position.",
      500,
      "FINANCIAL_POSITION_LOAD_FAILED"
    );
  }
}

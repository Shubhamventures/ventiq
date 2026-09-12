import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

const ALLOWED_ROLES = new Set(["fund_admin", "investment_team"]);

const FUND_ACTIVATION_SELECT =
  "fund_name,status,activated_by";

const PORTFOLIO_INVESTMENT_SELECT =
  "id,fund_name,source_batch_id,portfolio_code,portfolio_company,sector,instrument_type,investment_date,investment_cost,current_value,realised_value,expected_exit_value,expected_exit_date,interest_rate,repayment_due_date,security_or_charge,covenants,risk_status,latest_update,created_at";

const PORTFOLIO_VALUATION_SELECT =
  "fund_name,source_batch_id,portfolio_code,valuation_date,fair_value,realised_value_to_date,expected_exit_value,expected_exit_date";

const DEBT_REPAYMENT_SCHEDULE_SELECT =
  "id,fund_name,source_batch_id,portfolio_code,portfolio_company,due_date,repayment_type,total_due";

const PDF_INTELLIGENCE_DOCUMENT_SELECT =
  "id,fund_name,status,created_at";

const FUND_MASTER_SELECT =
  "id,fund_name,source_batch_id,committed_capital,target_corpus,created_at";

const COMPLIANCE_ITEM_SELECT =
  "id,fund_name,source_batch_id,created_at,due_date,risk_level,filing_status,category,document_name,authority,remarks";

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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

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
        "Please sign in before opening the Investment Team workspace.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const sourceBatchId = normalizeText(
      request.nextUrl.searchParams.get("sourceBatchId"),
      120
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
        "user_id,default_role,active_organisation_id,status"
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

    const activeOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );

    let fundAccessQuery = supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id,role,can_view,status")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName);

    if (activeOrganisationId) {
      fundAccessQuery = fundAccessQuery.eq(
        "organisation_id",
        activeOrganisationId
      );
    }

    const { data: rawFundAccess, error: fundAccessError } =
      await fundAccessQuery.limit(1).maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify governed fund access: ${fundAccessError.message}`
      );
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;
    const role = normalizeText(fundAccess?.role, 80).toLowerCase();

    if (
      !fundAccess ||
      !Boolean(fundAccess.can_view) ||
      !ALLOWED_ROLES.has(role)
    ) {
      return jsonError(
        "The requested Investment Team workspace was not found.",
        404,
        "INVESTMENT_TEAM_WORKSPACE_NOT_FOUND"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    function createFundBatchQuery(
      tableName: string,
      selectColumns: string,
      orderBy: string,
      ascending: boolean
    ) {
      let query = userDb
        .from(tableName)
        .select(selectColumns)
        .eq("fund_name", fundName);

      if (sourceBatchId) {
        query = query.eq("source_batch_id", sourceBatchId);
      }

      return query.order(orderBy, { ascending });
    }

    let fundRowQuery = userDb
      .from("fund_master")
      .select(FUND_MASTER_SELECT)
      .eq("fund_name", fundName);

    if (sourceBatchId) {
      fundRowQuery = fundRowQuery.eq("source_batch_id", sourceBatchId);
    }

    const [
      activationResult,
      portfolioRowsResult,
      valuationRowsResult,
      repaymentRowsResult,
      pdfRowsResult,
      fundRowResult,
      complianceRowsResult,
    ] = await Promise.all([
      userDb
        .from("fund_activation_status")
        .select(FUND_ACTIVATION_SELECT)
        .eq("fund_name", fundName)
        .maybeSingle(),

      createFundBatchQuery(
        "portfolio_investments",
        PORTFOLIO_INVESTMENT_SELECT,
        "created_at",
        true
      ),
      createFundBatchQuery(
        "portfolio_valuations",
        PORTFOLIO_VALUATION_SELECT,
        "valuation_date",
        false
      ),
      createFundBatchQuery(
        "debt_repayment_schedules",
        DEBT_REPAYMENT_SCHEDULE_SELECT,
        "due_date",
        true
      ),

      userDb
        .from("pdf_intelligence_documents")
        .select(PDF_INTELLIGENCE_DOCUMENT_SELECT)
        .eq("fund_name", fundName)
        .order("created_at", { ascending: false }),

      fundRowQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      createFundBatchQuery(
        "compliance_items",
        COMPLIANCE_ITEM_SELECT,
        "created_at",
        true
      ),
    ]);

    const firstError =
      portfolioRowsResult.error ||
      valuationRowsResult.error ||
      repaymentRowsResult.error ||
      pdfRowsResult.error ||
      fundRowResult.error ||
      complianceRowsResult.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    return jsonResponse({
      activation: activationResult.error
        ? null
        : ((activationResult.data as DataRow | null) ?? null),
      portfolioRows: (portfolioRowsResult.data ?? []) as unknown as DataRow[],
      valuationRows: (valuationRowsResult.data ?? []) as unknown as DataRow[],
      repaymentRows: (repaymentRowsResult.data ?? []) as unknown as DataRow[],
      pdfRows: (pdfRowsResult.data ?? []) as DataRow[],
      fundRow: (fundRowResult.data as DataRow | null) ?? null,
      complianceRows: (complianceRowsResult.data ?? []) as unknown as DataRow[],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Investment Team workspace.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Investment Team workspace is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Investment Team overview load failed:", error);

    return jsonError(
      message,
      500,
      "INVESTMENT_TEAM_OVERVIEW_LOAD_FAILED"
    );
  }
}

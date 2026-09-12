import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

type SelectRowsOptions = {
  orderBy?: string;
  ascending?: boolean;
  eq?: {
    column: string;
    value: string;
  };
};

const ALLOWED_ROLES = new Set([
  "fund_admin",
  "managing_partner",
]);

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
        "Please sign in before opening the Managing Partner workspace.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
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

    const [profileResult, membershipResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_user_profiles")
        .select(
          "user_id,default_role,active_organisation_id,status"
        )
        .eq("user_id", user.id)
        .maybeSingle(),

      supabaseAdmin
        .from("ventiq_organisation_members")
        .select(
          "id,organisation_id,user_id,role,status,is_primary"
        )
        .eq("user_id", user.id)
        .eq("status", "Active")
        .order("is_primary", { ascending: false }),
    ]);

    if (profileResult.error) {
      throw new Error(
        `Unable to load VENTIQ profile: ${profileResult.error.message}`
      );
    }

    if (membershipResult.error) {
      throw new Error(
        `Unable to load organisation membership: ${membershipResult.error.message}`
      );
    }

    const profile =
      (profileResult.data as unknown as DataRow | null) ?? null;
    const memberships =
      (membershipResult.data ?? []) as unknown as DataRow[];

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

    const profileRole = normalizeText(
      profile.default_role,
      80
    ).toLowerCase();
    const primaryMembership =
      memberships.find((row) => Boolean(row.is_primary)) ??
      memberships[0] ??
      null;
    const membershipRole = normalizeText(
      primaryMembership?.role,
      80
    ).toLowerCase();

    // Match AuthProvider activeRole precedence exactly.
    const activeRole = profileRole || membershipRole;

    if (!ALLOWED_ROLES.has(activeRole)) {
      return jsonError(
        "The requested Managing Partner workspace was not found.",
        404,
        "MANAGING_PARTNER_WORKSPACE_NOT_FOUND"
      );
    }

    const profileOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );
    const membershipOrganisationId = normalizeText(
      primaryMembership?.organisation_id,
      80
    );
    const activeOrganisationId =
      profileOrganisationId || membershipOrganisationId;

    let fundAccessQuery = supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id,can_view,status")
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

    const fundAccess =
      (rawFundAccess as unknown as DataRow | null) ?? null;

    if (!fundAccess || !Boolean(fundAccess.can_view)) {
      return jsonError(
        "The requested Managing Partner workspace was not found.",
        404,
        "MANAGING_PARTNER_WORKSPACE_NOT_FOUND"
      );
    }

    const fundAccessOrganisationId = normalizeText(
      fundAccess.organisation_id,
      80
    );

    if (
      activeOrganisationId &&
      fundAccessOrganisationId &&
      activeOrganisationId !== fundAccessOrganisationId
    ) {
      return jsonError(
        "The requested Managing Partner workspace was not found.",
        404,
        "MANAGING_PARTNER_WORKSPACE_NOT_FOUND"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    async function selectRows(
      tableName: string,
      columns: string,
      options?: SelectRowsOptions
    ): Promise<DataRow[]> {
      try {
        let query = userDb.from(tableName).select(columns);

        if (options?.eq) {
          query = query.eq(options.eq.column, options.eq.value);
        }

        if (options?.orderBy) {
          query = query.order(options.orderBy, {
            ascending: options.ascending ?? false,
          });
        }

        const { data, error } = await query;

        if (error) {
          console.warn(
            `VENTIQ Managing Partner overview skipped ${tableName}:`,
            error.message
          );
          return [];
        }

        return (data ?? []) as unknown as DataRow[];
      } catch (error) {
        console.warn(
          `VENTIQ Managing Partner overview skipped ${tableName}:`,
          error
        );
        return [];
      }
    }

    async function loadActivationRecord(): Promise<DataRow | null> {
      try {
        const { data, error } = await userDb
          .from("fund_activation_status")
          .select("status, activated_at, activated_by, readiness_score")
          .eq("fund_name", fundName)
          .maybeSingle();

        if (error) {
          console.warn(
            "VENTIQ Managing Partner overview could not read fund activation:",
            error.message
          );
          return null;
        }

        return (data as unknown as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          "VENTIQ Managing Partner overview could not read fund activation:",
          error
        );
        return null;
      }
    }

    const [
      fundsData,
      commitmentsData,
      investorsData,
      capitalCallsData,
      distributionsData,
      documentsData,
      matchesData,
      circularsData,
      portfolioCompaniesData,
      fundInvestmentsData,
      debtRepaymentsData,
      portfolioCompanyMetricsData,
      portfolioNewsAlertsData,
      fundPerformanceMetricsData,
      dataRoomDocumentsData,
      dataRoomEngagementData,
      dataRoomQuestionsData,
      migratedInvestorMasterData,
      migratedFundCommitmentsData,
      migratedFinancialPositionsData,
      migratedFundMasterData,
      migratedPortfolioInvestmentsData,
      migratedComplianceItemsData,
      migratedPdfDocumentsData,
      activationRecord,
    ] = await Promise.all([
      selectRows("funds", "id,name"),
      selectRows("commitments", "commitment_amount,fund_id,investor_id"),
      selectRows("investors", "id"),
      selectRows("capital_calls", "call_amount,call_date,call_name,created_at,fund_id,id,status"),
      selectRows("distributions", "distribution_amount,fund_id,fund_name"),
      selectRows("investor_documents", "amount,document_name,document_type,email_status,fund_id,fund_name,generated_at,id,investor_email,investor_name,portal_status,status,storage_path,storage_url", {
        orderBy: "published_at",
        ascending: false,
      }),
      selectRows("regulatory_source_matches", "id", {
        eq: { column: "status", value: "needs_review" },
      }),
      selectRows("regulatory_circulars", "impact", {
        eq: { column: "status", value: "active" },
      }),
      selectRows("portfolio_companies", "id"),
      selectRows("fund_investments", "current_fair_value,fund_id,original_investment_amount,portfolio_company_id,realized_value,unrealized_value"),
      selectRows("debt_repayment_schedules", "fund_id,fund_name,investment_id,payment_status,portfolio_company_id", {
        orderBy: "due_date",
        ascending: true,
      }),
      selectRows("portfolio_company_metrics", "performance_status,portfolio_company_id,risk_rating", {
        orderBy: "metric_date",
        ascending: false,
      }),
      selectRows("portfolio_news_alerts", "portfolio_company_id,status", {
        orderBy: "alert_date",
        ascending: false,
      }),
      selectRows("fund_performance_metrics", "current_nav,dpi,fund_id,gross_irr,net_irr,tvpi", {
        orderBy: "reporting_date",
        ascending: false,
      }),
      selectRows("data_room_documents", "created_at,detected_type,file_name,fund_name,id,imported_at,suggested_folder", {
        orderBy: "imported_at",
        ascending: false,
      }),
      selectRows("data_room_engagement_events", "action,created_at,document_id,document_name,event_time,fund_name,id,investor_name", {
        orderBy: "event_time",
        ascending: false,
      }),
      selectRows("data_room_questions", "answered_at,asked_at,category,created_at,document_id,document_name,fund_name,id,investor_name,status", {
        orderBy: "asked_at",
        ascending: false,
      }),
      selectRows("investor_master", "batch_id,created_at,fund_name,id,updated_at", {
        orderBy: "investor_code",
        ascending: true,
      }),
      selectRows("fund_commitments", "batch_id,commitment_amount,created_at,fund_name,id,investor_id,updated_at"),
      selectRows("investor_financial_positions", "created_at,fund_name,id"),
      selectRows("fund_master", "batch_id,carry_rate,committed_capital,created_at,fund_name,id,updated_at"),
      selectRows("portfolio_investments", "batch_id,created_at,current_value,expected_exit_value,fund_name,id,investment_cost,portfolio_code,portfolio_company,realised_value,repayment_due_date,risk_status,updated_at"),
      selectRows("compliance_items", "batch_id,created_at,filing_status,fund_name,id,migration_status,risk_level,updated_at"),
      selectRows("pdf_intelligence_documents", "batch_id,created_at,fund_name,id,status,updated_at"),
      loadActivationRecord(),
    ]);

    return jsonResponse({
      fundsData,
      commitmentsData,
      investorsData,
      capitalCallsData,
      distributionsData,
      documentsData,
      matchesData,
      circularsData,
      portfolioCompaniesData,
      fundInvestmentsData,
      debtRepaymentsData,
      portfolioCompanyMetricsData,
      portfolioNewsAlertsData,
      fundPerformanceMetricsData,
      dataRoomDocumentsData,
      dataRoomEngagementData,
      dataRoomQuestionsData,
      migratedInvestorMasterData,
      migratedFundCommitmentsData,
      migratedFinancialPositionsData,
      migratedFundMasterData,
      migratedPortfolioInvestmentsData,
      migratedComplianceItemsData,
      migratedPdfDocumentsData,
      activationRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Managing Partner workspace.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Managing Partner workspace is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Managing Partner overview load failed:", error);

    return jsonError(
      message,
      500,
      "MANAGING_PARTNER_OVERVIEW_LOAD_FAILED"
    );
  }
}

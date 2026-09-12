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
  "finance_head",
  "maker",
  "checker",
]);

const SELECT_COLUMNS: Record<string, string> = {
  "capital_calls": "call_amount,call_date,call_name,created_at,id,status",
  "distributions": "created_at,distribution_amount,distribution_date,distribution_name,fund_name,id,payment_date,source_batch_id,status",
  "investor_documents": "document_name,document_type,email_status,file_name,file_url,fund_name,generated_at,id,investor_name,migration_status,portal_status,published_at,status,storage_path,storage_url,uploaded_at",
  "regulatory_source_matches": "created_at,id",
  "regulatory_circulars": "impact",
  "investor_master": "batch_id,created_at,fund_name,id,source_batch_id,updated_at",
  "fund_commitments": "batch_id,commitment_amount,created_at,fund_name,id,source_batch_id,updated_at",
  "investor_financial_positions": "capital_called,capital_called_till_date,commitment_amount,created_at,current_nav,distributions,distributions_till_date,fund_name,id,nav,uncalled_capital",
  "investor_cashflows": "fund_name,source_batch_id",
  "fund_master": "batch_id,carry_rate,committed_capital,created_at,fund_name,id,management_fee_rate,source_batch_id,sponsor_commitment,updated_at",
  "portfolio_investments": "batch_id,created_at,current_value,fund_name,id,portfolio_company,repayment_due_date,risk_status,source_batch_id,updated_at",
  "debt_repayment_schedules": "created_at,due_date,fund_name,id,portfolio_company,repayment_type,source_batch_id,total_due",
  "compliance_items": "authority,batch_id,created_at,document_name,due_date,evidence_available,filing_status,fund_name,id,migration_status,owner,risk_level,source_batch_id,updated_at",
  "pdf_intelligence_documents": "batch_id,created_at,fund_name,id,status,updated_at",
  "capital_call_allocation_batches": "created_at,exception_count,fund_name,id,updated_at",
};
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
        "Please sign in before opening the Finance Head workspace.",
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
        .select("user_id,default_role,active_organisation_id,status")
        .eq("user_id", user.id)
        .maybeSingle(),

      supabaseAdmin
        .from("ventiq_organisation_members")
        .select("id,organisation_id,user_id,role,status,is_primary")
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
        "The requested Finance Head workspace was not found.",
        404,
        "FINANCE_HEAD_WORKSPACE_NOT_FOUND"
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
        "The requested Finance Head workspace was not found.",
        404,
        "FINANCE_HEAD_WORKSPACE_NOT_FOUND"
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
        "The requested Finance Head workspace was not found.",
        404,
        "FINANCE_HEAD_WORKSPACE_NOT_FOUND"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    async function selectRows(
      tableName: string,
      options?: SelectRowsOptions
    ): Promise<DataRow[]> {
      try {
        const selectColumns = SELECT_COLUMNS[tableName];

        if (!selectColumns) {
          console.warn(
            `VENTIQ Finance Head overview has no explicit projection for ${tableName}.`
          );
          return [];
        }

        let query = userDb.from(tableName).select(selectColumns);

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
            `VENTIQ Finance Head overview skipped ${tableName}:`,
            error.message
          );
          return [];
        }

        return (data ?? []) as unknown as DataRow[];
      } catch (error) {
        console.warn(
          `VENTIQ Finance Head overview skipped ${tableName}:`,
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
            "VENTIQ Finance Head overview could not read fund activation:",
            error.message
          );
          return null;
        }

        return (data as unknown as DataRow | null) ?? null;
      } catch (error) {
        console.warn(
          "VENTIQ Finance Head overview could not read fund activation:",
          error
        );
        return null;
      }
    }

    const [
      capitalCallsData,
      distributionsData,
      documentsData,
      matchesData,
      circularsData,
      migratedInvestorMasterData,
      migratedFundCommitmentsData,
      migratedFinancialPositionsData,
      migratedInvestorCashflowsData,
      migratedFundMasterData,
      migratedPortfolioInvestmentsData,
      migratedDebtRepaymentSchedulesData,
      migratedComplianceItemsData,
      migratedPdfDocumentsData,
      allocationBatchRows,
      activationRecord,
    ] = await Promise.all([
      selectRows("capital_calls", {
        orderBy: "created_at",
        ascending: false,
      }),
      selectRows("distributions", {
        orderBy: "created_at",
        ascending: false,
      }),
      selectRows("investor_documents"),
      selectRows("regulatory_source_matches", {
        eq: {
          column: "status",
          value: "needs_review",
        },
      }),
      selectRows("regulatory_circulars", {
        eq: {
          column: "status",
          value: "active",
        },
      }),
      selectRows("investor_master", {
        orderBy: "investor_code",
        ascending: true,
      }),
      selectRows("fund_commitments"),
      selectRows("investor_financial_positions"),
      selectRows("investor_cashflows", {
        orderBy: "cashflow_date",
        ascending: false,
      }),
      selectRows("fund_master"),
      selectRows("portfolio_investments"),
      selectRows("debt_repayment_schedules", {
        orderBy: "due_date",
        ascending: true,
      }),
      selectRows("compliance_items"),
      selectRows("pdf_intelligence_documents"),
      selectRows("capital_call_allocation_batches", {
        orderBy: "created_at",
        ascending: false,
      }),
      loadActivationRecord(),
    ]);

    return jsonResponse({
      capitalCallsData,
      distributionsData,
      documentsData,
      matchesData,
      circularsData,
      migratedInvestorMasterData,
      migratedFundCommitmentsData,
      migratedFinancialPositionsData,
      migratedInvestorCashflowsData,
      migratedFundMasterData,
      migratedPortfolioInvestmentsData,
      migratedDebtRepaymentSchedulesData,
      migratedComplianceItemsData,
      migratedPdfDocumentsData,
      allocationBatchRows,
      activationRecord,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Finance Head workspace.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Finance Head workspace is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Finance Head overview load failed:", error);

    return jsonError(
      message,
      500,
      "FINANCE_HEAD_OVERVIEW_LOAD_FAILED"
    );
  }
}

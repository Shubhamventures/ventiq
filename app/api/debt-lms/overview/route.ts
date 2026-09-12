import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

const ALLOWED_ROLES = new Set([
  "fund_admin",
  "finance_head",
  "investment_team",
  "maker",
  "checker",
]);

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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
        "Please sign in before opening the Debt LMS workspace.",
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
        "The requested Debt LMS workspace was not found.",
        404,
        "DEBT_LMS_WORKSPACE_NOT_FOUND"
      );
    }

    if (activeRole !== "fund_admin") {
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
          "The requested Debt LMS workspace was not found.",
          404,
          "DEBT_LMS_WORKSPACE_NOT_FOUND"
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
          "The requested Debt LMS workspace was not found.",
          404,
          "DEBT_LMS_WORKSPACE_NOT_FOUND"
        );
      }
    }

    const userDb = createUserScopedClient(accessToken);

    const loanResult = await userDb
      .from("debt_lms_loans")
      .select("id,borrower_name,fund_name,instrument_type,sanction_amount,disbursed_amount,disbursement_date,tenure_months,coupon_rate,interest_frequency,principal_frequency,principal_repayment_type,moratorium_months,moratorium_start_basis,repayment_start_date,maturity_date,processing_fee,exit_fee,penal_interest_rate,security_details,charge_details,risk_status,loan_status,next_due_date,next_due_amount,overdue_amount")
      .eq("fund_name", fundName)
      .order("created_at", { ascending: false });

    if (loanResult.error) {
      throw new Error(loanResult.error.message);
    }

    const loanRows =
      (loanResult.data ?? []) as unknown as DataRow[];

    const activeLoanIds = loanRows
      .map((row) => normalizeText(row.id, 80))
      .filter(isUuid);

    if (activeLoanIds.length === 0) {
      return jsonResponse({
        loanRows,
        repaymentRows: [],
        covenantRows: [],
        securityRows: [],
        noticeRows: [],
        bankMatchRows: [],
      });
    }

    const [
      repaymentResult,
      covenantResult,
      securityResult,
      noticeResult,
      bankMatchResult,
    ] = await Promise.all([
      userDb
        .from("debt_lms_repayment_schedule")
        .select("total_due,principal_received,interest_received,fees_received,penalty_received,other_received,amount_received,pending_amount,id,loan_id,borrower_name,due_date,opening_principal,principal_due,interest_due,fees_due,penalty_due,collection_status,days_past_due")
        .in("loan_id", activeLoanIds)
        .order("due_date", { ascending: true }),

      userDb
        .from("debt_lms_covenants")
        .select("id,loan_id,borrower_name,covenant_name,covenant_type,frequency,due_date,covenant_status,evidence_required,evidence_storage_path")
        .in("loan_id", activeLoanIds)
        .order("due_date", { ascending: true }),

      userDb
        .from("debt_lms_security_tracker")
        .select("id,loan_id,borrower_name,security_type,security_description,charge_creation_due_date,charge_creation_status,roc_filing_due_date,roc_filing_status,trustee_document_status,evidence_storage_path,charge_creation_required,roc_filing_required,trustee_document_required")
        .in("loan_id", activeLoanIds)
        .order("charge_creation_due_date", { ascending: true }),

      userDb
        .from("debt_lms_notices")
        .select("id,loan_id,repayment_schedule_id,borrower_name,notice_type,due_date,total_due,penalty_due,principal_due,recipient_email,notice_status,pdf_file_name")
        .in("loan_id", activeLoanIds)
        .order("created_at", { ascending: false }),

      userDb
        .from("debt_lms_bank_matches")
        .select("id,loan_id,repayment_schedule_id,borrower_name,expected_amount,received_amount,bank_narration,match_status,action_required")
        .in("loan_id", activeLoanIds)
        .order("created_at", { ascending: false }),
    ]);

    if (repaymentResult.error) {
      throw new Error(repaymentResult.error.message);
    }

    if (covenantResult.error) {
      throw new Error(covenantResult.error.message);
    }

    if (securityResult.error) {
      throw new Error(securityResult.error.message);
    }

    if (noticeResult.error) {
      throw new Error(noticeResult.error.message);
    }

    if (bankMatchResult.error) {
      throw new Error(bankMatchResult.error.message);
    }

    return jsonResponse({
      loanRows,
      repaymentRows:
        (repaymentResult.data ?? []) as unknown as DataRow[],
      covenantRows:
        (covenantResult.data ?? []) as unknown as DataRow[],
      securityRows:
        (securityResult.data ?? []) as unknown as DataRow[],
      noticeRows:
        (noticeResult.data ?? []) as unknown as DataRow[],
      bankMatchRows:
        (bankMatchResult.data ?? []) as unknown as DataRow[],
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load Debt LMS workspace.",
      500,
      "DEBT_LMS_OVERVIEW_FAILED"
    );
  }
}

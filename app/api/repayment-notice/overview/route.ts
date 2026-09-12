import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

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
        "Please sign in before loading Repayment Notice records.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const userDb = createUserScopedClient(accessToken);
    const { data: userResult, error: userError } =
      await userDb.auth.getUser(accessToken);

    if (userError || !userResult?.user) {
      return jsonError(
        "Your session is no longer valid.",
        401,
        "INVALID_SESSION"
      );
    }

    const [
      companiesResult,
      investmentsResult,
      repaymentsResult,
      noticeBatchesResult,
      noticeHistoryResult,
    ] = await Promise.all([
      userDb
        .from("portfolio_companies")
        .select("company_name,finance_contact_email,id,repayment_contact_email"),
      userDb
        .from("fund_investments")
        .select("id,investment_type,portfolio_company_id,security_details,security_type"),
      userDb
        .from("debt_repayment_schedules")
        .select("due_date,fund_name,id,interest_due,investment_id,notice_status,payment_status,portfolio_company_id,principal_due,total_due")
        .order("due_date"),
      userDb
        .from("repayment_notice_batches")
        .select("created_at,id,notice_type,total_notices")
        .order("created_at", { ascending: false })
        .limit(10),
      userDb
        .from("repayment_notices")
        .select("batch_id,company_name,created_at,delivery_status,due_date,email_body,email_dispatch_status,email_draft_status,email_ready,email_ready_note,email_send_attempt_count,email_sent_at,email_subject,id,last_action_at,last_action_note,notice_body,notice_status,notice_subject,recipient_email,reminder_sent_at,reminder_status,repayment_schedule_id,sent_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    const firstError =
      companiesResult.error ||
      investmentsResult.error ||
      repaymentsResult.error ||
      noticeBatchesResult.error ||
      noticeHistoryResult.error;

    if (firstError) {
      return jsonError(firstError.message, 500, "READ_MODEL_QUERY_FAILED");
    }

    return jsonResponse({
      portfolioCompanies: companiesResult.data ?? [],
      fundInvestments: investmentsResult.data ?? [],
      debtRepayments: repaymentsResult.data ?? [],
      repaymentNoticeBatches: noticeBatchesResult.data ?? [],
      repaymentNoticeHistory: noticeHistoryResult.data ?? [],
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Repayment Notice error.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "Supabase is not configured.",
        500,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    return jsonError(
      "Unable to load Repayment Notice records.",
      500,
      "REPAYMENT_NOTICE_OVERVIEW_FAILED"
    );
  }
}

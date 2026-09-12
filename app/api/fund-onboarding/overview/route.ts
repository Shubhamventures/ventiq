import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../../lib/server/governedFundAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
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
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

function uniqueFundNames(
  funds: Array<{ fund_name: string; can_view: boolean }>
) {
  return Array.from(
    new Set(
      funds
        .filter((fund) => fund.can_view)
        .map((fund) => fund.fund_name.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const governedFunds = await listGovernedFunds(actor);
    const governedFundNames = uniqueFundNames(governedFunds);

    if (governedFundNames.length === 0) {
      return json({
        funds: [],
        schemes: [],
        stakeholders: [],
        inviteBatches: [],
        auditLogs: [],
      });
    }

    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return json({ error: "Please sign in before loading Fund Onboarding." }, 401);
    }

    const db = createUserScopedClient(accessToken);
    const fundsResult = await db
      .from("ventiq_funds")
      .select(
        "id,fund_name,fund_type,jurisdiction,sebi_registration_number,gift_city_registration_number,sponsor_name,investment_manager_name,trustee_name,onboarding_status,data_mode,created_at"
      )
      .in("fund_name", governedFundNames)
      .order("created_at", { ascending: false });

    if (fundsResult.error) {
      throw new Error(fundsResult.error.message);
    }

    const funds = (fundsResult.data || []) as DataRow[];
    const governedNameSet = new Set(
      governedFundNames.map((fundName) => fundName.toLowerCase())
    );
    const scopedFunds = funds.filter((row) =>
      governedNameSet.has(String(row.fund_name || "").trim().toLowerCase())
    );
    const governedFundIds = scopedFunds
      .map((row) => String(row.id || "").trim())
      .filter(Boolean);

    if (governedFundIds.length === 0) {
      return json({
        funds: scopedFunds,
        schemes: [],
        stakeholders: [],
        inviteBatches: [],
        auditLogs: [],
      });
    }

    const [schemesResult, stakeholdersResult, batchesResult, auditResult] =
      await Promise.all([
        db
          .from("ventiq_schemes")
          .select(
            "id,fund_id,scheme_name,scheme_type,category,strategy,base_currency,scheme_status"
          )
          .in("fund_id", governedFundIds)
          .order("created_at", { ascending: false }),

        db
          .from("ventiq_stakeholders")
          .select(
            "role_key,id,fund_id,scheme_id,full_name,email,organization,stakeholder_type,access_level,invite_status,invited_at,activated_at,revoked_at,last_login_at"
          )
          .in("fund_id", governedFundIds)
          .order("created_at", { ascending: false }),

        db
          .from("ventiq_invite_batches")
          .select(
            "id,fund_id,batch_name,total_invites,sent_count,pending_count,activated_count,batch_status,created_at"
          )
          .in("fund_id", governedFundIds)
          .order("created_at", { ascending: false }),

        db
          .from("ventiq_access_audit_logs")
          .select(
            "id,fund_id,stakeholder_id,event_type,event_title,event_description,actor_name,actor_email,created_at"
          )
          .in("fund_id", governedFundIds)
          .order("created_at", { ascending: false }),
      ]);

    if (schemesResult.error) throw new Error(schemesResult.error.message);
    if (stakeholdersResult.error) throw new Error(stakeholdersResult.error.message);
    if (batchesResult.error) throw new Error(batchesResult.error.message);
    if (auditResult.error) throw new Error(auditResult.error.message);

    return json({
      funds: scopedFunds,
      schemes: (schemesResult.data || []) as DataRow[],
      stakeholders: (stakeholdersResult.data || []) as DataRow[],
      inviteBatches: (batchesResult.data || []) as DataRow[],
      auditLogs: (auditResult.data || []) as DataRow[],
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load governed Fund Onboarding data.",
      },
      500
    );
  }
}

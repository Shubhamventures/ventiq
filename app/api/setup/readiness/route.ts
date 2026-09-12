import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../../lib/server/governedFundAccess";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
    },
  });
}

function latestDate(values: Array<string | null | undefined>) {
  const valid = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time);

  return valid[0]?.value || "";
}

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );

    if (!fundName) {
      return noStoreJson({ error: "fundName is required." }, 400);
    }

    const governedFunds = await listGovernedFunds(actor);
    const fundAccess = governedFunds.find(
      (fund) =>
        fund.fund_name.trim().toLowerCase() === fundName.toLowerCase()
    );

    if (!fundAccess || !fundAccess.can_view) {
      return noStoreJson(
        { error: "You do not have governed view access to this fund." },
        403
      );
    }

    const [fundResult, peopleResult] = await Promise.all([
      supabaseAdmin
        .from("fund_master")
        .select("id, fund_name, created_at")
        .ilike("fund_name", fundName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("ventiq_user_fund_access")
        .select(
          "user_id, role, can_view, can_edit, can_approve, status, granted_at, updated_at"
        )
        .eq("organisation_id", actor.organisationId)
        .ilike("fund_name", fundName)
        .eq("status", "Active")
        .eq("can_view", true)
        .order("updated_at", { ascending: false }),
    ]);

    if (fundResult.error) {
      throw new Error(`fund_master: ${fundResult.error.message}`);
    }

    if (peopleResult.error) {
      throw new Error(
        `ventiq_user_fund_access: ${peopleResult.error.message}`
      );
    }

    const fund = fundResult.data ?? null;
    const people = Array.isArray(peopleResult.data) ? peopleResult.data : [];

    return noStoreJson({
      fundName,
      setup: {
        fundIdentityReady: Boolean(fund),
        fundIdentitySource: "fund_master",
        fundCreatedAt: normalizeText(fund?.created_at),
        peopleAccessCount: people.length,
        peopleUpdatedAt: latestDate(
          people.flatMap((row) => [row.updated_at, row.granted_at])
        ),
      },
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return noStoreJson(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Setup readiness.",
      },
      500
    );
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "../supabaseAdmin";

export type GovernedFundOption = {
  fund_name: string;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  can_approve: boolean;
};

export type GovernedFundActor = {
  userId: string;
  email: string;
  fullName: string;
  organisationId: string;
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

export async function authenticateGovernedFundUser(
  request: Request
): Promise<GovernedFundActor> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const { data: authResult, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);

  const user = authResult?.user;

  if (authError || !user) {
    throw new Error("INVALID_SESSION");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("ventiq_user_profiles")
    .select("user_id, email, full_name, active_organisation_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
  }

  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  const activeOrganisationId = normalizeText(
    profile.active_organisation_id,
    80
  );

  let membershipQuery = supabaseAdmin
    .from("ventiq_organisation_members")
    .select("organisation_id, status, is_primary")
    .eq("user_id", user.id)
    .eq("status", "Active");

  if (activeOrganisationId) {
    membershipQuery = membershipQuery.eq(
      "organisation_id",
      activeOrganisationId
    );
  } else {
    membershipQuery = membershipQuery.order("is_primary", {
      ascending: false,
    });
  }

  const { data: membership, error: membershipError } =
    await membershipQuery.limit(1).maybeSingle();

  if (membershipError) {
    throw new Error(
      `Unable to verify organisation membership: ${membershipError.message}`
    );
  }

  if (!membership) {
    throw new Error("ORGANISATION_MEMBERSHIP_REQUIRED");
  }

  const organisationId = normalizeText(membership.organisation_id, 80);

  if (!organisationId) {
    throw new Error("ORGANISATION_REQUIRED");
  }

  return {
    userId: String(user.id),
    email: normalizeText(profile.email || user.email, 320),
    fullName: normalizeText(
      profile.full_name || user.email || "VENTIQ User",
      200
    ),
    organisationId,
  };
}

export async function listGovernedFunds(
  actor: GovernedFundActor
): Promise<GovernedFundOption[]> {
  const { data, error } = await supabaseAdmin
    .from("ventiq_user_fund_access")
    .select("fund_name, role, can_view, can_edit, can_approve, status")
    .eq("organisation_id", actor.organisationId)
    .eq("user_id", actor.userId)
    .eq("status", "Active")
    .eq("can_view", true)
    .order("fund_name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load governed fund access: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => ({
      fund_name: normalizeText(row.fund_name, 240),
      role: normalizeText(row.role, 80),
      can_view: Boolean(row.can_view),
      can_edit: Boolean(row.can_edit),
      can_approve: Boolean(row.can_approve),
    }))
    .filter((row) => Boolean(row.fund_name));
}

export function governedFundAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION"
  ) {
    return NextResponse.json(
      { error: "Please sign in before loading your VENTIQ fund context." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ORGANISATION_MEMBERSHIP_REQUIRED" ||
    message === "ORGANISATION_REQUIRED"
  ) {
    return NextResponse.json(
      {
        error:
          "Your VENTIQ account does not have an active organisation context.",
      },
      { status: 403 }
    );
  }

  return null;
}

import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  isMfaPrivilegedRole,
  MFA_PRECONDITION_STATUS,
  type VentiqAssuranceLevel,
  type VentiqMfaRequirementCode,
} from "../../../../lib/auth/mfaPolicy";

export const runtime = "nodejs";

const APP_ACCESS_COOKIE = "ventiq_app_access";
const APP_ACCESS_COOKIE_VERSION = "v2";
const PRIVILEGED_ACCESS_SECONDS = 60 * 60;
const STANDARD_ACCESS_SECONDS = 8 * 60 * 60;

function getSecret() {
  return process.env.VENTIQ_APP_ACCESS_SECRET || "";
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function signPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function clearCookie(response: NextResponse) {
  response.cookies.set(APP_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}

function mfaRequiredResponse(
  code: VentiqMfaRequirementCode,
  message: string
) {
  return clearCookie(
    NextResponse.json(
      {
        ok: false,
        code,
        error: message,
      },
      { status: MFA_PRECONDITION_STATUS }
    )
  );
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secret = getSecret();
  const accessToken = getBearerToken(request);

  if (!supabaseUrl || !serviceRoleKey || !secret) {
    return NextResponse.json(
      { error: "VENTIQ authentication perimeter is not configured." },
      { status: 503 }
    );
  }

  if (!accessToken) {
    return clearCookie(
      NextResponse.json(
        { error: "A VENTIQ session is required." },
        { status: 401 }
      )
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    return clearCookie(
      NextResponse.json(
        { error: "The VENTIQ session is no longer valid." },
        { status: 401 }
      )
    );
  }

  const [profileResult, membershipResult, aalResult] = await Promise.all([
    admin
      .from("ventiq_user_profiles")
      .select("user_id,status,active_organisation_id")
      .eq("user_id", user.id)
      .maybeSingle(),

    admin
      .from("ventiq_organisation_members")
      .select("organisation_id,role,status,is_primary")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .order("is_primary", { ascending: false }),

    admin.auth.mfa.getAuthenticatorAssuranceLevel(accessToken),
  ]);

  if (profileResult.error || membershipResult.error) {
    return NextResponse.json(
      { error: "VENTIQ could not verify the application authorization state." },
      { status: 500 }
    );
  }

  if (aalResult.error || !aalResult.data) {
    return clearCookie(
      NextResponse.json(
        { error: "VENTIQ could not verify the session authentication level." },
        { status: 401 }
      )
    );
  }

  const profile = profileResult.data;

  if (!profile || profile.status !== "Active") {
    return clearCookie(
      NextResponse.json(
        { error: "This VENTIQ account is not active." },
        { status: 403 }
      )
    );
  }

  const memberships = membershipResult.data ?? [];
  const requestedOrganisationId = String(
    profile.active_organisation_id ?? ""
  ).trim();

  const activeMembership = requestedOrganisationId
    ? memberships.find(
        (membership) =>
          String(membership.organisation_id ?? "").trim() ===
          requestedOrganisationId
      )
    : memberships.find((membership) => Boolean(membership.is_primary)) ??
      memberships[0];

  if (!activeMembership) {
    return clearCookie(
      NextResponse.json(
        {
          error:
            "No active VENTIQ organisation membership is available for this session.",
        },
        { status: 403 }
      )
    );
  }

  const activeRole = String(activeMembership.role ?? "")
    .trim()
    .toLowerCase();

  const currentLevel: VentiqAssuranceLevel =
    aalResult.data.currentLevel === "aal2" ? "aal2" : "aal1";

  const nextLevel: VentiqAssuranceLevel =
    aalResult.data.nextLevel === "aal2" ? "aal2" : "aal1";

  const privileged = isMfaPrivilegedRole(activeRole);

  if (privileged && currentLevel !== "aal2") {
    if (nextLevel === "aal2") {
      return mfaRequiredResponse(
        "MFA_CHALLENGE_REQUIRED",
        "Multi-factor authentication is required to open this VENTIQ workspace."
      );
    }

    return mfaRequiredResponse(
      "MFA_ENROLLMENT_REQUIRED",
      "Multi-factor authentication must be enrolled before this VENTIQ role can continue."
    );
  }

  // Investors are not forced to enroll MFA at this stage. If they have
  // already opted in by verifying a factor, VENTIQ honours that stronger
  // account posture and requires the second factor on subsequent sign-ins.
  if (!privileged && nextLevel === "aal2" && currentLevel !== "aal2") {
    return mfaRequiredResponse(
      "MFA_CHALLENGE_REQUIRED",
      "Complete your enrolled multi-factor authentication to continue."
    );
  }

  const accessSeconds = privileged
    ? PRIVILEGED_ACCESS_SECONDS
    : STANDARD_ACCESS_SECONDS;

  const expiresAt = Math.floor(Date.now() / 1000) + accessSeconds;
  const payload = [
    APP_ACCESS_COOKIE_VERSION,
    user.id,
    String(expiresAt),
    currentLevel,
  ].join(".");

  const signature = signPayload(secret, payload);
  const cookieValue = `${payload}.${signature}`;

  const response = NextResponse.json({
    ok: true,
    expires_at: expiresAt,
    assurance_level: currentLevel,
    mfa_required: privileged,
  });

  response.cookies.set(APP_ACCESS_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accessSeconds,
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function DELETE() {
  return clearCookie(
    NextResponse.json({
      ok: true,
      cleared: true,
    })
  );
}

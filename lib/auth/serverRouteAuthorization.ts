import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import {
  isMfaPrivilegedRole,
  type VentiqAssuranceLevel,
} from "./mfaPolicy";

const APP_ACCESS_COOKIE = "ventiq_app_access";
const APP_ACCESS_COOKIE_VERSION = "v2";

export type InternalRouteAuthorization =
  | {
      ok: true;
      userId: string;
      roles: string[];
      assuranceLevel: VentiqAssuranceLevel;
    }
  | {
      ok: false;
      status: 401 | 403 | 428 | 503;
      error: string;
    };

function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator <= 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return item.slice(separator + 1).trim();
  }
  return "";
}

function signatureMatches(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifyApplicationCookie(request: Request) {
  const secret = process.env.VENTIQ_APP_ACCESS_SECRET || "";
  const cookie = getCookieValue(request, APP_ACCESS_COOKIE);
  if (!secret || !cookie) return null;

  const parts = cookie.split(".");
  if (parts.length !== 5) return null;

  const [version, userId, expiresAtRaw, assuranceRaw, suppliedSignature] =
    parts;

  const expiresAt = Number(expiresAtRaw);
  const assuranceLevel: VentiqAssuranceLevel | null =
    assuranceRaw === "aal2"
      ? "aal2"
      : assuranceRaw === "aal1"
        ? "aal1"
        : null;

  if (
    version !== APP_ACCESS_COOKIE_VERSION ||
    !userId ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !assuranceLevel ||
    !suppliedSignature
  ) {
    return null;
  }

  const payload = [version, userId, expiresAtRaw, assuranceRaw].join(".");
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (!signatureMatches(suppliedSignature, expectedSignature)) {
    return null;
  }

  return {
    userId,
    assuranceLevel,
  };
}

function createAuthorizationAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function authorizeInternalRoute(
  request: Request,
  allowedRoles: readonly string[]
): Promise<InternalRouteAuthorization> {
  const applicationAccess = verifyApplicationCookie(request);

  if (!applicationAccess) {
    return {
      ok: false,
      status: 401,
      error: "Authenticated VENTIQ application access is required.",
    };
  }

  const admin = createAuthorizationAdmin();
  if (!admin) {
    return {
      ok: false,
      status: 503,
      error: "VENTIQ server authorization is not configured.",
    };
  }

  const [profileResult, membershipResult] = await Promise.all([
    admin
      .from("ventiq_user_profiles")
      .select("user_id,status,active_organisation_id")
      .eq("user_id", applicationAccess.userId)
      .maybeSingle(),
    admin
      .from("ventiq_organisation_members")
      .select("organisation_id,role,status,is_primary")
      .eq("user_id", applicationAccess.userId)
      .eq("status", "Active")
      .order("is_primary", { ascending: false }),
  ]);

  if (profileResult.error || membershipResult.error) {
    return {
      ok: false,
      status: 503,
      error: "VENTIQ could not verify the current authorization state.",
    };
  }

  if (!profileResult.data || profileResult.data.status !== "Active") {
    return {
      ok: false,
      status: 403,
      error: "This VENTIQ account is not active.",
    };
  }

  const memberships = membershipResult.data ?? [];
  const requestedOrganisationId = String(
    profileResult.data.active_organisation_id ?? ""
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
    return {
      ok: false,
      status: 403,
      error:
        "No active VENTIQ organisation membership is available for this operation.",
    };
  }

  const activeRole = String(activeMembership.role ?? "")
    .trim()
    .toLowerCase();

  const allowed = new Set(
    allowedRoles.map((role) => role.trim().toLowerCase())
  );

  if (!activeRole || !allowed.has(activeRole)) {
    return {
      ok: false,
      status: 403,
      error: "Your VENTIQ role does not permit this operation.",
    };
  }

  if (
    isMfaPrivilegedRole(activeRole) &&
    applicationAccess.assuranceLevel !== "aal2"
  ) {
    return {
      ok: false,
      status: 428,
      error: "Multi-factor authentication is required for this operation.",
    };
  }

  return {
    ok: true,
    userId: applicationAccess.userId,
    roles: [activeRole],
    assuranceLevel: applicationAccess.assuranceLevel,
  };
}

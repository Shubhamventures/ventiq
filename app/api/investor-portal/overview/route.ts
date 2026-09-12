import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

const ALLOWED_ROLES = new Set([
  "fund_admin",
  "investor_relations",
  "investor",
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

function isFutureOrNoExpiry(value: unknown) {
  const text = normalizeText(value, 100);
  if (!text) return true;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
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
        "Please sign in before opening the verified Investor Portal.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const requestedSourceBatchId = normalizeText(
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

    const [profileResult, membershipResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_user_profiles")
        .select(
          "user_id,default_role,active_organisation_id,investor_id,status"
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
        "The requested Investor Portal was not found.",
        404,
        "INVESTOR_PORTAL_NOT_FOUND"
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
      .select(
        "organisation_id,role,can_view,investor_id,status"
      )
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
        "The requested Investor Portal was not found.",
        404,
        "INVESTOR_PORTAL_NOT_FOUND"
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
        "The requested Investor Portal was not found.",
        404,
        "INVESTOR_PORTAL_NOT_FOUND"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    let investorEntitlements: DataRow[] = [];

    if (activeRole === "investor") {
      const entitlementResult = await userDb
        .from("ventiq_user_investor_access")
        .select(
          "investor_code,fund_name,status,expires_at,can_view_profile,can_view_financials,can_view_documents,can_download_documents,can_use_data_room,can_submit_questions"
        )
        .eq("status", "Active")
        .eq("fund_name", fundName);

      if (entitlementResult.error) {
        throw new Error(
          `Unable to resolve your investor entitlement: ${entitlementResult.error.message}`
        );
      }

      investorEntitlements = (
        (entitlementResult.data ?? []) as unknown as DataRow[]
      ).filter((row) => isFutureOrNoExpiry(row.expires_at));

      if (investorEntitlements.length === 0) {
        return jsonError(
          `Your investor account has no active entitlement for ${fundName}.`,
          404,
          "INVESTOR_ENTITLEMENT_NOT_FOUND"
        );
      }
    }

    // Investor-role users never consume the internal Calculation Engine source
    // batch. Ignore any browser-supplied sourceBatchId for Investor role.
    const sourceBatchId =
      activeRole === "investor" ? "" : requestedSourceBatchId;

    let investorsQuery = userDb
      .from("investor_master")
      .select("id,investor_code,investor_name,investor_type,email,country,kyc_status,bank_status")
      .eq("fund_name", fundName)
      .order("investor_code", { ascending: true });

    let commitmentsQuery = userDb
      .from("fund_commitments")
      .select("id,investor_id,investor_code,commitment_code,fund_name,class_name,commitment_amount,unfunded_commitment,commitment_status,status")
      .eq("fund_name", fundName);

    let uploadsQuery = userDb
      .from("migration_file_uploads")
      .select("original_file_name,category,mime_type");

    let complianceQuery = userDb
      .from("compliance_items")
      .select("evidence_available,filing_status")
      .eq("fund_name", fundName);

    if (sourceBatchId) {
      investorsQuery = investorsQuery.eq(
        "source_batch_id",
        sourceBatchId
      );
      commitmentsQuery = commitmentsQuery.eq(
        "source_batch_id",
        sourceBatchId
      );
      uploadsQuery = uploadsQuery.eq(
        "batch_id",
        sourceBatchId
      );
      complianceQuery = complianceQuery.eq(
        "source_batch_id",
        sourceBatchId
      );
    } else {
      const impossibleBatch = "__VENTIQ_NO_VERIFIED_SOURCE_BATCH__";

      commitmentsQuery = commitmentsQuery.eq(
        "source_batch_id",
        impossibleBatch
      );
      uploadsQuery = uploadsQuery.eq(
        "batch_id",
        impossibleBatch
      );
      complianceQuery = complianceQuery.eq(
        "source_batch_id",
        impossibleBatch
      );
    }

    const [
      investorsResult,
      commitmentsResult,
      activationResult,
      moduleActivationResult,
      uploadsResult,
      complianceResult,
    ] = await Promise.all([
      investorsQuery,
      commitmentsQuery,

      userDb
        .from("fund_activation_status")
        .select("status, activated_at, activated_by, readiness_score")
        .eq("fund_name", fundName)
        .maybeSingle(),

      userDb
        .from("ventiq_module_activation_status")
        .select(
          "status, activated_at, activated_by_name, module_key, readiness_score"
        )
        .eq("fund_name", fundName)
        .eq("module_key", "investor_documents_portal")
        .maybeSingle(),

      uploadsQuery,
      complianceQuery,
    ]);

    if (investorsResult.error) {
      throw new Error(investorsResult.error.message);
    }

    if (commitmentsResult.error) {
      throw new Error(commitmentsResult.error.message);
    }

    const investorRows =
      (investorsResult.data ?? []) as unknown as DataRow[];
    const commitmentRows =
      (commitmentsResult.data ?? []) as unknown as DataRow[];
    const activation = activationResult.error
      ? null
      : ((activationResult.data as unknown as DataRow | null) ?? null);
    const moduleActivation = moduleActivationResult.error
      ? null
      : ((moduleActivationResult.data as unknown as DataRow | null) ?? null);
    const uploadRows = uploadsResult.error
      ? []
      : ((uploadsResult.data ?? []) as unknown as DataRow[]);
    const complianceRows = complianceResult.error
      ? []
      : ((complianceResult.data ?? []) as unknown as DataRow[]);

    return jsonResponse({
      investorEntitlements,
      investorRows,
      commitmentRows,
      activation,
      moduleActivation,
      uploadRows,
      complianceRows,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the verified Investor Portal.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Investor Portal is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Investor Portal overview load failed:", error);

    return jsonError(
      message,
      500,
      "INVESTOR_PORTAL_OVERVIEW_LOAD_FAILED"
    );
  }
}

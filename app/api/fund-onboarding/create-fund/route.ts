import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateFundRequestBody = {
  fundName?: string;
  fundType?: string;
  jurisdiction?: string;
  sebiRegistrationNumber?: string;
  giftCityRegistrationNumber?: string;
  sponsorName?: string;
  investmentManagerName?: string;
  trusteeName?: string;
  dataMode?: string;
};

type AuthorisedFundAdmin = {
  userId: string;
  email: string;
  fullName: string;
  organisationId: string;
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

async function authoriseFundAdmin(
  request: NextRequest
): Promise<AuthorisedFundAdmin> {
  const accessToken = getBearerToken(request);
  if (!accessToken) throw new Error("AUTHENTICATION_REQUIRED");

  const { data: authResult, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);
  const user = authResult?.user;

  if (authError || !user) throw new Error("INVALID_SESSION");

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
    .select("organisation_id, role, status, is_primary")
    .eq("user_id", user.id)
    .eq("status", "Active")
    .eq("role", "fund_admin");

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

  const { data: membership, error: membershipError } = await membershipQuery
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(
      `Unable to verify organisation membership: ${membershipError.message}`
    );
  }

  if (!membership) throw new Error("FUND_ADMIN_REQUIRED");

  const organisationId = normalizeText(membership.organisation_id, 80);
  if (!organisationId) throw new Error("ORGANISATION_REQUIRED");

  return {
    userId: String(user.id),
    email: normalizeText(profile.email || user.email, 320),
    fullName: normalizeText(
      profile.full_name || user.email || "VENTIQ Fund Admin",
      200
    ),
    organisationId,
  };
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "AUTHENTICATION_REQUIRED" || message === "INVALID_SESSION") {
    return NextResponse.json(
      { ok: false, message: "Please sign in before creating a fund." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "FUND_ADMIN_REQUIRED" ||
    message === "ORGANISATION_REQUIRED"
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Only an active VENTIQ Fund Admin can create a fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  let actor: AuthorisedFundAdmin;

  try {
    actor = await authoriseFundAdmin(request);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to authorise fund creation.",
      },
      { status: 500 }
    );
  }

  let createdFundId = "";
  let accessCreated = false;
  let fundName = "";

  try {
    const body = (await request.json()) as CreateFundRequestBody;

    fundName = normalizeText(body.fundName, 240);
    const fundType = normalizeText(body.fundType, 120) || "Category II AIF";
    const jurisdiction = normalizeText(body.jurisdiction, 120) || "India";
    const sebiRegistrationNumber = normalizeText(
      body.sebiRegistrationNumber,
      160
    );
    const giftCityRegistrationNumber = normalizeText(
      body.giftCityRegistrationNumber,
      160
    );
    const sponsorName = normalizeText(body.sponsorName, 240);
    const investmentManagerName = normalizeText(
      body.investmentManagerName,
      240
    );
    const trusteeName = normalizeText(body.trusteeName, 240);
    const dataMode = normalizeText(body.dataMode, 80) || "Live Data";

    if (!fundName) {
      return NextResponse.json(
        { ok: false, message: "Fund name is required." },
        { status: 400 }
      );
    }

    const { data: existingAccess, error: existingAccessError } =
      await supabaseAdmin
        .from("ventiq_user_fund_access")
        .select("id, fund_name, status")
        .eq("organisation_id", actor.organisationId)
        .eq("user_id", actor.userId)
        .ilike("fund_name", fundName)
        .limit(1)
        .maybeSingle();

    if (existingAccessError) {
      throw new Error(
        `Unable to check existing fund access: ${existingAccessError.message}`
      );
    }

    if (existingAccess) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This Fund Admin already has an access record for a fund with this name.",
        },
        { status: 409 }
      );
    }

    const { data: fund, error: fundError } = await supabaseAdmin
      .from("ventiq_funds")
      .insert({
        fund_name: fundName,
        fund_type: fundType,
        jurisdiction,
        sebi_registration_number: sebiRegistrationNumber,
        gift_city_registration_number: giftCityRegistrationNumber,
        sponsor_name: sponsorName,
        investment_manager_name: investmentManagerName,
        trustee_name: trusteeName,
        onboarding_status: "Fund Created",
        data_mode: dataMode,
      })
      .select("*")
      .single();

    if (fundError || !fund) {
      throw new Error(fundError?.message || "Unable to create fund.");
    }

    createdFundId = normalizeText(fund.id, 80);

    const { error: accessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .insert({
        organisation_id: actor.organisationId,
        user_id: actor.userId,
        fund_name: fundName,
        role: "fund_admin",
        can_view: true,
        can_edit: true,
        can_approve: true,
        investor_id: null,
        status: "Active",
        granted_by: actor.userId,
      });

    if (accessError) {
      throw new Error(
        `Fund was created but creator access could not be established: ${accessError.message}`
      );
    }

    accessCreated = true;

    const { error: auditError } = await supabaseAdmin
      .from("ventiq_access_audit_logs")
      .insert({
        fund_id: createdFundId || null,
        stakeholder_id: null,
        event_type: "Fund Created",
        event_title: "New fund created",
        event_description: `${fundName} was created and the creating Fund Admin received governed fund access.`,
        actor_name: actor.fullName,
        actor_email: actor.email,
      });

    if (auditError) {
      throw new Error(
        `Fund access was created but the audit event could not be recorded: ${auditError.message}`
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Fund created and Fund Admin access established.",
      fund,
      access: {
        organisationId: actor.organisationId,
        userId: actor.userId,
        fundName,
        role: "fund_admin",
        canView: true,
        canEdit: true,
        canApprove: true,
        status: "Active",
      },
    });
  } catch (error) {
    if (accessCreated && fundName) {
      await supabaseAdmin
        .from("ventiq_user_fund_access")
        .delete()
        .eq("organisation_id", actor.organisationId)
        .eq("user_id", actor.userId)
        .eq("fund_name", fundName);
    }

    if (createdFundId) {
      await supabaseAdmin.from("ventiq_funds").delete().eq("id", createdFundId);
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to create fund.",
      },
      { status: 500 }
    );
  }
}
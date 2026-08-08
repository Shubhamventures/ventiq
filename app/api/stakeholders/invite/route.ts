import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InviteRequestBody = {
  stakeholderId?: string;
};

type AuthorisedInviteActor = {
  userId: string;
  email: string;
  fullName: string;
  organisationId: string;
};

type RoleConfig = {
  canonicalRole: string;
  roleLabel: string;
  dashboardPath: string;
};

const INVITABLE_ROLES: Record<string, RoleConfig> = {
  fund_admin: {
    canonicalRole: "fund_admin",
    roleLabel: "Fund Admin",
    dashboardPath: "/fund-onboarding",
  },
  managing_partner: {
    canonicalRole: "managing_partner",
    roleLabel: "Managing Partner",
    dashboardPath: "/managing-partner-ai",
  },
  finance_head: {
    canonicalRole: "finance_head",
    roleLabel: "Finance Head",
    dashboardPath: "/finance-head-ai",
  },
  investment_team: {
    canonicalRole: "investment_team",
    roleLabel: "Investment Team",
    dashboardPath: "/investment-team-ai",
  },
  compliance_officer: {
    canonicalRole: "compliance_team",
    roleLabel: "Compliance Team",
    dashboardPath: "/compliance-ai",
  },
  compliance_team: {
    canonicalRole: "compliance_team",
    roleLabel: "Compliance Team",
    dashboardPath: "/compliance-ai",
  },
  investor_relations: {
    canonicalRole: "investor_relations",
    roleLabel: "Investor Relations",
    dashboardPath: "/investor-portal",
  },
  investor_lp: {
    canonicalRole: "investor",
    roleLabel: "Investor / LP",
    dashboardPath: "/investor-portal",
  },
  investor: {
    canonicalRole: "investor",
    roleLabel: "Investor / LP",
    dashboardPath: "/investor-portal",
  },
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

function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "http://localhost:3000";

  const clean = configured.replace(/\/$/, "");
  return /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function authoriseInviteActor(
  request: NextRequest
): Promise<AuthorisedInviteActor> {
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
      { ok: false, message: "Please sign in before sending stakeholder invites." },
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
        message:
          "Only an active VENTIQ Fund Admin can send stakeholder invites.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  let actor: AuthorisedInviteActor;

  try {
    actor = await authoriseInviteActor(request);
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to authorise stakeholder invite.",
      },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as InviteRequestBody;
    const stakeholderId = normalizeText(body.stakeholderId, 80);

    if (!stakeholderId) {
      return NextResponse.json(
        { ok: false, message: "stakeholderId is required." },
        { status: 400 }
      );
    }

    const { data: stakeholder, error: stakeholderError } = await supabaseAdmin
      .from("ventiq_stakeholders")
      .select(
        "id, fund_id, email, full_name, role_key, invite_status, access_status, auth_user_id"
      )
      .eq("id", stakeholderId)
      .maybeSingle();

    if (stakeholderError) {
      return NextResponse.json(
        { ok: false, message: stakeholderError.message },
        { status: 400 }
      );
    }

    if (!stakeholder) {
      return NextResponse.json(
        { ok: false, message: "Stakeholder not found." },
        { status: 404 }
      );
    }

    const fundId = normalizeText(stakeholder.fund_id, 80);
    const email = normalizeText(stakeholder.email, 320).toLowerCase();
    const fullName =
      normalizeText(stakeholder.full_name, 200) || "VENTIQ User";
    const storedRoleKey = normalizeText(stakeholder.role_key, 80);
    const role = INVITABLE_ROLES[storedRoleKey];
    const accessStatus = normalizeText(stakeholder.access_status, 80).toLowerCase();
    const linkedAuthUserId = normalizeText(stakeholder.auth_user_id, 80);

    if (!fundId) {
      return NextResponse.json(
        { ok: false, message: "Stakeholder is not linked to a fund." },
        { status: 409 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, message: "Stakeholder has no valid email address." },
        { status: 409 }
      );
    }

    if (!role) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Stakeholder role is not mapped to a supported VENTIQ access role.",
        },
        { status: 409 }
      );
    }

    if (accessStatus === "revoked") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Stakeholder access is revoked. Restore access before sending an invite.",
        },
        { status: 409 }
      );
    }

    if (linkedAuthUserId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "This stakeholder is already linked to a VENTIQ user. Use access management instead of sending a new invite.",
        },
        { status: 409 }
      );
    }

    const { data: fund, error: fundError } = await supabaseAdmin
      .from("ventiq_funds")
      .select("id, fund_name")
      .eq("id", fundId)
      .maybeSingle();

    if (fundError) {
      return NextResponse.json(
        { ok: false, message: fundError.message },
        { status: 400 }
      );
    }

    if (!fund) {
      return NextResponse.json(
        { ok: false, message: "Stakeholder fund not found." },
        { status: 404 }
      );
    }

    const fundName = normalizeText(fund.fund_name, 240);
    if (!fundName) {
      return NextResponse.json(
        { ok: false, message: "Stakeholder fund name could not be resolved." },
        { status: 409 }
      );
    }

    const { data: fundAccess, error: fundAccessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("id, can_edit, status")
      .eq("organisation_id", actor.organisationId)
      .eq("user_id", actor.userId)
      .eq("fund_name", fundName)
      .eq("status", "Active")
      .eq("can_edit", true)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      return NextResponse.json(
        {
          ok: false,
          message: `Unable to verify fund access: ${fundAccessError.message}`,
        },
        { status: 400 }
      );
    }

    if (!fundAccess) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "You do not have edit access to the fund linked to this stakeholder.",
        },
        { status: 403 }
      );
    }

    const redirectTo = `${getSiteUrl()}/auth/set-password?next=${encodeURIComponent(
      role.dashboardPath
    )}&stakeholder=${encodeURIComponent(stakeholderId)}`;

    const { data: invitedUser, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          role_key: role.canonicalRole,
          role_label: role.roleLabel,
          dashboard_path: role.dashboardPath,
          fund_id: fundId,
          fund_name: fundName,
          organisation_id: actor.organisationId,
          stakeholder_id: stakeholderId,
        },
        redirectTo,
      });

    if (inviteError) {
      return NextResponse.json(
        { ok: false, message: inviteError.message },
        { status: 400 }
      );
    }

    const invitedUserId = invitedUser.user?.id || null;
    const now = new Date().toISOString();

    const { error: stakeholderUpdateError } = await supabaseAdmin
      .from("ventiq_stakeholders")
      .update({
        auth_user_id: invitedUserId,
        invite_status: "Invite Sent",
        invited_at: now,
        access_status: "Active",
      })
      .eq("id", stakeholderId)
      .eq("fund_id", fundId);

    if (stakeholderUpdateError) {
      if (invitedUserId) {
        await supabaseAdmin.auth.admin.deleteUser(invitedUserId).catch(() => {
          // Best-effort rollback only. The API still reports the database error.
        });
      }

      return NextResponse.json(
        { ok: false, message: stakeholderUpdateError.message },
        { status: 400 }
      );
    }

    const { error: auditError } = await supabaseAdmin
      .from("ventiq_access_audit_logs")
      .insert({
        fund_id: fundId,
        stakeholder_id: stakeholderId,
        event_type: "Secure Invite Sent",
        event_title: "Stakeholder secure invite sent",
        event_description: `${fullName} was invited as ${role.roleLabel} for ${fundName}.`,
        actor_name: actor.fullName,
        actor_email: actor.email,
      });

    if (auditError) {
      console.error("VENTIQ invite audit log failed:", auditError.message);
    }

    return NextResponse.json({
      ok: true,
      message: "Secure invite sent successfully.",
      userId: invitedUserId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "Unable to send invite.",
      },
      { status: 500 }
    );
  }
}
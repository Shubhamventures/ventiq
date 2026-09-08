import { NextRequest, NextResponse } from "next/server";

import {
  getRoleHomeRoute,
  getRoleLabel,
  normalizeVentiqRole,
  type VentiqRole,
} from "../../../../lib/auth/types";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVATION_CONTRACT_VERSION = "B8-F12A";

type ActivationMode = "preflight" | "activate";

type ActivationRequestBody = {
  stakeholderId?: string;
  mode?: ActivationMode;
};

type FundCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
};

type ActivationContext = {
  userId: string;
  userEmail: string;
  fullName: string;
  stakeholderId: string;
  fundId: string;
  fundName: string;
  organisationId: string;
  role: VentiqRole;
  roleLabel: string;
  dashboardPath: string;
  investorCode: string | null;
  capabilities: FundCapabilities;
};

type DataRow = Record<string, unknown>;

const ROLE_FUND_CAPABILITIES: Record<VentiqRole, FundCapabilities> = {
  fund_admin: {
    canView: true,
    canEdit: true,
    canApprove: true,
  },
  managing_partner: {
    canView: true,
    canEdit: true,
    canApprove: true,
  },
  finance_head: {
    canView: true,
    canEdit: true,
    canApprove: true,
  },
  investment_team: {
    canView: true,
    canEdit: true,
    canApprove: false,
  },
  compliance_team: {
    canView: true,
    canEdit: true,
    canApprove: true,
  },
  investor_relations: {
    canView: true,
    canEdit: true,
    canApprove: false,
  },
  investor: {
    canView: true,
    canEdit: false,
    canApprove: false,
  },
  maker: {
    canView: true,
    canEdit: true,
    canApprove: false,
  },
  checker: {
    canView: true,
    canEdit: true,
    canApprove: true,
  },
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeEmail(value: unknown) {
  return normalizeText(value, 320).toLowerCase();
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(
    {
      ...body,
      contractVersion: ACTIVATION_CONTRACT_VERSION,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

function jsonError(
  message: string,
  status: number,
  code: string
) {
  return jsonResponse(
    {
      ok: false,
      code,
      message,
    },
    status
  );
}

function sameText(left: unknown, right: unknown) {
  return normalizeText(left, 500) === normalizeText(right, 500);
}

function sameEmail(left: unknown, right: unknown) {
  return normalizeEmail(left) === normalizeEmail(right);
}

async function resolveAuthoritativeOrganisationId(
  fundName: string
) {
  const { data, error } = await supabaseAdmin
    .from("ventiq_user_fund_access")
    .select("organisation_id,status")
    .eq("fund_name", fundName)
    .eq("status", "Active")
    .limit(5000);

  if (error) {
    throw new Error(
      `Unable to resolve governed fund organisation: ${error.message}`
    );
  }

  const organisationIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => normalizeText(row.organisation_id, 80))
        .filter(Boolean)
    )
  );

  if (organisationIds.length !== 1) {
    throw new Error(
      "FUND_ORGANISATION_CONTEXT_AMBIGUOUS"
    );
  }

  return organisationIds[0];
}

async function resolveCanonicalInvestorCode(
  fundName: string,
  investorBatchId: string,
  userId: string
) {
  if (!investorBatchId) {
    throw new Error(
      "INVESTOR_AUTHORITATIVE_BATCH_REQUIRED"
    );
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("ventiq_user_profiles")
      .select("user_id,investor_id,status")
      .eq("user_id", userId)
      .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to resolve pre-approved investor profile: ${profileError.message}`
    );
  }

  if (!profile) {
    throw new Error(
      "INVESTOR_PREAPPROVED_PROFILE_REQUIRED"
    );
  }

  const profileStatus = normalizeText(
    profile.status,
    80
  );

  if (
    profileStatus !== "Pending" &&
    profileStatus !== "Active"
  ) {
    throw new Error(
      "INVESTOR_PREAPPROVED_PROFILE_STATUS_INVALID"
    );
  }

  const investorCode = normalizeText(
    profile.investor_id,
    160
  );

  if (!investorCode) {
    throw new Error(
      "INVESTOR_PREAPPROVED_PROFILE_CODE_REQUIRED"
    );
  }

  const { data, error } = await supabaseAdmin
    .from("investor_master")
    .select(
      "id,investor_code,investor_name,email,fund_name,batch_id,source_batch_id"
    )
    .ilike("fund_name", fundName)
    .eq("batch_id", investorBatchId)
    .eq("investor_code", investorCode)
    .limit(2);

  if (error) {
    throw new Error(
      `Unable to verify pre-approved canonical investor identity: ${error.message}`
    );
  }

  const rows = data ?? [];

  if (rows.length !== 1) {
    throw new Error(
      rows.length === 0
        ? "INVESTOR_PREAPPROVED_CODE_NOT_IN_FROZEN_BATCH"
        : "INVESTOR_PREAPPROVED_CODE_AMBIGUOUS"
    );
  }

  if (
    normalizeText(
      rows[0].investor_code,
      160
    ) !== investorCode
  ) {
    throw new Error(
      "INVESTOR_PREAPPROVED_CODE_DRIFT"
    );
  }

  return investorCode;
}

async function resolveActivationContext(
  request: NextRequest,
  stakeholderId: string
): Promise<ActivationContext> {
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

  const userId = normalizeText(user.id, 80);
  const userEmail = normalizeEmail(user.email);

  if (!userId || !userEmail) {
    throw new Error("AUTH_IDENTITY_INCOMPLETE");
  }

  const { data: stakeholder, error: stakeholderError } =
    await supabaseAdmin
      .from("ventiq_stakeholders")
      .select(
        "id,fund_id,email,full_name,role_key,role_label,dashboard_path,invite_status,access_status,auth_user_id,invited_at,activated_at,last_password_set_at"
      )
      .eq("id", stakeholderId)
      .maybeSingle();

  if (stakeholderError) {
    throw new Error(
      `Unable to load invited stakeholder: ${stakeholderError.message}`
    );
  }

  if (!stakeholder) {
    throw new Error("STAKEHOLDER_NOT_FOUND");
  }

  const linkedAuthUserId = normalizeText(
    stakeholder.auth_user_id,
    80
  );

  if (!linkedAuthUserId || linkedAuthUserId !== userId) {
    throw new Error(
      "STAKEHOLDER_AUTH_IDENTITY_MISMATCH"
    );
  }

  const stakeholderEmail = normalizeEmail(
    stakeholder.email
  );

  if (
    !stakeholderEmail ||
    stakeholderEmail !== userEmail
  ) {
    throw new Error(
      "STAKEHOLDER_EMAIL_IDENTITY_MISMATCH"
    );
  }

  const inviteStatus = normalizeText(
    stakeholder.invite_status,
    80
  );

  if (
    inviteStatus !== "Invite Sent" &&
    inviteStatus !== "Activated"
  ) {
    throw new Error(
      "STAKEHOLDER_INVITE_STATUS_NOT_ACTIVATABLE"
    );
  }

  if (
    normalizeText(
      stakeholder.access_status,
      80
    ).toLowerCase() === "revoked"
  ) {
    throw new Error("STAKEHOLDER_ACCESS_REVOKED");
  }

  const fundId = normalizeText(
    stakeholder.fund_id,
    80
  );

  if (!fundId) {
    throw new Error("STAKEHOLDER_FUND_REQUIRED");
  }

  const role = normalizeVentiqRole(
    stakeholder.role_key
  );

  if (!role) {
    throw new Error(
      "STAKEHOLDER_ROLE_NOT_SUPPORTED"
    );
  }

  const roleLabel = getRoleLabel(role);
  const dashboardPath = getRoleHomeRoute(role);

  if (
    normalizeText(stakeholder.role_label, 160) &&
    !sameText(
      stakeholder.role_label,
      roleLabel
    )
  ) {
    throw new Error(
      "STAKEHOLDER_ROLE_LABEL_DRIFT"
    );
  }

  if (
    normalizeText(
      stakeholder.dashboard_path,
      240
    ) &&
    !sameText(
      stakeholder.dashboard_path,
      dashboardPath
    )
  ) {
    throw new Error(
      "STAKEHOLDER_DASHBOARD_PATH_DRIFT"
    );
  }

  const { data: fund, error: fundError } =
    await supabaseAdmin
      .from("ventiq_funds")
      .select("id,fund_name")
      .eq("id", fundId)
      .maybeSingle();

  if (fundError) {
    throw new Error(
      `Unable to load stakeholder fund: ${fundError.message}`
    );
  }

  if (!fund) {
    throw new Error("STAKEHOLDER_FUND_NOT_FOUND");
  }

  const fundName = normalizeText(
    fund.fund_name,
    240
  );

  if (!fundName) {
    throw new Error(
      "STAKEHOLDER_FUND_NAME_REQUIRED"
    );
  }

  const organisationId =
    await resolveAuthoritativeOrganisationId(
      fundName
    );

  const metadata = normalizeMetadata(
    user.user_metadata
  );

  const metadataChecks = [
    sameText(
      metadata.stakeholder_id,
      stakeholderId
    ),
    sameText(metadata.fund_id, fundId),
    sameText(metadata.fund_name, fundName),
    sameText(
      metadata.organisation_id,
      organisationId
    ),
    sameText(metadata.role_key, role),
    sameText(
      metadata.role_label,
      roleLabel
    ),
    sameText(
      metadata.dashboard_path,
      dashboardPath
    ),
  ];

  if (
    metadataChecks.some(
      (passed) => !passed
    )
  ) {
    throw new Error(
      "INVITE_AUTH_METADATA_MISMATCH"
    );
  }

  const { data: activation, error: activationError } =
    await supabaseAdmin
      .from("fund_activation_status")
      .select(
        "fund_name,status,readiness_score,approved_batch_map"
      )
      .ilike("fund_name", fundName)
      .limit(2)
      .maybeSingle();

  if (activationError) {
    throw new Error(
      `Unable to verify fund activation: ${activationError.message}`
    );
  }

  if (
    !activation ||
    normalizeText(activation.status, 80) !== "Active" ||
    Number(activation.readiness_score) !== 100
  ) {
    throw new Error(
      "FUND_NOT_ACTIVE_FOR_STAKEHOLDER_ACTIVATION"
    );
  }

  const approvedBatchMap = normalizeMetadata(
    activation.approved_batch_map
  );

  let investorCode: string | null = null;

  if (role === "investor") {
    investorCode =
      await resolveCanonicalInvestorCode(
        fundName,
        normalizeText(
          approvedBatchMap.investor,
          80
        ),
        userId
      );
  }

  return {
    userId,
    userEmail,
    fullName:
      normalizeText(
        stakeholder.full_name,
        200
      ) ||
      normalizeText(
        user.user_metadata?.full_name,
        200
      ) ||
      userEmail,
    stakeholderId,
    fundId,
    fundName,
    organisationId,
    role,
    roleLabel,
    dashboardPath,
    investorCode,
    capabilities:
      ROLE_FUND_CAPABILITIES[role],
  };
}

async function validateProvisioningConflicts(
  context: ActivationContext
) {
  const [
    profileResult,
    membershipResult,
    fundAccessResult,
    investorAccessResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("ventiq_user_profiles")
      .select(
        "user_id,email,full_name,default_role,active_organisation_id,investor_id,status"
      )
      .eq("user_id", context.userId)
      .maybeSingle(),

    supabaseAdmin
      .from("ventiq_organisation_members")
      .select(
        "id,organisation_id,user_id,role,status,is_primary"
      )
      .eq("user_id", context.userId),

    supabaseAdmin
      .from("ventiq_user_fund_access")
      .select(
        "id,organisation_id,user_id,fund_name,role,can_view,can_edit,can_approve,investor_id,status"
      )
      .eq("user_id", context.userId),

    supabaseAdmin
      .from("ventiq_user_investor_access")
      .select(
        "id,organisation_id,user_id,fund_name,investor_code,status,expires_at,can_view_profile,can_view_financials,can_view_documents,can_download_documents,can_use_data_room,can_submit_questions"
      )
      .eq("user_id", context.userId),
  ]);

  const firstError =
    profileResult.error ||
    membershipResult.error ||
    fundAccessResult.error ||
    investorAccessResult.error;

  if (firstError) {
    throw new Error(
      `Unable to verify activation provisioning state: ${firstError.message}`
    );
  }

  const profile =
    profileResult.data as DataRow | null;

  if (profile) {
    const profileRole = normalizeText(
      profile.default_role,
      80
    );
    const profileOrganisationId =
      normalizeText(
        profile.active_organisation_id,
        80
      );
    const profileInvestorId =
      normalizeText(
        profile.investor_id,
        160
      );

    if (
      profileRole &&
      profileRole !== context.role
    ) {
      throw new Error(
        "PROFILE_ROLE_CONFLICT"
      );
    }

    if (
      profileOrganisationId &&
      profileOrganisationId !==
        context.organisationId
    ) {
      throw new Error(
        "PROFILE_ORGANISATION_CONFLICT"
      );
    }

    if (
      context.role === "investor" &&
      profileInvestorId &&
      profileInvestorId !==
        context.investorCode
    ) {
      throw new Error(
        "PROFILE_INVESTOR_ID_CONFLICT"
      );
    }

    if (
      context.role !== "investor" &&
      profileInvestorId
    ) {
      throw new Error(
        "PROFILE_INTERNAL_ROLE_HAS_INVESTOR_ID"
      );
    }
  }

  const memberships =
    (membershipResult.data ?? []) as DataRow[];

  const activeForeignMembership =
    memberships.find(
      (row) =>
        normalizeText(row.status, 80) ===
          "Active" &&
        normalizeText(
          row.organisation_id,
          80
        ) !== context.organisationId
    );

  if (activeForeignMembership) {
    throw new Error(
      "ACTIVE_FOREIGN_ORGANISATION_MEMBERSHIP_CONFLICT"
    );
  }

  const targetMemberships =
    memberships.filter(
      (row) =>
        normalizeText(
          row.organisation_id,
          80
        ) === context.organisationId
    );

  if (targetMemberships.length > 1) {
    throw new Error(
      "DUPLICATE_TARGET_ORGANISATION_MEMBERSHIP"
    );
  }

  if (
    targetMemberships.length === 1 &&
    normalizeText(
      targetMemberships[0].role,
      80
    ) &&
    normalizeText(
      targetMemberships[0].role,
      80
    ) !== context.role
  ) {
    throw new Error(
      "TARGET_ORGANISATION_ROLE_CONFLICT"
    );
  }

  const fundAccessRows =
    (fundAccessResult.data ?? []) as DataRow[];

  const targetFundRows =
    fundAccessRows.filter(
      (row) =>
        normalizeText(
          row.organisation_id,
          80
        ) === context.organisationId &&
        normalizeText(
          row.fund_name,
          240
        ).toLowerCase() ===
          context.fundName.toLowerCase()
    );

  if (targetFundRows.length > 1) {
    throw new Error(
      "DUPLICATE_TARGET_FUND_ACCESS"
    );
  }

  if (targetFundRows.length === 1) {
    const currentRole = normalizeText(
      targetFundRows[0].role,
      80
    );
    const currentInvestorId =
      normalizeText(
        targetFundRows[0].investor_id,
        160
      );

    if (
      currentRole &&
      currentRole !== context.role
    ) {
      throw new Error(
        "TARGET_FUND_ROLE_CONFLICT"
      );
    }

    if (
      context.role === "investor" &&
      currentInvestorId &&
      currentInvestorId !==
        context.investorCode
    ) {
      throw new Error(
        "TARGET_FUND_INVESTOR_ID_CONFLICT"
      );
    }

    if (
      context.role !== "investor" &&
      currentInvestorId
    ) {
      throw new Error(
        "TARGET_FUND_INTERNAL_ROLE_HAS_INVESTOR_ID"
      );
    }
  }

  const investorAccessRows =
    (investorAccessResult.data ?? []) as DataRow[];

  const targetInvestorAccessRows =
    investorAccessRows.filter(
      (row) =>
        normalizeText(
          row.organisation_id,
          80
        ) === context.organisationId &&
        normalizeText(
          row.fund_name,
          240
        ).toLowerCase() ===
          context.fundName.toLowerCase()
    );

  if (context.role !== "investor") {
    if (targetInvestorAccessRows.length > 0) {
      throw new Error(
        "INTERNAL_ROLE_HAS_INVESTOR_ENTITLEMENT_CONFLICT"
      );
    }
  } else {
    const conflictingEntitlement =
      targetInvestorAccessRows.find(
        (row) =>
          normalizeText(
            row.investor_code,
            160
          ) !== context.investorCode
      );

    if (conflictingEntitlement) {
      throw new Error(
        "INVESTOR_ENTITLEMENT_CODE_CONFLICT"
      );
    }

    if (targetInvestorAccessRows.length > 1) {
      throw new Error(
        "DUPLICATE_INVESTOR_ENTITLEMENT"
      );
    }
  }

  return {
    profile,
    targetMembership:
      targetMemberships[0] || null,
    targetFundAccess:
      targetFundRows[0] || null,
    targetInvestorAccess:
      targetInvestorAccessRows[0] || null,
  };
}

function desiredProfile(
  context: ActivationContext
) {
  return {
    user_id: context.userId,
    email: context.userEmail,
    full_name: context.fullName,
    default_role: context.role,
    active_organisation_id:
      context.organisationId,
    investor_id:
      context.role === "investor"
        ? context.investorCode
        : null,
    status: "Active",
  };
}

function desiredMembership(
  context: ActivationContext
) {
  return {
    organisation_id:
      context.organisationId,
    user_id: context.userId,
    role: context.role,
    status: "Active",
    is_primary: true,
  };
}

function desiredFundAccess(
  context: ActivationContext
) {
  return {
    organisation_id:
      context.organisationId,
    user_id: context.userId,
    fund_name: context.fundName,
    role: context.role,
    can_view: context.capabilities.canView,
    can_edit: context.capabilities.canEdit,
    can_approve:
      context.capabilities.canApprove,
    investor_id:
      context.role === "investor"
        ? context.investorCode
        : null,
    status: "Active",
  };
}

function desiredInvestorAccess(
  context: ActivationContext
) {
  return {
    organisation_id:
      context.organisationId,
    user_id: context.userId,
    fund_name: context.fundName,
    investor_code: context.investorCode,
    status: "Active",
    can_view_profile: true,
    can_view_financials: true,
    can_view_documents: true,
    can_download_documents: true,
    can_use_data_room: true,
    can_submit_questions: true,
  };
}

function restoreProfilePayload(
  row: DataRow
) {
  return {
    email: row.email ?? null,
    full_name: row.full_name ?? null,
    default_role:
      row.default_role ?? null,
    active_organisation_id:
      row.active_organisation_id ?? null,
    investor_id:
      row.investor_id ?? null,
    status: row.status ?? null,
  };
}

function restoreMembershipPayload(
  row: DataRow
) {
  return {
    role: row.role ?? null,
    status: row.status ?? null,
    is_primary:
      row.is_primary ?? false,
  };
}

function restoreFundAccessPayload(
  row: DataRow
) {
  return {
    role: row.role ?? null,
    can_view:
      row.can_view ?? false,
    can_edit:
      row.can_edit ?? false,
    can_approve:
      row.can_approve ?? false,
    investor_id:
      row.investor_id ?? null,
    status: row.status ?? null,
  };
}

function restoreInvestorAccessPayload(
  row: DataRow
) {
  return {
    investor_code:
      row.investor_code ?? null,
    status: row.status ?? null,
    expires_at:
      row.expires_at ?? null,
    can_view_profile:
      row.can_view_profile ?? false,
    can_view_financials:
      row.can_view_financials ?? false,
    can_view_documents:
      row.can_view_documents ?? false,
    can_download_documents:
      row.can_download_documents ?? false,
    can_use_data_room:
      row.can_use_data_room ?? false,
    can_submit_questions:
      row.can_submit_questions ?? false,
  };
}

async function activateInvite(
  context: ActivationContext
) {
  const pre =
    await validateProvisioningConflicts(
      context
    );

  const { data: stakeholderBefore, error: stakeholderBeforeError } =
    await supabaseAdmin
      .from("ventiq_stakeholders")
      .select(
        "id,invite_status,access_status,activated_at,last_password_set_at,auth_user_id"
      )
      .eq("id", context.stakeholderId)
      .eq("auth_user_id", context.userId)
      .maybeSingle();

  if (
    stakeholderBeforeError ||
    !stakeholderBefore
  ) {
    throw new Error(
      stakeholderBeforeError?.message ||
        "STAKEHOLDER_PRE_ACTIVATION_STATE_NOT_FOUND"
    );
  }

  const existingPasswordSetAudits =
    await supabaseAdmin
      .from("ventiq_access_audit_logs")
      .select("id")
      .eq(
        "stakeholder_id",
        context.stakeholderId
      )
      .eq("event_type", "Password Set")
      .limit(5);

  if (existingPasswordSetAudits.error) {
    throw new Error(
      `Unable to verify Password Set audit state: ${existingPasswordSetAudits.error.message}`
    );
  }

  if (
    (existingPasswordSetAudits.data ?? [])
      .length > 1
  ) {
    throw new Error(
      "DUPLICATE_PASSWORD_SET_AUDIT"
    );
  }

  const rollback = {
    profileExisted: Boolean(pre.profile),
    profile: pre.profile,
    membershipExisted: Boolean(
      pre.targetMembership
    ),
    membership: pre.targetMembership,
    fundAccessExisted: Boolean(
      pre.targetFundAccess
    ),
    fundAccess: pre.targetFundAccess,
    investorAccessExisted: Boolean(
      pre.targetInvestorAccess
    ),
    investorAccess:
      pre.targetInvestorAccess,
    stakeholder: stakeholderBefore as DataRow,
    createdMembershipId: "",
    createdFundAccessId: "",
    createdInvestorAccessId: "",
    createdAuditId: "",
  };

  try {
    const profileWrite = pre.profile
      ? await supabaseAdmin
          .from("ventiq_user_profiles")
          .update(desiredProfile(context))
          .eq("user_id", context.userId)
          .select("*")
          .single()
      : await supabaseAdmin
          .from("ventiq_user_profiles")
          .insert(desiredProfile(context))
          .select("*")
          .single();

    if (
      profileWrite.error ||
      !profileWrite.data
    ) {
      throw new Error(
        `PROFILE_PROVISIONING_FAILED:${
          profileWrite.error?.message ||
          "no row returned"
        }`
      );
    }

    const membershipPayload =
      desiredMembership(context);

    const membershipWrite =
      pre.targetMembership
        ? await supabaseAdmin
            .from(
              "ventiq_organisation_members"
            )
            .update(membershipPayload)
            .eq(
              "id",
              normalizeText(
                pre.targetMembership.id,
                80
              )
            )
            .select("*")
            .single()
        : await supabaseAdmin
            .from(
              "ventiq_organisation_members"
            )
            .insert(membershipPayload)
            .select("*")
            .single();

    if (
      membershipWrite.error ||
      !membershipWrite.data
    ) {
      throw new Error(
        `ORGANISATION_MEMBERSHIP_PROVISIONING_FAILED:${
          membershipWrite.error?.message ||
          "no row returned"
        }`
      );
    }

    if (!pre.targetMembership) {
      rollback.createdMembershipId =
        normalizeText(
          membershipWrite.data.id,
          80
        );
    }

    const fundAccessPayload =
      desiredFundAccess(context);

    const fundAccessWrite =
      pre.targetFundAccess
        ? await supabaseAdmin
            .from(
              "ventiq_user_fund_access"
            )
            .update(fundAccessPayload)
            .eq(
              "id",
              normalizeText(
                pre.targetFundAccess.id,
                80
              )
            )
            .select("*")
            .single()
        : await supabaseAdmin
            .from(
              "ventiq_user_fund_access"
            )
            .insert(fundAccessPayload)
            .select("*")
            .single();

    if (
      fundAccessWrite.error ||
      !fundAccessWrite.data
    ) {
      throw new Error(
        `FUND_ACCESS_PROVISIONING_FAILED:${
          fundAccessWrite.error?.message ||
          "no row returned"
        }`
      );
    }

    if (!pre.targetFundAccess) {
      rollback.createdFundAccessId =
        normalizeText(
          fundAccessWrite.data.id,
          80
        );
    }

    if (context.role === "investor") {
      const investorAccessPayload =
        desiredInvestorAccess(context);

      const investorAccessWrite =
        pre.targetInvestorAccess
          ? await supabaseAdmin
              .from(
                "ventiq_user_investor_access"
              )
              .update(investorAccessPayload)
              .eq(
                "id",
                normalizeText(
                  pre.targetInvestorAccess.id,
                  80
                )
              )
              .select("*")
              .single()
          : await supabaseAdmin
              .from(
                "ventiq_user_investor_access"
              )
              .insert(
                investorAccessPayload
              )
              .select("*")
              .single();

      if (
        investorAccessWrite.error ||
        !investorAccessWrite.data
      ) {
        throw new Error(
          `INVESTOR_ENTITLEMENT_PROVISIONING_FAILED:${
            investorAccessWrite.error?.message ||
            "no row returned"
          }`
        );
      }

      if (!pre.targetInvestorAccess) {
        rollback.createdInvestorAccessId =
          normalizeText(
            investorAccessWrite.data.id,
            80
          );
      }
    }

    const now = new Date().toISOString();

    const stakeholderWrite =
      await supabaseAdmin
        .from("ventiq_stakeholders")
        .update({
          invite_status: "Activated",
          activated_at: now,
          last_password_set_at: now,
          access_status: "Active",
        })
        .eq("id", context.stakeholderId)
        .eq("auth_user_id", context.userId)
        .select("*")
        .single();

    if (
      stakeholderWrite.error ||
      !stakeholderWrite.data
    ) {
      throw new Error(
        `STAKEHOLDER_ACTIVATION_FAILED:${
          stakeholderWrite.error?.message ||
          "no row returned"
        }`
      );
    }

    if (
      (existingPasswordSetAudits.data ?? [])
        .length === 0
    ) {
      const auditWrite =
        await supabaseAdmin
          .from(
            "ventiq_access_audit_logs"
          )
          .insert({
            fund_id: context.fundId,
            stakeholder_id:
              context.stakeholderId,
            event_type: "Password Set",
            event_title:
              "Stakeholder password set",
            event_description:
              "Stakeholder completed invite setup and created their password.",
            actor_name:
              context.fullName ||
              context.userEmail ||
              "Invited User",
            actor_email:
              context.userEmail,
          })
          .select("id")
          .single();

      if (
        auditWrite.error ||
        !auditWrite.data
      ) {
        throw new Error(
          `PASSWORD_SET_AUDIT_FAILED:${
            auditWrite.error?.message ||
            "no row returned"
          }`
        );
      }

      rollback.createdAuditId =
        normalizeText(
          auditWrite.data.id,
          80
        );
    }

    const post =
      await validateProvisioningConflicts(
        context
      );

    const {
      data: stakeholderAfter,
      error: stakeholderAfterError,
    } = await supabaseAdmin
      .from("ventiq_stakeholders")
      .select(
        "id,invite_status,access_status,activated_at,last_password_set_at,auth_user_id"
      )
      .eq("id", context.stakeholderId)
      .eq("auth_user_id", context.userId)
      .maybeSingle();

    if (
      stakeholderAfterError ||
      !stakeholderAfter ||
      normalizeText(
        stakeholderAfter.invite_status,
        80
      ) !== "Activated" ||
      normalizeText(
        stakeholderAfter.access_status,
        80
      ) !== "Active" ||
      !normalizeText(
        stakeholderAfter.activated_at,
        100
      ) ||
      !normalizeText(
        stakeholderAfter.last_password_set_at,
        100
      )
    ) {
      throw new Error(
        "POST_ACTIVATION_STAKEHOLDER_CERTIFICATION_FAILED"
      );
    }

    const profileAfter = post.profile;

    if (
      !profileAfter ||
      normalizeText(
        profileAfter.status,
        80
      ) !== "Active" ||
      normalizeText(
        profileAfter.default_role,
        80
      ) !== context.role ||
      normalizeText(
        profileAfter.active_organisation_id,
        80
      ) !== context.organisationId ||
      (context.role === "investor"
        ? normalizeText(
            profileAfter.investor_id,
            160
          ) !== context.investorCode
        : Boolean(
            normalizeText(
              profileAfter.investor_id,
              160
            )
          ))
    ) {
      throw new Error(
        "POST_ACTIVATION_PROFILE_CERTIFICATION_FAILED"
      );
    }

    const membershipAfter =
      post.targetMembership;

    if (
      !membershipAfter ||
      normalizeText(
        membershipAfter.status,
        80
      ) !== "Active" ||
      normalizeText(
        membershipAfter.role,
        80
      ) !== context.role ||
      membershipAfter.is_primary !== true
    ) {
      throw new Error(
        "POST_ACTIVATION_MEMBERSHIP_CERTIFICATION_FAILED"
      );
    }

    const fundAccessAfter =
      post.targetFundAccess;

    if (
      !fundAccessAfter ||
      normalizeText(
        fundAccessAfter.status,
        80
      ) !== "Active" ||
      normalizeText(
        fundAccessAfter.role,
        80
      ) !== context.role ||
      fundAccessAfter.can_view !==
        context.capabilities.canView ||
      fundAccessAfter.can_edit !==
        context.capabilities.canEdit ||
      fundAccessAfter.can_approve !==
        context.capabilities.canApprove ||
      (context.role === "investor"
        ? normalizeText(
            fundAccessAfter.investor_id,
            160
          ) !== context.investorCode
        : Boolean(
            normalizeText(
              fundAccessAfter.investor_id,
              160
            )
          ))
    ) {
      throw new Error(
        "POST_ACTIVATION_FUND_ACCESS_CERTIFICATION_FAILED"
      );
    }

    if (context.role === "investor") {
      const investorAccessAfter =
        post.targetInvestorAccess;

      if (
        !investorAccessAfter ||
        normalizeText(
          investorAccessAfter.status,
          80
        ) !== "Active" ||
        normalizeText(
          investorAccessAfter.investor_code,
          160
        ) !== context.investorCode ||
        investorAccessAfter.can_view_profile !==
          true ||
        investorAccessAfter.can_view_financials !==
          true ||
        investorAccessAfter.can_view_documents !==
          true ||
        investorAccessAfter.can_download_documents !==
          true ||
        investorAccessAfter.can_use_data_room !==
          true ||
        investorAccessAfter.can_submit_questions !==
          true
      ) {
        throw new Error(
          "POST_ACTIVATION_INVESTOR_ENTITLEMENT_CERTIFICATION_FAILED"
        );
      }
    }

    return;
  } catch (error) {
    if (rollback.createdAuditId) {
      await supabaseAdmin
        .from(
          "ventiq_access_audit_logs"
        )
        .delete()
        .eq("id", rollback.createdAuditId);
    }

    await supabaseAdmin
      .from("ventiq_stakeholders")
      .update({
        invite_status:
          rollback.stakeholder.invite_status ??
          null,
        access_status:
          rollback.stakeholder.access_status ??
          null,
        activated_at:
          rollback.stakeholder.activated_at ??
          null,
        last_password_set_at:
          rollback.stakeholder
            .last_password_set_at ?? null,
      })
      .eq("id", context.stakeholderId)
      .eq("auth_user_id", context.userId);

    if (
      rollback.createdInvestorAccessId
    ) {
      await supabaseAdmin
        .from(
          "ventiq_user_investor_access"
        )
        .delete()
        .eq(
          "id",
          rollback.createdInvestorAccessId
        );
    } else if (
      rollback.investorAccessExisted &&
      rollback.investorAccess
    ) {
      await supabaseAdmin
        .from(
          "ventiq_user_investor_access"
        )
        .update(
          restoreInvestorAccessPayload(
            rollback.investorAccess
          )
        )
        .eq(
          "id",
          normalizeText(
            rollback.investorAccess.id,
            80
          )
        );
    }

    if (rollback.createdFundAccessId) {
      await supabaseAdmin
        .from(
          "ventiq_user_fund_access"
        )
        .delete()
        .eq(
          "id",
          rollback.createdFundAccessId
        );
    } else if (
      rollback.fundAccessExisted &&
      rollback.fundAccess
    ) {
      await supabaseAdmin
        .from(
          "ventiq_user_fund_access"
        )
        .update(
          restoreFundAccessPayload(
            rollback.fundAccess
          )
        )
        .eq(
          "id",
          normalizeText(
            rollback.fundAccess.id,
            80
          )
        );
    }

    if (rollback.createdMembershipId) {
      await supabaseAdmin
        .from(
          "ventiq_organisation_members"
        )
        .delete()
        .eq(
          "id",
          rollback.createdMembershipId
        );
    } else if (
      rollback.membershipExisted &&
      rollback.membership
    ) {
      await supabaseAdmin
        .from(
          "ventiq_organisation_members"
        )
        .update(
          restoreMembershipPayload(
            rollback.membership
          )
        )
        .eq(
          "id",
          normalizeText(
            rollback.membership.id,
            80
          )
        );
    }

    if (
      rollback.profileExisted &&
      rollback.profile
    ) {
      await supabaseAdmin
        .from("ventiq_user_profiles")
        .update(
          restoreProfilePayload(
            rollback.profile
          )
        )
        .eq("user_id", context.userId);
    } else {
      await supabaseAdmin
        .from("ventiq_user_profiles")
        .delete()
        .eq("user_id", context.userId);
    }

    throw error;
  }
}


async function refreshInviteBatchActivationBookkeeping(
  fundId: string
) {
  const {
    data: auditRows,
    error: auditError,
  } = await supabaseAdmin
    .from("ventiq_access_audit_logs")
    .select("stakeholder_id,event_type")
    .eq("fund_id", fundId)
    .in("event_type", [
      "Secure Invite Sent",
      "Password Set",
    ])
    .limit(5000);

  if (auditError) {
    throw new Error(
      `INVITE_BATCH_AUDIT_READ_FAILED:${auditError.message}`
    );
  }

  const invitedStakeholderIds = new Set(
    (auditRows ?? [])
      .filter(
        (row) =>
          normalizeText(
            row.event_type,
            80
          ) === "Secure Invite Sent"
      )
      .map((row) =>
        normalizeText(
          row.stakeholder_id,
          80
        )
      )
      .filter(Boolean)
  );

  const activatedStakeholderIds = new Set(
    (auditRows ?? [])
      .filter(
        (row) =>
          normalizeText(
            row.event_type,
            80
          ) === "Password Set"
      )
      .map((row) =>
        normalizeText(
          row.stakeholder_id,
          80
        )
      )
      .filter(
        (stakeholderId) =>
          stakeholderId &&
          invitedStakeholderIds.has(
            stakeholderId
          )
      )
  );

  const {
    data: batchRows,
    error: batchReadError,
  } = await supabaseAdmin
    .from("ventiq_invite_batches")
    .select(
      "id,total_invites,sent_count,pending_count,activated_count,batch_status,created_at"
    )
    .eq("fund_id", fundId)
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (batchReadError) {
    throw new Error(
      `INVITE_BATCH_READ_FAILED:${batchReadError.message}`
    );
  }

  const batch =
    (batchRows ?? [])[0] ?? null;

  if (!batch) {
    return {
      ok: true,
      updated: false,
      activatedCount:
        activatedStakeholderIds.size,
      batchStatus: "No Batch",
    };
  }

  const totalInvites = Number(
    batch.total_invites ??
      batch.sent_count ??
      0
  );

  const activatedCount =
    totalInvites > 0
      ? Math.min(
          activatedStakeholderIds.size,
          totalInvites
        )
      : activatedStakeholderIds.size;

  const batchStatus =
    totalInvites > 0 &&
    activatedCount >= totalInvites
      ? "Activated"
      : normalizeText(
          batch.batch_status,
          80
        ) || "Sent";

  const {
    data: updatedBatch,
    error: batchWriteError,
  } = await supabaseAdmin
    .from("ventiq_invite_batches")
    .update({
      activated_count: activatedCount,
      batch_status: batchStatus,
    })
    .eq(
      "id",
      normalizeText(
        batch.id,
        80
      )
    )
    .select(
      "id,activated_count,batch_status"
    )
    .single();

  if (
    batchWriteError ||
    !updatedBatch
  ) {
    throw new Error(
      `INVITE_BATCH_UPDATE_FAILED:${
        batchWriteError?.message ||
        "no row returned"
      }`
    );
  }

  return {
    ok: true,
    updated: true,
    activatedCount: Number(
      updatedBatch.activated_count ?? 0
    ),
    batchStatus:
      normalizeText(
        updatedBatch.batch_status,
        80
      ) || batchStatus,
  };
}

function publicError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "UNKNOWN_ERROR";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION" ||
    message === "AUTH_IDENTITY_INCOMPLETE"
  ) {
    return {
      status: 401,
      code: message,
      message:
        "Your invite session is no longer valid. Open the latest invitation email and try again.",
    };
  }

  if (
    message.includes("INVESTOR_") ||
    message.includes("CONFLICT") ||
    message.includes("AMBIGUOUS") ||
    message.includes("DRIFT") ||
    message.includes("MISMATCH") ||
    message.includes("NOT_ACTIVATABLE") ||
    message.includes("REVOKED") ||
    message.includes("NOT_FOUND") ||
    message.includes("REQUIRED") ||
    message.includes("NOT_ACTIVE")
  ) {
    return {
      status: 409,
      code: message,
      message:
        "Your VENTIQ access cannot be activated safely yet. Please contact the Fund Administrator.",
    };
  }

  return {
    status: 500,
    code: "ACTIVATION_PROVISIONING_FAILED",
    message:
      "Your password may be saved, but governed VENTIQ access did not finish activating. Retry activation or contact the Fund Administrator.",
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      (await request.json()) as ActivationRequestBody;

    const stakeholderId = normalizeText(
      body.stakeholderId,
      80
    );

    const mode: ActivationMode =
      body.mode === "activate"
        ? "activate"
        : "preflight";

    if (!stakeholderId) {
      return jsonError(
        "stakeholderId is required.",
        400,
        "STAKEHOLDER_ID_REQUIRED"
      );
    }

    const context =
      await resolveActivationContext(
        request,
        stakeholderId
      );

    await validateProvisioningConflicts(
      context
    );

    let inviteBatchBookkeeping:
      | {
          ok: boolean;
          updated: boolean;
          activatedCount: number;
          batchStatus: string;
        }
      | null = null;

    if (mode === "activate") {
      await activateInvite(context);

      try {
        inviteBatchBookkeeping =
          await refreshInviteBatchActivationBookkeeping(
            context.fundId
          );
      } catch (bookkeepingError) {
        console.error(
          "VENTIQ invite batch bookkeeping failed:",
          bookkeepingError instanceof Error
            ? bookkeepingError.message
            : String(bookkeepingError)
        );

        inviteBatchBookkeeping = {
          ok: false,
          updated: false,
          activatedCount: -1,
          batchStatus: "Bookkeeping Warning",
        };
      }
    }

    return jsonResponse({
      ok: true,
      mode,
      role: context.role,
      roleLabel: context.roleLabel,
      nextPath: context.dashboardPath,
      fundName: context.fundName,
      investorContext:
        context.role === "investor"
          ? "Resolved"
          : "Not Applicable",
      activated:
        mode === "activate",
      inviteBatchBookkeeping,
    });
  } catch (error) {
    console.error(
      "VENTIQ invite activation failed:",
      error instanceof Error
        ? error.message
        : String(error)
    );

    const response = publicError(error);

    return jsonError(
      response.message,
      response.status,
      response.code
    );
  }
}

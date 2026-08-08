import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof createClient<any, "public", any>>;

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organisationId: string;
};

const VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "compliance_team",
  "maker",
  "checker",
]);

const CREATE_ROLES = new Set(["fund_admin", "maker"]);

const CHECKER_REVIEW_ROLES = new Set([
  "checker",
  "fund_admin",
  "finance_head",
  "compliance_team",
  "managing_partner",
]);

const FINAL_APPROVER_ROLES = new Set([
  "fund_admin",
  "finance_head",
  "compliance_team",
  "managing_partner",
]);

const SOURCE_MODULES = new Set([
  "Debt LMS",
  "Bank MIS",
  "Fund Onboarding",
  "Data Protection",
  "Investor Portal",
  "Document Studio",
  "Compliance AI",
]);

const LINKED_RECORD_TYPES = new Set([
  "Repayment Schedule",
  "Bank Transaction",
  "Stakeholder Access",
  "Investor Notice",
  "Capital Call",
  "Distribution",
  "Data Request",
  "Covenant Breach",
  "Security Tracker",
]);

const ACTION_TYPES = new Set([
  "Receipt Update",
  "AI Mapping Approval",
  "Penalty Waiver",
  "Default Marking",
  "Notice Dispatch",
  "Investor Invite",
  "Access Revocation",
  "Capital Call Approval",
  "Distribution Approval",
  "Data Deletion Approval",
]);

const PRIORITIES = new Set(["Low", "Medium", "High", "Critical"]);
const DECISIONS = new Set(["Approved", "Rejected"]);

function getSupabaseAdmin(): SupabaseAdmin | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as SupabaseAdmin;
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    fund_admin: "Fund Admin",
    managing_partner: "Managing Partner",
    finance_head: "Finance Head",
    investment_team: "Investment Team",
    compliance_team: "Compliance Team",
    investor_relations: "Investor Relations",
    maker: "Maker",
    checker: "Checker",
  };
  return labels[role] || role;
}

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);
  if (!accessToken) throw new Error("AUTHENTICATION_REQUIRED");

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);
  const user = userResult?.user;

  if (userError || !user) throw new Error("INVALID_SESSION");

  const { data: profile, error: profileError } = await supabase
    .from("ventiq_user_profiles")
    .select("user_id, email, full_name, default_role, active_organisation_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
  }

  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  let role = normalizeText(profile.default_role, 80);
  let organisationId = normalizeText(profile.active_organisation_id, 80);

  if (!VIEW_ROLES.has(role) || !organisationId) {
    const { data: membership, error: membershipError } = await supabase
      .from("ventiq_organisation_members")
      .select("organisation_id, role, status, is_primary")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw new Error(
        `Unable to load organisation membership: ${membershipError.message}`
      );
    }

    if (!VIEW_ROLES.has(role)) {
      role = normalizeText(membership?.role, 80);
    }

    if (!organisationId) {
      organisationId = normalizeText(membership?.organisation_id, 80);
    }
  }

  if (!VIEW_ROLES.has(role)) throw new Error("ROLE_NOT_ALLOWED");
  if (!organisationId) throw new Error("ORGANISATION_REQUIRED");

  return {
    userId: String(user.id),
    email: normalizeText(profile.email || user.email, 320),
    fullName: normalizeText(profile.full_name || user.email || "VENTIQ User", 200),
    role,
    organisationId,
  };
}

function capabilitiesFor(user: AuthorisedUser) {
  return {
    canCreate: CREATE_ROLES.has(user.role),
    canCheckerReview: CHECKER_REVIEW_ROLES.has(user.role),
    canFinalApprove: FINAL_APPROVER_ROLES.has(user.role),
  };
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "AUTHENTICATION_REQUIRED" || message === "INVALID_SESSION") {
    return NextResponse.json(
      { error: "Please sign in before accessing the approval workflow." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "ORGANISATION_REQUIRED"
  ) {
    return NextResponse.json(
      { error: "Your account is not authorised for the VENTIQ approval workflow." },
      { status: 403 }
    );
  }

  return null;
}

async function insertAuditLog(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  payload: {
    sourceModule: string;
    linkedRecordId?: string | null;
    linkedRecordType?: string | null;
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    riskLevel: string;
  }
) {
  const { error } = await supabase.from("ventiq_enterprise_audit_logs").insert({
    organisation_id: user.organisationId,
    source_module: payload.sourceModule,
    linked_record_id: payload.linkedRecordId || null,
    linked_record_type: payload.linkedRecordType || null,
    event_type: payload.eventType,
    event_title: payload.eventTitle,
    event_description: payload.eventDescription,
    actor_name: user.fullName,
    actor_email: user.email,
    actor_role: user.role,
    event_status: "Recorded",
    risk_level: payload.riskLevel,
  });

  if (error) throw new Error(`Unable to create audit log: ${error.message}`);
}

async function loadWorkflow(supabase: SupabaseAdmin, user: AuthorisedUser) {
  const { data: approvals, error: approvalsError } = await supabase
    .from("ventiq_approval_requests")
    .select("*")
    .eq("organisation_id", user.organisationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (approvalsError) {
    throw new Error(`Unable to load approval requests: ${approvalsError.message}`);
  }

  const approvalIds = (approvals || []).map((row: any) => String(row.id));
  let steps: any[] = [];

  if (approvalIds.length > 0) {
    const { data: stepRows, error: stepsError } = await supabase
      .from("ventiq_approval_steps")
      .select("*")
      .in("approval_request_id", approvalIds)
      .order("step_order", { ascending: true })
      .limit(1500);

    if (stepsError) {
      throw new Error(`Unable to load approval steps: ${stepsError.message}`);
    }

    steps = stepRows || [];
  }

  const { data: auditLogs, error: auditError } = await supabase
    .from("ventiq_enterprise_audit_logs")
    .select("*")
    .eq("organisation_id", user.organisationId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (auditError) {
    throw new Error(`Unable to load audit logs: ${auditError.message}`);
  }

  return {
    actor: user,
    capabilities: capabilitiesFor(user),
    approvals: approvals || [],
    steps,
    auditLogs: auditLogs || [],
  };
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server approval workflow is not configured." },
      { status: 503 }
    );
  }

  try {
    const user = await authoriseRequest(request, supabase);
    return NextResponse.json(await loadWorkflow(supabase, user));
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load approval workflow." },
      { status: 500 }
    );
  }
}

async function createRequest(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  body: Record<string, unknown>
) {
  if (!CREATE_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: "Only Fund Admin or Maker roles can create approval requests." },
      { status: 403 }
    );
  }

  const sourceModule = normalizeText(body.sourceModule, 100);
  const linkedRecordType = normalizeText(body.linkedRecordType, 100);
  const actionType = normalizeText(body.actionType, 100);
  const actionTitle = normalizeText(body.actionTitle, 240);
  const actionDescription = normalizeText(body.actionDescription, 4000);
  const businessImpact = normalizeText(body.businessImpact, 4000);
  const priority = normalizeText(body.priority, 40);

  if (!SOURCE_MODULES.has(sourceModule)) {
    return NextResponse.json({ error: "Invalid source module." }, { status: 400 });
  }
  if (!LINKED_RECORD_TYPES.has(linkedRecordType)) {
    return NextResponse.json({ error: "Invalid linked record type." }, { status: 400 });
  }
  if (!ACTION_TYPES.has(actionType)) {
    return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
  }
  if (!PRIORITIES.has(priority)) {
    return NextResponse.json({ error: "Invalid priority." }, { status: 400 });
  }
  if (!actionTitle) {
    return NextResponse.json({ error: "Action title is required." }, { status: 400 });
  }
  if (!actionDescription) {
    return NextResponse.json(
      { error: "Action description is required." },
      { status: 400 }
    );
  }

  const linkedRecordId = randomUUID();
  const now = new Date().toISOString();

  const { data: approval, error: approvalError } = await supabase
    .from("ventiq_approval_requests")
    .insert({
      organisation_id: user.organisationId,
      source_module: sourceModule,
      linked_record_id: linkedRecordId,
      linked_record_type: linkedRecordType,
      action_type: actionType,
      action_title: actionTitle,
      action_description: actionDescription,
      requested_by_name: user.fullName,
      requested_by_email: user.email,
      maker_role: user.role,
      checker_role: "checker",
      approver_role: "finance_head / compliance_team / managing_partner",
      priority,
      approval_status: "Pending Review",
      current_step: "Checker Review",
      business_impact: businessImpact || null,
      requested_at: now,
    })
    .select("*")
    .single();

  if (approvalError || !approval) {
    throw new Error(
      `Unable to create approval request: ${approvalError?.message || "No row returned"}`
    );
  }

  const { error: stepsError } = await supabase.from("ventiq_approval_steps").insert([
    {
      approval_request_id: approval.id,
      step_order: 1,
      step_name: "Maker Submitted",
      assigned_role: user.role,
      assigned_to_name: user.fullName,
      assigned_to_email: user.email,
      step_status: "Completed",
      actioned_by_name: user.fullName,
      actioned_by_email: user.email,
      actioned_at: now,
      comments: "Request submitted by authenticated maker.",
    },
    {
      approval_request_id: approval.id,
      step_order: 2,
      step_name: "Checker Review",
      assigned_role: "checker",
      assigned_to_name: null,
      assigned_to_email: null,
      step_status: "Pending",
    },
    {
      approval_request_id: approval.id,
      step_order: 3,
      step_name: "Final Approval",
      assigned_role: "finance_head / compliance_team / managing_partner",
      assigned_to_name: null,
      assigned_to_email: null,
      step_status: "Pending",
    },
  ]);

  if (stepsError) {
    await supabase.from("ventiq_approval_requests").delete().eq("id", approval.id);
    throw new Error(`Unable to create approval steps: ${stepsError.message}`);
  }

  try {
    await insertAuditLog(supabase, user, {
      sourceModule,
      linkedRecordId,
      linkedRecordType,
      eventType: "Approval Requested",
      eventTitle: actionTitle,
      eventDescription: `${actionDescription} Submitted for checker review by ${user.fullName}.`,
      riskLevel: priority,
    });
  } catch (error) {
    await supabase.from("ventiq_approval_steps").delete().eq("approval_request_id", approval.id);
    await supabase.from("ventiq_approval_requests").delete().eq("id", approval.id);
    throw error;
  }

  return NextResponse.json(
    {
      message: "Approval request created and sent to checker review.",
      approval,
    },
    { status: 201 }
  );
}

async function decideRequest(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  body: Record<string, unknown>
) {
  const approvalId = normalizeText(body.approvalId, 80);
  const decision = normalizeText(body.decision, 20);

  if (!approvalId) {
    return NextResponse.json({ error: "Approval ID is required." }, { status: 400 });
  }
  if (!DECISIONS.has(decision)) {
    return NextResponse.json({ error: "Invalid approval decision." }, { status: 400 });
  }

  const { data: approval, error: approvalError } = await supabase
    .from("ventiq_approval_requests")
    .select("*")
    .eq("id", approvalId)
    .eq("organisation_id", user.organisationId)
    .maybeSingle();

  if (approvalError) {
    throw new Error(`Unable to load approval request: ${approvalError.message}`);
  }
  if (!approval) {
    return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
  }

  const requesterEmail = normalizeText(approval.requested_by_email, 320).toLowerCase();
  if (requesterEmail && requesterEmail === user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Maker-checker control prevents a user from approving their own request." },
      { status: 403 }
    );
  }

  const currentStep = normalizeText(approval.current_step, 80);
  const now = new Date().toISOString();
  const isApproved = decision === "Approved";

  if (currentStep === "Checker Review") {
    if (!CHECKER_REVIEW_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "Your role cannot perform checker review." },
        { status: 403 }
      );
    }

    const { error: checkerStepError } = await supabase
      .from("ventiq_approval_steps")
      .update({
        step_status: isApproved ? "Completed" : "Rejected",
        assigned_to_name: user.fullName,
        assigned_to_email: user.email,
        actioned_by_name: user.fullName,
        actioned_by_email: user.email,
        actioned_at: now,
        comments: isApproved
          ? "Checker review completed by authenticated VENTIQ user."
          : "Request rejected during checker review by authenticated VENTIQ user.",
      })
      .eq("approval_request_id", approval.id)
      .eq("step_order", 2)
      .eq("step_status", "Pending");

    if (checkerStepError) {
      throw new Error(`Unable to update checker step: ${checkerStepError.message}`);
    }

    const requestUpdate = isApproved
      ? {
          approval_status: "Pending Approval",
          current_step: "Final Approval",
          approved_at: null,
          rejected_at: null,
          updated_at: now,
        }
      : {
          approval_status: "Rejected",
          current_step: "Rejected",
          approved_at: null,
          rejected_at: now,
          updated_at: now,
        };

    const { error: requestError } = await supabase
      .from("ventiq_approval_requests")
      .update(requestUpdate)
      .eq("id", approval.id)
      .eq("organisation_id", user.organisationId)
      .eq("current_step", "Checker Review");

    if (requestError) {
      await supabase
        .from("ventiq_approval_steps")
        .update({
          step_status: "Pending",
          assigned_to_name: null,
          assigned_to_email: null,
          actioned_by_name: null,
          actioned_by_email: null,
          actioned_at: null,
          comments: null,
        })
        .eq("approval_request_id", approval.id)
        .eq("step_order", 2);
      throw new Error(`Unable to update approval request: ${requestError.message}`);
    }

    if (!isApproved) {
      await supabase
        .from("ventiq_approval_steps")
        .update({
          step_status: "Rejected",
          comments: "Final approval not reached because the checker rejected the request.",
        })
        .eq("approval_request_id", approval.id)
        .eq("step_order", 3)
        .eq("step_status", "Pending");
    }

    await insertAuditLog(supabase, user, {
      sourceModule: normalizeText(approval.source_module, 100) || "VENTIQ",
      linkedRecordId: normalizeText(approval.linked_record_id, 100) || null,
      linkedRecordType: normalizeText(approval.linked_record_type, 100) || null,
      eventType: isApproved ? "Checker Approved" : "Checker Rejected",
      eventTitle: `${normalizeText(approval.action_title, 240)} ${isApproved ? "passed checker review" : "rejected by checker"}`,
      eventDescription: isApproved
        ? `${normalizeText(approval.action_title, 240)} passed checker review by ${user.fullName} and moved to final approval.`
        : `${normalizeText(approval.action_title, 240)} was rejected during checker review by ${user.fullName}.`,
      riskLevel: normalizeText(approval.priority, 40) || "Medium",
    });

    return NextResponse.json({
      message: isApproved
        ? "Checker review completed. Request moved to final approval."
        : "Request rejected during checker review.",
    });
  }

  if (currentStep === "Final Approval") {
    if (!FINAL_APPROVER_ROLES.has(user.role)) {
      return NextResponse.json(
        { error: "Your role cannot perform final approval." },
        { status: 403 }
      );
    }

    const { error: finalStepError } = await supabase
      .from("ventiq_approval_steps")
      .update({
        step_status: isApproved ? "Completed" : "Rejected",
        assigned_to_name: user.fullName,
        assigned_to_email: user.email,
        actioned_by_name: user.fullName,
        actioned_by_email: user.email,
        actioned_at: now,
        comments: isApproved
          ? "Final approval completed by authenticated VENTIQ user."
          : "Final approval rejected by authenticated VENTIQ user.",
      })
      .eq("approval_request_id", approval.id)
      .eq("step_order", 3)
      .eq("step_status", "Pending");

    if (finalStepError) {
      throw new Error(`Unable to update final approval step: ${finalStepError.message}`);
    }

    const { error: requestError } = await supabase
      .from("ventiq_approval_requests")
      .update({
        approval_status: decision,
        current_step: isApproved ? "Completed" : "Rejected",
        approved_at: isApproved ? now : null,
        rejected_at: isApproved ? null : now,
        updated_at: now,
      })
      .eq("id", approval.id)
      .eq("organisation_id", user.organisationId)
      .eq("current_step", "Final Approval");

    if (requestError) {
      await supabase
        .from("ventiq_approval_steps")
        .update({
          step_status: "Pending",
          assigned_to_name: null,
          assigned_to_email: null,
          actioned_by_name: null,
          actioned_by_email: null,
          actioned_at: null,
          comments: null,
        })
        .eq("approval_request_id", approval.id)
        .eq("step_order", 3);
      throw new Error(`Unable to update approval request: ${requestError.message}`);
    }

    await insertAuditLog(supabase, user, {
      sourceModule: normalizeText(approval.source_module, 100) || "VENTIQ",
      linkedRecordId: normalizeText(approval.linked_record_id, 100) || null,
      linkedRecordType: normalizeText(approval.linked_record_type, 100) || null,
      eventType: decision,
      eventTitle: `${normalizeText(approval.action_title, 240)} ${decision.toLowerCase()}`,
      eventDescription: `${normalizeText(approval.action_title, 240)} was ${decision.toLowerCase()} by ${user.fullName} (${roleLabel(user.role)}).`,
      riskLevel: normalizeText(approval.priority, 40) || "Medium",
    });

    return NextResponse.json({
      message: `Final approval ${decision.toLowerCase()} by ${user.fullName}.`,
    });
  }

  return NextResponse.json(
    { error: "This approval request is not awaiting an action." },
    { status: 409 }
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server approval workflow is not configured." },
      { status: 503 }
    );
  }

  try {
    const user = await authoriseRequest(request, supabase);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = normalizeText(body.action, 60);

    if (action === "create_request") {
      return await createRequest(supabase, user, body);
    }

    if (action === "decide_request") {
      return await decideRequest(supabase, user, body);
    }

    return NextResponse.json({ error: "Unsupported workflow action." }, { status: 400 });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval workflow action failed." },
      { status: 500 }
    );
  }
}
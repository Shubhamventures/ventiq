import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A8-2B: governed Compliance Operating Workspace workflow API.
// Browser reads remain on the existing Compliance page, but every operating
// mutation is server-controlled, fund-scoped, source-batch-scoped and audited.

type SupabaseAdmin = ReturnType<typeof createClient<any, "public", any>>;
type DataRow = Record<string, unknown>;

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organisationId: string;
  canView: boolean;
  canEdit: boolean;
};

const VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
]);

const ACTION_ROLES = new Set(["fund_admin", "compliance_team"]);

const ACTIONS = new Set([
  "start_review",
  "assign_owner",
  "request_evidence",
  "receive_evidence",
  "add_review_note",
]);

const FINAL_STATUSES = new Set([
  "filed",
  "completed",
  "closed",
  "approved",
  "resolved",
  "not applicable",
]);

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

function appendRemark(existing: unknown, entry: string) {
  const current = normalizeText(existing, 3200);
  const next = current ? `${current}\n${entry}` : entry;
  return next.slice(0, 4000);
}

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin,
  fundName: string,
  requiredAccess: "view" | "edit"
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);
  if (!accessToken) throw new Error("AUTHENTICATION_REQUIRED");

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);
  const user = userResult?.user;

  if (userError || !user) throw new Error("INVALID_SESSION");

  const { data: profile, error: profileError } = await supabase
    .from("ventiq_user_profiles")
    .select(
      "user_id,email,full_name,default_role,active_organisation_id,status"
    )
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
      .select("organisation_id,role,status,is_primary")
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

  const { data: fundAccess, error: fundAccessError } = await supabase
    .from("ventiq_user_fund_access")
    .select("id,can_view,can_edit,status")
    .eq("organisation_id", organisationId)
    .eq("user_id", user.id)
    .eq("fund_name", fundName)
    .eq("status", "Active")
    .maybeSingle();

  if (fundAccessError) {
    throw new Error(`Unable to verify fund access: ${fundAccessError.message}`);
  }

  const canView = fundAccess?.can_view === true;
  const canEdit = fundAccess?.can_edit === true;

  if (!canView) throw new Error("FUND_VIEW_NOT_ALLOWED");

  if (
    requiredAccess === "edit" &&
    (!canEdit || !ACTION_ROLES.has(role))
  ) {
    throw new Error("FUND_EDIT_NOT_ALLOWED");
  }

  return {
    userId: String(user.id),
    email: normalizeText(profile.email || user.email, 320),
    fullName: normalizeText(
      profile.full_name || user.email || "VENTIQ User",
      200
    ),
    role,
    organisationId,
    canView,
    canEdit,
  };
}

function authErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "AUTHENTICATION_REQUIRED" || message === "INVALID_SESSION") {
    return NextResponse.json(
      { error: "Please sign in before accessing the Compliance workflow." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "ORGANISATION_REQUIRED" ||
    message === "FUND_VIEW_NOT_ALLOWED" ||
    message === "FUND_EDIT_NOT_ALLOWED"
  ) {
    return NextResponse.json(
      {
        error:
          message === "FUND_EDIT_NOT_ALLOWED"
            ? "Compliance Team or Fund Admin edit access is required for this action."
            : "Your account is not authorised for this Compliance workspace.",
      },
      { status: 403 }
    );
  }

  return null;
}

async function loadComplianceItem(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  complianceItemId: string
) {
  const { data, error } = await supabase
    .from("compliance_items")
    .select("*")
    .eq("id", complianceItemId)
    .eq("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load compliance item: ${error.message}`);
  }

  if (!data) throw new Error("COMPLIANCE_ITEM_NOT_FOUND");
  return data as DataRow;
}

type ComplianceBatchSnapshot = {
  id: string;
  fundName: string;
  totalItems: number;
  evidenceAvailableCount: number;
  pendingReviewCount: number;
  highRiskCount: number;
  readyCount: number;
  updatedAt: unknown;
};

function isOpenComplianceStatus(row: DataRow) {
  const status = normalizeText(row.filing_status, 80).toLowerCase();
  return !FINAL_STATUSES.has(status);
}

function isHighRiskComplianceItem(row: DataRow) {
  return normalizeText(row.risk_level, 40).toLowerCase() === "high";
}

async function loadGovernedEvidenceDocument(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  evidenceDocumentId: string
) {
  const { data, error } = await supabase
    .from("data_room_documents")
    .select(
      "id,fund_name,source_batch_id,document_name,file_name,detected_type,suggested_folder,document_status,storage_bucket,storage_path,storage_url"
    )
    .eq("id", evidenceDocumentId)
    .ilike("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load Compliance evidence document: ${error.message}`);
  }

  if (!data) throw new Error("COMPLIANCE_EVIDENCE_NOT_FOUND");

  const storagePath = normalizeText(data.storage_path, 1600);
  if (!storagePath) throw new Error("COMPLIANCE_EVIDENCE_FILE_REQUIRED");

  return data as DataRow;
}

async function loadEvidenceCandidates(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string
) {
  const { data, error } = await supabase
    .from("data_room_documents")
    .select(
      "id,document_name,file_name,detected_type,suggested_folder,document_status,source_batch_id"
    )
    .ilike("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .not("storage_path", "is", null)
    .order("imported_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Unable to load Compliance evidence candidates: ${error.message}`);
  }

  return (data || []) as DataRow[];
}

async function refreshComplianceBatchSummary(
  supabase: SupabaseAdmin,
  item: DataRow
): Promise<ComplianceBatchSnapshot | null> {
  const batchId = normalizeText(item.batch_id, 100);
  const fundName = normalizeText(item.fund_name, 240);

  if (!batchId || !fundName) return null;

  const { data: batch, error: batchError } = await supabase
    .from("compliance_data_migration_batches")
    .select(
      "id,fund_name,total_items,evidence_available_count,pending_review_count,high_risk_count,ready_count,updated_at"
    )
    .eq("id", batchId)
    .eq("fund_name", fundName)
    .maybeSingle();

  if (batchError) {
    throw new Error(`Unable to load Compliance summary batch: ${batchError.message}`);
  }

  if (!batch) {
    throw new Error("COMPLIANCE_BATCH_NOT_FOUND");
  }

  const { data: itemRows, error: itemRowsError } = await supabase
    .from("compliance_items")
    .select("filing_status,evidence_available,risk_level")
    .eq("batch_id", batchId)
    .eq("fund_name", fundName)
    .limit(2000);

  if (itemRowsError) {
    throw new Error(`Unable to recalculate Compliance summary: ${itemRowsError.message}`);
  }

  const complianceRows = (itemRows || []) as DataRow[];
  const totalItems = complianceRows.length;
  const evidenceAvailableCount = complianceRows.filter(
    (row) => row.evidence_available === true
  ).length;
  const pendingReviewCount = complianceRows.filter(isOpenComplianceStatus).length;
  const highRiskCount = complianceRows.filter(isHighRiskComplianceItem).length;
  const readyCount = complianceRows.filter(
    (row) =>
      row.evidence_available === true &&
      !isOpenComplianceStatus(row) &&
      !isHighRiskComplianceItem(row)
  ).length;

  const snapshot: ComplianceBatchSnapshot = {
    id: normalizeText(batch.id, 100),
    fundName: normalizeText(batch.fund_name, 240),
    totalItems: Number(batch.total_items ?? 0),
    evidenceAvailableCount: Number(batch.evidence_available_count ?? 0),
    pendingReviewCount: Number(batch.pending_review_count ?? 0),
    highRiskCount: Number(batch.high_risk_count ?? 0),
    readyCount: Number(batch.ready_count ?? 0),
    updatedAt: batch.updated_at ?? null,
  };

  const { error: updateError } = await supabase
    .from("compliance_data_migration_batches")
    .update({
      total_items: totalItems,
      evidence_available_count: evidenceAvailableCount,
      pending_review_count: pendingReviewCount,
      high_risk_count: highRiskCount,
      ready_count: readyCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", batchId)
    .eq("fund_name", fundName);

  if (updateError) {
    throw new Error(`Unable to update Compliance summary batch: ${updateError.message}`);
  }

  return snapshot;
}

async function rollbackComplianceBatchSummary(
  supabase: SupabaseAdmin,
  snapshot: ComplianceBatchSnapshot | null
) {
  if (!snapshot) return;

  const { error } = await supabase
    .from("compliance_data_migration_batches")
    .update({
      total_items: snapshot.totalItems,
      evidence_available_count: snapshot.evidenceAvailableCount,
      pending_review_count: snapshot.pendingReviewCount,
      high_risk_count: snapshot.highRiskCount,
      ready_count: snapshot.readyCount,
      updated_at: snapshot.updatedAt,
    })
    .eq("id", snapshot.id)
    .eq("fund_name", snapshot.fundName);

  if (error) {
    throw new Error(`Unable to roll back Compliance summary batch: ${error.message}`);
  }
}

async function insertAuditLog(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  item: DataRow,
  payload: {
    eventType: string;
    eventTitle: string;
    eventDescription: string;
    evidenceUrl?: string;
  }
) {
  const { data, error } = await supabase
    .from("ventiq_enterprise_audit_logs")
    .insert({
      organisation_id: user.organisationId,
      source_module: "Compliance AI",
      linked_record_id: normalizeText(item.id, 100) || null,
      linked_record_type: "Compliance Item",
      event_type: payload.eventType,
      event_title: payload.eventTitle,
      event_description: payload.eventDescription,
      actor_name: user.fullName,
      actor_email: user.email,
      actor_role: user.role,
      event_status: "Recorded",
      risk_level: normalizeText(item.risk_level, 40) || "Medium",
      evidence_url: payload.evidenceUrl || null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Unable to create compliance audit log: ${error?.message || "No row returned"}`
    );
  }

  return data as DataRow;
}

async function loadAuditLogs(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  fundName: string,
  sourceBatchId: string
) {
  const { data: itemRows, error: itemError } = await supabase
    .from("compliance_items")
    .select("id")
    .eq("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .limit(500);

  if (itemError) {
    throw new Error(`Unable to load compliance items: ${itemError.message}`);
  }

  const ids = (itemRows || [])
    .map((row: any) => normalizeText(row.id, 100))
    .filter(Boolean);

  if (ids.length === 0) return [];

  const { data: auditRows, error: auditError } = await supabase
    .from("ventiq_enterprise_audit_logs")
    .select(
      "id,linked_record_id,linked_record_type,event_type,event_title,event_description,actor_name,actor_email,actor_role,event_status,risk_level,evidence_url,created_at"
    )
    .eq("organisation_id", user.organisationId)
    .eq("source_module", "Compliance AI")
    .eq("linked_record_type", "Compliance Item")
    .in("linked_record_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);

  if (auditError) {
    throw new Error(`Unable to load compliance audit trail: ${auditError.message}`);
  }

  return (auditRows || []) as DataRow[];
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Server Compliance workflow is not configured." },
      { status: 503 }
    );
  }

  const fundName = normalizeText(request.nextUrl.searchParams.get("fundName"), 240);
  const sourceBatchId = normalizeText(
    request.nextUrl.searchParams.get("sourceBatchId"),
    100
  );

  if (!fundName || !sourceBatchId) {
    return NextResponse.json(
      { error: "Active fund name and verified source batch are required." },
      { status: 400 }
    );
  }

  try {
    const user = await authoriseRequest(request, supabase, fundName, "view");
    const [auditLogs, evidenceDocuments] = await Promise.all([
      loadAuditLogs(supabase, user, fundName, sourceBatchId),
      loadEvidenceCandidates(supabase, fundName, sourceBatchId),
    ]);

    return NextResponse.json(
      {
        actor: {
          userId: user.userId,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        capabilities: {
          canView: user.canView,
          canAct: user.canEdit && ACTION_ROLES.has(user.role),
        },
        auditLogs,
        evidenceDocuments,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load the Compliance workflow.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Server Compliance workflow is not configured." },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json().catch(() => null)) as DataRow | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = normalizeText(body.action, 80);
    const fundName = normalizeText(body.fundName, 240);
    const sourceBatchId = normalizeText(body.sourceBatchId, 100);
    const complianceItemId = normalizeText(body.complianceItemId, 100);
    const owner = normalizeText(body.owner, 200);
    const note = normalizeText(body.note, 1200);
    const evidenceDocumentId = normalizeText(body.evidenceDocumentId, 100);

    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid Compliance action." }, { status: 400 });
    }

    if (!fundName || !sourceBatchId || !complianceItemId) {
      return NextResponse.json(
        {
          error:
            "Active fund, verified source batch and compliance item are required.",
        },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(request, supabase, fundName, "edit");
    const item = await loadComplianceItem(
      supabase,
      fundName,
      sourceBatchId,
      complianceItemId
    );

    const currentStatus = normalizeText(item.filing_status, 80).toLowerCase();

    if (FINAL_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        {
          error:
            "Filed / Approved / Closed compliance records cannot be changed from the operating queue. Use the governed approval workflow for a formal reopening or disposition change.",
        },
        { status: 409 }
      );
    }

    const documentName =
      normalizeText(item.document_name, 240) || "Compliance item";
    const authority = normalizeText(item.authority, 160) || "Authority";
    const previous = {
      filing_status: item.filing_status ?? null,
      evidence_available: item.evidence_available ?? false,
      owner: item.owner ?? null,
      remarks: item.remarks ?? null,
    };

    const updatePayload: Record<string, unknown> = {};
    let eventType = "Compliance Action";
    let eventTitle = `${documentName} updated`;
    let eventDescription = "";
    let evidenceUrl = "";

    if (action === "start_review") {
      if (currentStatus === "review") {
        return NextResponse.json({
          changed: false,
          updatedItem: item,
          message: `${documentName} is already under review.`,
        });
      }

      updatePayload.filing_status = "Review";
      eventType = "Compliance Review Started";
      eventTitle = `${documentName} moved to Review`;
      eventDescription = `${documentName} (${authority}) was moved to Review by ${user.fullName} (${roleLabel(user.role)}).`;
    }

    if (action === "assign_owner") {
      if (!owner) {
        return NextResponse.json(
          { error: "Owner is required for assignment." },
          { status: 400 }
        );
      }

      if (normalizeText(item.owner, 200) === owner) {
        return NextResponse.json({
          changed: false,
          updatedItem: item,
          message: `${owner} is already assigned to ${documentName}.`,
        });
      }

      updatePayload.owner = owner;
      eventType = "Compliance Owner Assigned";
      eventTitle = `${documentName} assigned to ${owner}`;
      eventDescription = `${documentName} (${authority}) was assigned to ${owner} by ${user.fullName} (${roleLabel(user.role)}).`;
    }

    if (action === "request_evidence") {
      const requestNote = note
        ? `Evidence requested: ${note}`
        : "Evidence requested from the responsible owner.";

      updatePayload.filing_status = "Review";
      updatePayload.remarks = appendRemark(item.remarks, requestNote);
      eventType = "Compliance Evidence Requested";
      eventTitle = `Evidence requested for ${documentName}`;
      eventDescription = `${requestNote} Requested by ${user.fullName} (${roleLabel(user.role)}) for ${documentName} (${authority}).`;
    }

    if (action === "receive_evidence") {
      if (!evidenceDocumentId) {
        return NextResponse.json(
          { error: "Select a governed evidence document before receiving evidence." },
          { status: 400 }
        );
      }

      const evidenceDocument = await loadGovernedEvidenceDocument(
        supabase,
        fundName,
        sourceBatchId,
        evidenceDocumentId
      );
      const evidenceName =
        normalizeText(evidenceDocument.document_name, 240) ||
        normalizeText(evidenceDocument.file_name, 240) ||
        "Compliance evidence";
      const storageBucket =
        normalizeText(evidenceDocument.storage_bucket, 160) || "data-room-documents";
      const storagePath = normalizeText(evidenceDocument.storage_path, 1600);
      const evidenceNote = note
        ? `Evidence received: ${evidenceName}. ${note}`
        : `Evidence received: ${evidenceName}.`;

      updatePayload.evidence_available = true;
      updatePayload.filing_status = "Review";
      updatePayload.remarks = appendRemark(item.remarks, evidenceNote);
      eventType = "Compliance Evidence Received";
      eventTitle = `Evidence received for ${documentName}`;
      eventDescription = `${evidenceName} was accepted as governed evidence for ${documentName} (${authority}) by ${user.fullName} (${roleLabel(user.role)}).`;
      evidenceUrl = `storage://${storageBucket}/${storagePath}`;
    }

    if (action === "add_review_note") {
      if (!note) {
        return NextResponse.json(
          { error: "Review note is required." },
          { status: 400 }
        );
      }

      updatePayload.remarks = appendRemark(item.remarks, `Review note: ${note}`);
      eventType = "Compliance Review Note Added";
      eventTitle = `Review note added to ${documentName}`;
      eventDescription = `${user.fullName} (${roleLabel(user.role)}) added a governed review note to ${documentName} (${authority}): ${note}`;
    }

    const { data: updated, error: updateError } = await supabase
      .from("compliance_items")
      .update(updatePayload)
      .eq("id", complianceItemId)
      .eq("fund_name", fundName)
      .eq("source_batch_id", sourceBatchId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(
        `Unable to update compliance item: ${updateError?.message || "No row returned"}`
      );
    }

    let batchSnapshot: ComplianceBatchSnapshot | null = null;

    try {
      batchSnapshot = await refreshComplianceBatchSummary(
        supabase,
        updated as DataRow
      );

      await insertAuditLog(supabase, user, updated as DataRow, {
        eventType,
        eventTitle,
        eventDescription,
        evidenceUrl: evidenceUrl || undefined,
      });
    } catch (workflowError) {
      const rollbackErrors: string[] = [];

      const { error: itemRollbackError } = await supabase
        .from("compliance_items")
        .update(previous)
        .eq("id", complianceItemId)
        .eq("fund_name", fundName)
        .eq("source_batch_id", sourceBatchId);

      if (itemRollbackError) {
        rollbackErrors.push(`item rollback failed: ${itemRollbackError.message}`);
      }

      try {
        await rollbackComplianceBatchSummary(supabase, batchSnapshot);
      } catch (batchRollbackError) {
        rollbackErrors.push(
          batchRollbackError instanceof Error
            ? batchRollbackError.message
            : "Compliance summary rollback failed."
        );
      }

      if (rollbackErrors.length > 0) {
        throw new Error(
          `${workflowError instanceof Error ? workflowError.message : "Compliance workflow failed."} ${rollbackErrors.join(" ")}`
        );
      }

      throw workflowError;
    }

    return NextResponse.json({
      changed: true,
      updatedItem: updated,
      message:
        action === "start_review"
          ? `${documentName} moved to Review and recorded in the enterprise audit trail.`
          : action === "assign_owner"
          ? `${documentName} assigned to ${owner} and recorded in the enterprise audit trail.`
          : action === "request_evidence"
          ? `Evidence request recorded for ${documentName}.`
          : action === "receive_evidence"
          ? `Governed evidence received for ${documentName}.`
          : `Governed review note recorded for ${documentName}.`,
    });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof Error && error.message === "COMPLIANCE_ITEM_NOT_FOUND") {
      return NextResponse.json(
        { error: "The selected compliance item is not part of the active verified source batch." },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_NOT_FOUND") {
      return NextResponse.json(
        { error: "The selected evidence document is not part of this governed fund and verified source batch." },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_FILE_REQUIRED") {
      return NextResponse.json(
        { error: "The selected evidence record does not have a governed stored file." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the Compliance workflow.",
      },
      { status: 500 }
    );
  }
}

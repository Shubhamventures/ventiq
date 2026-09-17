import { NextRequest, NextResponse } from "next/server";

import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
  requireGovernedFundAal2,
  type GovernedFundActor,
} from "../../../../lib/server/governedFundAccess";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_KINDS = new Set(["Excel", "CSV", "Migration", "Manual", "API"]);
const RELATIONSHIPS = [
  "Investor",
  "Authorised Representative",
  "Advisor",
  "Family Office User",
  "Institutional User",
  "Broker",
  "Intermediary",
] as const;

const RELATIONSHIP_LOOKUP = new Map(
  RELATIONSHIPS.map((value) => [value.toLowerCase(), value])
);

const MAX_STAGE_ROWS = 2000;
const AUTH_SCAN_PAGE_SIZE = 1000;
const AUTH_SCAN_MAX_PAGES = 50;

type DataRow = Record<string, any>;

type StageInputRow = {
  sourceRowNumber?: number;
  fundName?: string;
  investorCode?: string;
  legalInvestorName?: string;
  contactName?: string;
  contactEmail?: string;
  relationshipType?: string;
  canViewProfile?: boolean;
  canViewFinancials?: boolean;
  canViewDocuments?: boolean;
  canDownloadDocuments?: boolean;
  canUseDataRoom?: boolean;
  canSubmitQuestions?: boolean;
};

type EditableFund = {
  id: string;
  fundName: string;
};

type IdentityResolution = {
  resolution: "New User" | "Existing User" | "Conflict";
  userId: string | null;
  warnings: string[];
};

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeKey(value: unknown) {
  return normalizeText(value, 500).replace(/\s+/g, " ").toLowerCase();
}

function normalizeEmail(value: unknown) {
  return normalizeText(value, 320).toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRelationship(value: unknown) {
  const key = normalizeKey(value || "Investor");
  return RELATIONSHIP_LOOKUP.get(key) || "";
}

function normalizeSha256(value: unknown) {
  const text = normalizeText(value, 64).toUpperCase();
  if (!text) return null;
  if (!/^[A-F0-9]{64}$/.test(text)) {
    throw new Error("INVALID_SOURCE_SHA256");
  }
  return text;
}

function getBoolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function chunk<T>(rows: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

async function loadAuthorisedContext(request: NextRequest) {
  const actor = await authenticateGovernedFundUser(request);
  requireGovernedFundAal2(actor);
  const governedFunds = await listGovernedFunds(actor);
  const editableFunds = governedFunds.filter((fund) => fund.can_edit);

  if (editableFunds.length === 0) {
    throw new Error("ONBOARDING_EDIT_ACCESS_REQUIRED");
  }

  return { actor, editableFunds };
}

async function loadBatch(batchId: string, actor: GovernedFundActor) {
  const { data, error } = await supabaseAdmin
    .from("ventiq_onboarding_batches")
    .select("*")
    .eq("id", batchId)
    .eq("organisation_id", actor.organisationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load onboarding batch: ${error.message}`);
  }

  if (!data) {
    throw new Error("ONBOARDING_BATCH_NOT_FOUND");
  }

  return data as DataRow;
}

async function loadBatchSnapshot(batchId: string, actor: GovernedFundActor) {
  const batch = await loadBatch(batchId, actor);

  const [rowsResult, invitationsResult] = await Promise.all([
    supabaseAdmin
      .from("ventiq_onboarding_rows")
      .select("*")
      .eq("batch_id", batchId)
      .eq("organisation_id", actor.organisationId)
      .order("source_row_number", { ascending: true }),
    supabaseAdmin
      .from("ventiq_onboarding_invitations")
      .select("*")
      .eq("batch_id", batchId)
      .eq("organisation_id", actor.organisationId)
      .order("invitee_email", { ascending: true }),
  ]);

  if (rowsResult.error) {
    throw new Error(`Unable to load onboarding rows: ${rowsResult.error.message}`);
  }

  if (invitationsResult.error) {
    throw new Error(
      `Unable to load onboarding invitations: ${invitationsResult.error.message}`
    );
  }

  const invitationIds = (invitationsResult.data || [])
    .map((row: DataRow) => normalizeText(row.id, 100))
    .filter(Boolean);

  let invitationRows: DataRow[] = [];
  if (invitationIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("ventiq_onboarding_invitation_rows")
      .select("invitation_id,onboarding_row_id,created_at")
      .in("invitation_id", invitationIds);

    if (error) {
      throw new Error(`Unable to load invitation-row links: ${error.message}`);
    }

    invitationRows = (data || []) as DataRow[];
  }

  return {
    batch,
    rows: (rowsResult.data || []) as DataRow[],
    invitations: (invitationsResult.data || []) as DataRow[],
    invitationRows,
  };
}

async function auditEvent(
  actor: GovernedFundActor,
  batchId: string,
  eventType: string,
  eventTitle: string,
  eventDescription: string,
  riskLevel = "Medium"
) {
  const { error } = await supabaseAdmin.from("ventiq_enterprise_audit_logs").insert({
    organisation_id: actor.organisationId,
    source_module: "Fund Onboarding",
    linked_record_id: batchId,
    linked_record_type: "Stakeholder Access",
    event_type: eventType,
    event_title: eventTitle,
    event_description: eventDescription,
    actor_name: actor.fullName,
    actor_email: actor.email,
    actor_role: actor.role || "fund_admin",
    event_status: "Recorded",
    risk_level: riskLevel,
  });

  if (error) {
    console.error("VENTIQ institutional onboarding audit failed:", error.message);
  }
}

async function resolveEditableFunds(
  requestedFundNames: string[],
  actor: GovernedFundActor,
  editableFundAccess: Array<{ fund_name: string; can_edit: boolean }>
) {
  const accessByKey = new Map(
    editableFundAccess
      .filter((fund) => fund.can_edit)
      .map((fund) => [normalizeKey(fund.fund_name), normalizeText(fund.fund_name, 240)])
  );

  const canonicalNames = Array.from(
    new Set(
      requestedFundNames.map((name) => {
        const key = normalizeKey(name);
        const canonical = accessByKey.get(key);
        if (!canonical) {
          throw new Error(`FUND_EDIT_ACCESS_REQUIRED:${normalizeText(name, 240)}`);
        }
        return canonical;
      })
    )
  );

  const { data, error } = await supabaseAdmin
    .from("ventiq_funds")
    .select("id,fund_name")
    .in("fund_name", canonicalNames);

  if (error) {
    throw new Error(`Unable to resolve governed funds: ${error.message}`);
  }

  const grouped = new Map<string, EditableFund[]>();
  for (const row of data || []) {
    const fundName = normalizeText(row.fund_name, 240);
    const key = normalizeKey(fundName);
    const list = grouped.get(key) || [];
    list.push({ id: normalizeText(row.id, 100), fundName });
    grouped.set(key, list);
  }

  const result = new Map<string, EditableFund>();
  for (const canonicalName of canonicalNames) {
    const matches = grouped.get(normalizeKey(canonicalName)) || [];
    if (matches.length !== 1 || !matches[0].id) {
      throw new Error(`CANONICAL_FUND_RESOLUTION_FAILED:${canonicalName}`);
    }
    result.set(normalizeKey(canonicalName), matches[0]);
  }

  return result;
}

async function createBatch(
  actor: GovernedFundActor,
  body: Record<string, unknown>
) {
  const batchName = normalizeText(body.batchName, 240);
  const sourceKind = normalizeText(body.sourceKind, 40) || "Excel";
  const sourceFileName = normalizeText(body.sourceFileName, 500) || null;
  const sourceFileSha256 = normalizeSha256(body.sourceFileSha256);

  if (!batchName) {
    return NextResponse.json({ error: "Batch name is required." }, { status: 400 });
  }

  if (!SOURCE_KINDS.has(sourceKind)) {
    return NextResponse.json({ error: "Invalid source kind." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("ventiq_onboarding_batches")
    .insert({
      organisation_id: actor.organisationId,
      batch_name: batchName,
      source_kind: sourceKind,
      source_file_name: sourceFileName,
      source_file_sha256: sourceFileSha256,
      status: "Draft",
      created_by: actor.userId,
    })
    .select("*")
    .single();

  if (error) {
    if (String(error.code || "") === "23505") {
      return NextResponse.json(
        {
          error:
            "This source has already been staged for the active organisation. Duplicate source hashes are blocked.",
        },
        { status: 409 }
      );
    }
    throw new Error(`Unable to create onboarding batch: ${error.message}`);
  }

  await auditEvent(
    actor,
    String(data.id),
    "Institutional Onboarding Batch Created",
    "Institutional onboarding batch created",
    `${batchName} was created as a governed Draft batch.`
  );

  return NextResponse.json({ ok: true, batch: data }, { status: 201 });
}

async function stageRows(
  actor: GovernedFundActor,
  editableFundAccess: Array<{ fund_name: string; can_edit: boolean }>,
  body: Record<string, unknown>
) {
  const batchId = normalizeText(body.batchId, 100);
  const inputRows = Array.isArray(body.rows) ? (body.rows as StageInputRow[]) : [];

  if (!batchId) {
    return NextResponse.json({ error: "batchId is required." }, { status: 400 });
  }

  if (inputRows.length === 0 || inputRows.length > MAX_STAGE_ROWS) {
    return NextResponse.json(
      { error: `rows must contain between 1 and ${MAX_STAGE_ROWS} records.` },
      { status: 400 }
    );
  }

  const batch = await loadBatch(batchId, actor);
  const batchStatus = normalizeText(batch.status, 80);
  if (batchStatus !== "Draft") {
    return NextResponse.json(
      { error: `Only Draft batches can receive staged rows (current status: ${batchStatus}).` },
      { status: 409 }
    );
  }

  const { count, error: existingError } = await supabaseAdmin
    .from("ventiq_onboarding_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .eq("organisation_id", actor.organisationId);

  if (existingError) {
    throw new Error(`Unable to inspect existing staged rows: ${existingError.message}`);
  }

  if ((count || 0) > 0) {
    return NextResponse.json(
      {
        error:
          "This Draft batch already contains staged rows. Create a new batch instead of replacing governed source rows.",
      },
      { status: 409 }
    );
  }

  const seenSourceRows = new Set<number>();
  const normalized = inputRows.map((input, index) => {
    const sourceRowNumber = Number.isInteger(input.sourceRowNumber)
      ? Number(input.sourceRowNumber)
      : index + 1;
    const fundName = normalizeText(input.fundName, 240);
    const investorCode = normalizeText(input.investorCode, 160);
    const legalInvestorName = normalizeText(input.legalInvestorName, 300);
    const contactEmail = normalizeEmail(input.contactEmail);
    const contactName = normalizeText(input.contactName, 240) || null;
    const relationshipType = normalizeRelationship(input.relationshipType);

    if (sourceRowNumber <= 0 || seenSourceRows.has(sourceRowNumber)) {
      throw new Error(`INVALID_SOURCE_ROW_NUMBER:${sourceRowNumber}`);
    }
    seenSourceRows.add(sourceRowNumber);

    if (!fundName || !investorCode || !legalInvestorName || !contactEmail) {
      throw new Error(`REQUIRED_STAGE_FIELD_MISSING:${sourceRowNumber}`);
    }

    if (!relationshipType) {
      throw new Error(`INVALID_RELATIONSHIP_TYPE:${sourceRowNumber}`);
    }

    return {
      sourceRowNumber,
      fundName,
      investorCode,
      legalInvestorName,
      contactEmail,
      contactName,
      relationshipType,
      canViewProfile: getBoolean(input.canViewProfile),
      canViewFinancials: getBoolean(input.canViewFinancials),
      canViewDocuments: getBoolean(input.canViewDocuments),
      canDownloadDocuments: getBoolean(input.canDownloadDocuments),
      canUseDataRoom: getBoolean(input.canUseDataRoom),
      canSubmitQuestions: getBoolean(input.canSubmitQuestions),
    };
  });

  const fundMap = await resolveEditableFunds(
    normalized.map((row) => row.fundName),
    actor,
    editableFundAccess
  );

  const insertRows = normalized.map((row) => {
    const fund = fundMap.get(normalizeKey(row.fundName));
    if (!fund) {
      throw new Error(`CANONICAL_FUND_RESOLUTION_FAILED:${row.fundName}`);
    }

    return {
      batch_id: batchId,
      organisation_id: actor.organisationId,
      source_row_number: row.sourceRowNumber,
      fund_id: fund.id,
      fund_name: fund.fundName,
      investor_master_id: null,
      investor_code: row.investorCode,
      legal_investor_name: row.legalInvestorName,
      contact_name: row.contactName,
      contact_email: row.contactEmail,
      relationship_type: row.relationshipType,
      desired_role: "investor",
      can_view_profile: row.canViewProfile,
      can_view_financials: row.canViewFinancials,
      can_view_documents: row.canViewDocuments,
      can_download_documents: row.canDownloadDocuments,
      can_use_data_room: row.canUseDataRoom,
      can_submit_questions: row.canSubmitQuestions,
      identity_resolution: "Pending",
      existing_auth_user_id: null,
      validation_status: "Staged",
      validation_errors: [],
      validation_warnings: [],
      action_plan: "Review",
      row_status: "Staged",
    };
  });

  for (const rowChunk of chunk(insertRows, 250)) {
    const { error } = await supabaseAdmin
      .from("ventiq_onboarding_rows")
      .insert(rowChunk);
    if (error) {
      throw new Error(`Unable to stage onboarding rows: ${error.message}`);
    }
  }

  const { error: batchUpdateError } = await supabaseAdmin
    .from("ventiq_onboarding_batches")
    .update({
      total_rows: insertRows.length,
      valid_rows: 0,
      review_rows: insertRows.length,
      duplicate_rows: 0,
      existing_user_rows: 0,
      status: "Draft",
    })
    .eq("id", batchId)
    .eq("organisation_id", actor.organisationId)
    .eq("status", "Draft");

  if (batchUpdateError) {
    throw new Error(`Unable to update onboarding batch counts: ${batchUpdateError.message}`);
  }

  await auditEvent(
    actor,
    batchId,
    "Institutional Onboarding Rows Staged",
    "Institutional onboarding rows staged",
    `${insertRows.length} source row(s) were staged. No user, entitlement, or invitation was activated.`
  );

  return NextResponse.json({ ok: true, stagedRows: insertRows.length });
}

async function loadIdentityResolutions(emails: string[]) {
  const targetEmails = new Set(emails.map(normalizeEmail).filter(Boolean));
  const userIdsByEmail = new Map<string, Set<string>>();
  const profileStatusByUserId = new Map<string, string>();

  if (targetEmails.size === 0) return { userIdsByEmail, profileStatusByUserId };

  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("ventiq_user_profiles")
    .select("user_id,email,status")
    .in("email", Array.from(targetEmails));

  if (profileError) {
    throw new Error(`Unable to resolve existing VENTIQ profiles: ${profileError.message}`);
  }

  for (const profile of profiles || []) {
    const email = normalizeEmail(profile.email);
    const userId = normalizeText(profile.user_id, 100);
    if (!email || !userId || !targetEmails.has(email)) continue;
    const set = userIdsByEmail.get(email) || new Set<string>();
    set.add(userId);
    userIdsByEmail.set(email, set);
    profileStatusByUserId.set(userId, normalizeText(profile.status, 80));
  }

  const unresolved = new Set(
    Array.from(targetEmails).filter((email) => !userIdsByEmail.has(email))
  );

  for (let page = 1; page <= AUTH_SCAN_MAX_PAGES && unresolved.size > 0; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: AUTH_SCAN_PAGE_SIZE,
    });

    if (error) {
      throw new Error(`Unable to resolve existing auth users: ${error.message}`);
    }

    const users = data?.users || [];
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (!email || !unresolved.has(email)) continue;
      const set = userIdsByEmail.get(email) || new Set<string>();
      set.add(String(user.id));
      userIdsByEmail.set(email, set);
    }

    for (const email of Array.from(unresolved)) {
      if (userIdsByEmail.has(email)) unresolved.delete(email);
    }

    if (users.length < AUTH_SCAN_PAGE_SIZE) break;
  }

  return { userIdsByEmail, profileStatusByUserId };
}

function resolveIdentity(
  email: string,
  userIdsByEmail: Map<string, Set<string>>,
  profileStatusByUserId: Map<string, string>
): IdentityResolution {
  const ids = Array.from(userIdsByEmail.get(email) || []);
  if (ids.length === 0) {
    return { resolution: "New User", userId: null, warnings: [] };
  }

  if (ids.length > 1) {
    return {
      resolution: "Conflict",
      userId: null,
      warnings: ["IDENTITY_EMAIL_RESOLVES_TO_MULTIPLE_USERS"],
    };
  }

  const userId = ids[0];
  const profileStatus = normalizeKey(profileStatusByUserId.get(userId));
  const warnings =
    profileStatus && profileStatus !== "active" ? ["EXISTING_PROFILE_NOT_ACTIVE"] : [];

  return { resolution: "Existing User", userId, warnings };
}

function capabilitiesMatch(entitlement: DataRow, row: DataRow) {
  return (
    normalizeText(entitlement.relationship_type, 80) ===
      normalizeText(row.relationship_type, 80) &&
    Boolean(entitlement.can_view_profile) === Boolean(row.can_view_profile) &&
    Boolean(entitlement.can_view_financials) === Boolean(row.can_view_financials) &&
    Boolean(entitlement.can_view_documents) === Boolean(row.can_view_documents) &&
    Boolean(entitlement.can_download_documents) === Boolean(row.can_download_documents) &&
    Boolean(entitlement.can_use_data_room) === Boolean(row.can_use_data_room) &&
    Boolean(entitlement.can_submit_questions) === Boolean(row.can_submit_questions)
  );
}

async function validateBatch(
  actor: GovernedFundActor,
  editableFundAccess: Array<{ fund_name: string; can_edit: boolean }>,
  body: Record<string, unknown>
) {
  const batchId = normalizeText(body.batchId, 100);
  if (!batchId) {
    return NextResponse.json({ error: "batchId is required." }, { status: 400 });
  }

  const batch = await loadBatch(batchId, actor);
  const batchStatus = normalizeText(batch.status, 80);
  if (!["Draft", "Validated"].includes(batchStatus)) {
    return NextResponse.json(
      { error: `Batch cannot be validated from status ${batchStatus}.` },
      { status: 409 }
    );
  }

  const { data: stagedRows, error: rowsError } = await supabaseAdmin
    .from("ventiq_onboarding_rows")
    .select("*")
    .eq("batch_id", batchId)
    .eq("organisation_id", actor.organisationId)
    .order("source_row_number", { ascending: true });

  if (rowsError) {
    throw new Error(`Unable to load staged onboarding rows: ${rowsError.message}`);
  }

  const rows = (stagedRows || []) as DataRow[];
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "The onboarding batch has no staged rows." },
      { status: 409 }
    );
  }

  const editableByKey = new Set(
    editableFundAccess
      .filter((fund) => fund.can_edit)
      .map((fund) => normalizeKey(fund.fund_name))
  );

  for (const row of rows) {
    if (!editableByKey.has(normalizeKey(row.fund_name))) {
      throw new Error(`FUND_EDIT_ACCESS_REQUIRED:${normalizeText(row.fund_name, 240)}`);
    }
  }

  const fundNames = Array.from(new Set(rows.map((row) => normalizeText(row.fund_name, 240))));
  const { data: investorRows, error: investorError } = await supabaseAdmin
    .from("investor_master")
    .select("id,fund_name,investor_code,investor_name,email")
    .in("fund_name", fundNames);

  if (investorError) {
    throw new Error(`Unable to resolve investor master records: ${investorError.message}`);
  }

  const investorByKey = new Map<string, DataRow[]>();
  for (const investor of investorRows || []) {
    const key = `${normalizeKey(investor.fund_name)}|${normalizeKey(investor.investor_code)}`;
    const list = investorByKey.get(key) || [];
    list.push(investor as DataRow);
    investorByKey.set(key, list);
  }

  const emails = Array.from(new Set(rows.map((row) => normalizeEmail(row.contact_email))));
  const { userIdsByEmail, profileStatusByUserId } = await loadIdentityResolutions(emails);

  const existingUserIds = Array.from(
    new Set(
      Array.from(userIdsByEmail.values())
        .flatMap((set) => Array.from(set))
        .filter(Boolean)
    )
  );

  let investorAccessRows: DataRow[] = [];
  let fundAccessRows: DataRow[] = [];

  if (existingUserIds.length > 0) {
    const [investorAccessResult, fundAccessResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_user_investor_access")
        .select(
          "id,organisation_id,user_id,fund_name,investor_code,relationship_type,can_view_profile,can_view_financials,can_view_documents,can_download_documents,can_use_data_room,can_submit_questions,status"
        )
        .eq("organisation_id", actor.organisationId)
        .in("user_id", existingUserIds),
      supabaseAdmin
        .from("ventiq_user_fund_access")
        .select("id,organisation_id,user_id,fund_name,can_view,status")
        .eq("organisation_id", actor.organisationId)
        .in("user_id", existingUserIds),
    ]);

    if (investorAccessResult.error) {
      throw new Error(
        `Unable to inspect investor entitlements: ${investorAccessResult.error.message}`
      );
    }
    if (fundAccessResult.error) {
      throw new Error(
        `Unable to inspect fund entitlements: ${fundAccessResult.error.message}`
      );
    }

    investorAccessRows = (investorAccessResult.data || []) as DataRow[];
    fundAccessRows = (fundAccessResult.data || []) as DataRow[];
  }

  const duplicateKeySeen = new Set<string>();
  const computed: Array<{
    row: DataRow;
    update: Record<string, unknown>;
  }> = [];

  for (const row of rows) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const email = normalizeEmail(row.contact_email);
    const investorKey = `${normalizeKey(row.fund_name)}|${normalizeKey(row.investor_code)}`;
    const duplicateKey = `${investorKey}|${email}`;

    let validationStatus: "Valid" | "Review Required" | "Invalid" = "Valid";
    let actionPlan: "Review" | "Create Account" | "Add Entitlement" | "No Change" | "Exclude" = "Review";
    let rowStatus: "Staged" | "Ready" | "Excluded" = "Staged";
    let investorMasterId: string | null = null;

    if (duplicateKeySeen.has(duplicateKey)) {
      errors.push("DUPLICATE_BATCH_ENTITLEMENT_ROW");
      validationStatus = "Invalid";
      actionPlan = "Exclude";
      rowStatus = "Excluded";
    } else {
      duplicateKeySeen.add(duplicateKey);
    }

    if (!isValidEmail(email)) {
      errors.push("INVALID_CONTACT_EMAIL");
      validationStatus = "Invalid";
    }

    const investorMatches = investorByKey.get(investorKey) || [];
    if (investorMatches.length === 0) {
      warnings.push("INVESTOR_MASTER_NOT_FOUND");
      if (validationStatus !== "Invalid") validationStatus = "Review Required";
    } else if (investorMatches.length > 1) {
      errors.push("INVESTOR_MASTER_AMBIGUOUS");
      validationStatus = "Invalid";
    } else {
      const investor = investorMatches[0];
      investorMasterId = normalizeText(investor.id, 100) || null;

      if (normalizeKey(investor.investor_name) !== normalizeKey(row.legal_investor_name)) {
        warnings.push("INVESTOR_NAME_MISMATCH");
        if (validationStatus !== "Invalid") validationStatus = "Review Required";
      }

      if (
        normalizeText(row.relationship_type, 80) === "Investor" &&
        normalizeEmail(investor.email) &&
        normalizeEmail(investor.email) !== email
      ) {
        warnings.push("INVESTOR_EMAIL_MISMATCH");
        if (validationStatus !== "Invalid") validationStatus = "Review Required";
      }
    }

    const identity = resolveIdentity(email, userIdsByEmail, profileStatusByUserId);
    warnings.push(...identity.warnings);
    if (identity.resolution === "Conflict") {
      validationStatus = "Invalid";
      errors.push("IDENTITY_CONFLICT");
    }
    if (identity.warnings.includes("EXISTING_PROFILE_NOT_ACTIVE") && validationStatus === "Valid") {
      validationStatus = "Review Required";
    }

    if (validationStatus === "Valid") {
      if (identity.resolution === "New User") {
        actionPlan = "Create Account";
      } else if (identity.resolution === "Existing User" && identity.userId) {
        const hasActiveFundAccess = fundAccessRows.some(
          (access) =>
            normalizeText(access.user_id, 100) === identity.userId &&
            normalizeKey(access.fund_name) === normalizeKey(row.fund_name) &&
            normalizeKey(access.status) === "active" &&
            Boolean(access.can_view)
        );

        const matchingInvestorAccess = investorAccessRows.find(
          (access) =>
            normalizeText(access.user_id, 100) === identity.userId &&
            normalizeKey(access.fund_name) === normalizeKey(row.fund_name) &&
            normalizeKey(access.investor_code) === normalizeKey(row.investor_code) &&
            normalizeKey(access.status) === "active"
        );

        actionPlan =
          hasActiveFundAccess &&
          matchingInvestorAccess &&
          capabilitiesMatch(matchingInvestorAccess, row)
            ? "No Change"
            : "Add Entitlement";
      }

      rowStatus = "Ready";
    } else if (actionPlan !== "Exclude") {
      actionPlan = "Review";
      rowStatus = "Staged";
    }

    computed.push({
      row,
      update: {
        investor_master_id: investorMasterId,
        identity_resolution: identity.resolution,
        existing_auth_user_id: identity.userId,
        validation_status: validationStatus,
        validation_errors: errors,
        validation_warnings: Array.from(new Set(warnings)),
        action_plan: actionPlan,
        row_status: rowStatus,
      },
    });
  }

  for (const item of computed) {
    const { error } = await supabaseAdmin
      .from("ventiq_onboarding_rows")
      .update(item.update)
      .eq("id", item.row.id)
      .eq("batch_id", batchId)
      .eq("organisation_id", actor.organisationId);

    if (error) {
      throw new Error(
        `Unable to persist validation for source row ${item.row.source_row_number}: ${error.message}`
      );
    }
  }

  const { error: invitationDeleteError } = await supabaseAdmin
    .from("ventiq_onboarding_invitations")
    .delete()
    .eq("batch_id", batchId)
    .eq("organisation_id", actor.organisationId)
    .eq("invitation_status", "Draft");

  if (invitationDeleteError) {
    throw new Error(`Unable to rebuild draft invitations: ${invitationDeleteError.message}`);
  }

  const actionable = computed.filter(
    (item) =>
      item.update.validation_status === "Valid" &&
      item.update.row_status === "Ready" &&
      item.update.action_plan !== "No Change"
  );

  const byEmail = new Map<string, typeof actionable>();
  for (const item of actionable) {
    const email = normalizeEmail(item.row.contact_email);
    const list = byEmail.get(email) || [];
    list.push(item);
    byEmail.set(email, list);
  }

  const invitationPayloads = Array.from(byEmail.entries()).map(([email, items]) => ({
    batch_id: batchId,
    organisation_id: actor.organisationId,
    invitee_email: email,
    invitee_name:
      normalizeText(items.find((item) => item.row.contact_name)?.row.contact_name, 240) ||
      normalizeText(items[0]?.row.legal_investor_name, 240) ||
      null,
    auth_user_id:
      normalizeText(items.find((item) => item.update.existing_auth_user_id)?.update.existing_auth_user_id, 100) ||
      null,
    invitation_status: "Draft",
  }));

  let invitations: DataRow[] = [];
  if (invitationPayloads.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("ventiq_onboarding_invitations")
      .insert(invitationPayloads)
      .select("*");

    if (error) {
      throw new Error(`Unable to create draft invitation identities: ${error.message}`);
    }
    invitations = (data || []) as DataRow[];
  }

  const invitationByEmail = new Map(
    invitations.map((invitation) => [
      normalizeEmail(invitation.invitee_email),
      normalizeText(invitation.id, 100),
    ])
  );

  const invitationRowPayloads = actionable
    .map((item) => {
      const invitationId = invitationByEmail.get(normalizeEmail(item.row.contact_email));
      return invitationId
        ? { invitation_id: invitationId, onboarding_row_id: item.row.id }
        : null;
    })
    .filter(Boolean) as Array<{ invitation_id: string; onboarding_row_id: string }>;

  if (invitationRowPayloads.length > 0) {
    const { error } = await supabaseAdmin
      .from("ventiq_onboarding_invitation_rows")
      .insert(invitationRowPayloads);

    if (error) {
      throw new Error(`Unable to link draft invitations to onboarding rows: ${error.message}`);
    }
  }

  const validRows = computed.filter((item) => item.update.validation_status === "Valid").length;
  const duplicateRows = computed.filter((item) => item.update.action_plan === "Exclude").length;
  const reviewRows = computed.filter(
    (item) =>
      item.update.validation_status === "Review Required" ||
      item.update.validation_status === "Invalid"
  ).length;
  const existingUserRows = computed.filter(
    (item) => item.update.identity_resolution === "Existing User"
  ).length;

  const { error: batchUpdateError } = await supabaseAdmin
    .from("ventiq_onboarding_batches")
    .update({
      total_rows: rows.length,
      valid_rows: validRows,
      review_rows: reviewRows,
      duplicate_rows: duplicateRows,
      existing_user_rows: existingUserRows,
      status: "Validated",
    })
    .eq("id", batchId)
    .eq("organisation_id", actor.organisationId)
    .in("status", ["Draft", "Validated"]);

  if (batchUpdateError) {
    throw new Error(`Unable to finalise batch validation: ${batchUpdateError.message}`);
  }

  await auditEvent(
    actor,
    batchId,
    "Institutional Onboarding Batch Validated",
    "Institutional onboarding batch validated",
    `${rows.length} row(s) validated: ${validRows} valid, ${reviewRows} review/invalid, ${duplicateRows} duplicate/excluded, ${existingUserRows} existing-user row(s), ${invitations.length} draft invitation identity record(s). No email was sent and no entitlement was activated.`
  );

  return NextResponse.json({
    ok: true,
    ...(await loadBatchSnapshot(batchId, actor)),
  });
}

function domainErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "ONBOARDING_EDIT_ACCESS_REQUIRED" || message.startsWith("FUND_EDIT_ACCESS_REQUIRED:")) {
    return NextResponse.json(
      { error: "You do not have governed edit access for every fund in this onboarding request." },
      { status: 403 }
    );
  }

  if (message === "ONBOARDING_BATCH_NOT_FOUND") {
    return NextResponse.json({ error: "Onboarding batch not found." }, { status: 404 });
  }

  if (
    message.startsWith("REQUIRED_STAGE_FIELD_MISSING:") ||
    message.startsWith("INVALID_SOURCE_ROW_NUMBER:") ||
    message.startsWith("INVALID_RELATIONSHIP_TYPE:") ||
    message === "INVALID_SOURCE_SHA256"
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (message.startsWith("CANONICAL_FUND_RESOLUTION_FAILED:")) {
    return NextResponse.json(
      { error: `Unable to resolve an exact canonical fund: ${message.split(":").slice(1).join(":")}` },
      { status: 409 }
    );
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { actor } = await loadAuthorisedContext(request);
    const batchId = normalizeText(request.nextUrl.searchParams.get("batchId"), 100);

    if (batchId) {
      return NextResponse.json({ ok: true, ...(await loadBatchSnapshot(batchId, actor)) });
    }

    const { data, error } = await supabaseAdmin
      .from("ventiq_onboarding_batches")
      .select("*")
      .eq("organisation_id", actor.organisationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Unable to load onboarding batches: ${error.message}`);
    }

    return NextResponse.json({ ok: true, batches: data || [] });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const domainResponse = domainErrorResponse(error);
    if (domainResponse) return domainResponse;

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Institutional onboarding load failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actor, editableFunds } = await loadAuthorisedContext(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const action = normalizeText(body.action, 60);

    if (action === "create_batch") {
      return await createBatch(actor, body);
    }

    if (action === "stage_rows") {
      return await stageRows(actor, editableFunds, body);
    }

    if (action === "validate_batch") {
      return await validateBatch(actor, editableFunds, body);
    }

    return NextResponse.json({ error: "Unsupported onboarding action." }, { status: 400 });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const domainResponse = domainErrorResponse(error);
    if (domainResponse) return domainResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Institutional onboarding staging action failed.",
      },
      { status: 500 }
    );
  }
}

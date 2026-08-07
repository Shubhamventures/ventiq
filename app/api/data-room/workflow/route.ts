import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
  "investor",
]);

const EDIT_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
  "checker",
]);

const ENGAGEMENT_ACTIONS = new Set([
  "Viewed",
  "Downloaded",
  "Asked Question",
]);

const QUESTION_STATUSES = new Set([
  "Open",
  "Needs Internal Review",
  "Answered",
]);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type SupabaseAdmin = ReturnType<typeof createClient<any, "public", any>>;
type AccessMode = "view" | "edit";

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  investorCodes: string[];
  canSubmitQuestions: boolean;
  canUseDataRoom: boolean;
};

type SourceBatch = {
  id: string;
  fund_name: string;
  batch_name: string | null;
  processing_status: string | null;
  processed_at: string | null;
};

type DataRow = Record<string, unknown>;

type InvestorIdentity = {
  investorCode: string;
  investorName: string;
  investorEmail: string;
};

function getSupabaseAdmin(): SupabaseAdmin | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }) as SupabaseAdmin;
}

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeLimitedText(value: unknown, maxLength: number) {
  return normalizeText(value).slice(0, maxLength);
}

function normalizeOptionalUuid(value: unknown) {
  const text = normalizeText(value);

  if (!text) return "";

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(text)) {
    throw new Error("INVALID_UUID");
  }

  return text;
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

async function authoriseRequest(
  request: NextRequest,
  supabase: SupabaseAdmin,
  fundName: string,
  mode: AccessMode
): Promise<AuthorisedUser> {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }

  const {
    data: userResult,
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  const user = userResult?.user;

  if (userError || !user) {
    throw new Error("INVALID_SESSION");
  }

  const {
    data: rawProfile,
    error: profileError,
  } = await supabase
    .from("ventiq_user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `Unable to load VENTIQ profile: ${profileError.message}`
    );
  }

  const profile = rawProfile as unknown as DataRow | null;

  if (!profile || normalizeText(profile.status) !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  const allowedRoles = mode === "edit" ? EDIT_ROLES : VIEW_ROLES;
  let role = normalizeText(profile.default_role);

  if (!allowedRoles.has(role)) {
    const {
      data: rawMembership,
      error: membershipError,
    } = await supabase
      .from("ventiq_organisation_members")
      .select("*")
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

    const membership = rawMembership as unknown as DataRow | null;
    role = normalizeText(membership?.role);
  }

  if (!allowedRoles.has(role)) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  if (role !== "fund_admin") {
    const {
      data: rawFundAccess,
      error: fundAccessError,
    } = await supabase
      .from("ventiq_user_fund_access")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify fund access: ${fundAccessError.message}`
      );
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;
    const canView = Boolean(fundAccess?.can_view);
    const canEdit = Boolean(fundAccess?.can_edit);

    if (!canView || (mode === "edit" && !canEdit)) {
      throw new Error(
        mode === "edit"
          ? "FUND_EDIT_ACCESS_REQUIRED"
          : "FUND_VIEW_ACCESS_REQUIRED"
      );
    }
  }

  let investorCodes: string[] = [];
  let canSubmitQuestions = role !== "investor";
  let canUseDataRoom = role !== "investor";

  if (role === "investor") {
    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("ventiq_user_investor_access")
      .select(
        "investor_code,status,expires_at,can_use_data_room,can_submit_questions"
      )
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName);

    if (entitlementError) {
      throw new Error(
        `Unable to verify investor workflow entitlement: ${entitlementError.message}`
      );
    }

    const now = Date.now();
    const activeEntitlements = (entitlementRows ?? []).filter((row: any) => {
      if (!row?.expires_at) return true;
      const expiry = Date.parse(String(row.expires_at));
      return Number.isFinite(expiry) && expiry > now;
    });

    investorCodes = Array.from(
      new Set(
        activeEntitlements
          .filter((row: any) => Boolean(row?.can_use_data_room))
          .map((row: any) => normalizeText(row?.investor_code))
          .filter(Boolean)
      )
    );

    canUseDataRoom = investorCodes.length > 0;
    canSubmitQuestions = activeEntitlements.some(
      (row: any) =>
        Boolean(row?.can_use_data_room) &&
        Boolean(row?.can_submit_questions) &&
        investorCodes.some(
          (code) =>
            code.toLowerCase() ===
            normalizeText(row?.investor_code).toLowerCase()
        )
    );

    if (!canUseDataRoom) {
      throw new Error("INVESTOR_DATA_ROOM_ACCESS_REQUIRED");
    }
  }

  return {
    userId: String(user.id),
    email: normalizeText(profile.email) || normalizeText(user.email),
    fullName:
      normalizeText(profile.full_name) ||
      normalizeText(user.email) ||
      "VENTIQ User",
    role,
    investorCodes,
    canSubmitQuestions,
    canUseDataRoom,
  };
}

function assertInvestorCodeAllowed(
  user: AuthorisedUser,
  requestedInvestorCode: string
) {
  if (user.role !== "investor") return;

  const requested = normalizeText(requestedInvestorCode).toLowerCase();
  const allowed = new Set(
    user.investorCodes.map((code) => code.toLowerCase())
  );

  if (!requested || !allowed.has(requested)) {
    throw new Error("INVESTOR_ENTITLEMENT_REQUIRED");
  }
}

function canInvestorAccessDocument(
  user: AuthorisedUser,
  document: DataRow | null
) {
  if (user.role !== "investor") return true;
  if (!document) return true;

  const accessLevel = normalizeText(document.access_level).toLowerCase();
  const investorCode = normalizeText(document.investor_code).toLowerCase();
  const allowed = new Set(
    user.investorCodes.map((code) => code.toLowerCase())
  );

  if (accessLevel === "all lps" || accessLevel === "all investors") {
    return true;
  }

  if (accessLevel === "restricted lp access") {
    return Boolean(investorCode) && allowed.has(investorCode);
  }

  return false;
}

function getAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION"
  ) {
    return NextResponse.json(
      {
        error:
          "Please sign in before accessing the Investor Data Room workflow.",
      },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED" ||
    message === "FUND_VIEW_ACCESS_REQUIRED" ||
    message === "INVESTOR_DATA_ROOM_ACCESS_REQUIRED" ||
    message === "INVESTOR_ENTITLEMENT_REQUIRED" ||
    message === "INVESTOR_QUESTION_ACCESS_REQUIRED"
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to access the Investor Data Room workflow for this fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

function getValidationErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  const messages: Record<string, string> = {
    INVALID_UUID: "One of the supplied record identifiers is invalid.",
    INVALID_ACTION: "Select a valid LP engagement action.",
    INVALID_QUESTION_STATUS: "Select a valid DDQ question status.",
    QUESTION_REQUIRED: "Enter the LP or DDQ question.",
    ANSWER_REQUIRED: "Enter an answer before saving or approving it.",
    ASSIGNEE_REQUIRED: "Select or enter the person responsible for this question.",
    QUESTION_NOT_FOUND: "The requested DDQ question was not found.",
    DOCUMENT_NOT_FOUND:
      "The selected document was not found in the active fund and source batch.",
    INVESTOR_NOT_FOUND:
      "The selected investor was not found in the authoritative source batch.",
    SOURCE_BATCH_NOT_AVAILABLE:
      "No completed canonical source batch is available for this fund.",
    SOURCE_BATCH_NOT_FOUND:
      "The selected canonical source batch was not found.",
    SOURCE_BATCH_FUND_MISMATCH:
      "The selected source batch does not belong to the active fund.",
    SOURCE_BATCH_NOT_COMPLETED:
      "The selected source batch has not completed processing.",
  };

  if (!messages[message]) return null;

  const conflictErrors = new Set([
    "SOURCE_BATCH_NOT_AVAILABLE",
    "SOURCE_BATCH_NOT_FOUND",
    "SOURCE_BATCH_FUND_MISMATCH",
    "SOURCE_BATCH_NOT_COMPLETED",
    "QUESTION_NOT_FOUND",
    "DOCUMENT_NOT_FOUND",
    "INVESTOR_NOT_FOUND",
  ]);

  return NextResponse.json(
    { error: messages[message] },
    { status: conflictErrors.has(message) ? 409 : 400 }
  );
}

async function resolveSourceBatch(
  supabase: SupabaseAdmin,
  fundName: string,
  requestedSourceBatchId: string
): Promise<SourceBatch> {
  if (requestedSourceBatchId) {
    const {
      data: rawBatch,
      error,
    } = await supabase
      .from("migration_intake_batches")
      .select("*")
      .eq("id", requestedSourceBatchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load source batch: ${error.message}`);
    }

    const batch = rawBatch as unknown as DataRow | null;

    if (!batch) {
      throw new Error("SOURCE_BATCH_NOT_FOUND");
    }

    if (
      normalizeText(batch.fund_name).toLowerCase() !==
      fundName.toLowerCase()
    ) {
      throw new Error("SOURCE_BATCH_FUND_MISMATCH");
    }

    if (normalizeText(batch.processing_status) !== "Completed") {
      throw new Error("SOURCE_BATCH_NOT_COMPLETED");
    }

    return {
      id: normalizeText(batch.id),
      fund_name: normalizeText(batch.fund_name),
      batch_name: normalizeText(batch.batch_name) || null,
      processing_status:
        normalizeText(batch.processing_status) || null,
      processed_at: normalizeText(batch.processed_at) || null,
    };
  }

  const {
    data: rawBatch,
    error,
  } = await supabase
    .from("migration_intake_batches")
    .select("*")
    .ilike("fund_name", fundName)
    .eq("processing_status", "Completed")
    .ilike("intake_mode", "Canonical")
    .gt("total_rows", 0)
    .order("processed_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to resolve canonical source batch: ${error.message}`
    );
  }

  const batch = rawBatch as unknown as DataRow | null;

  if (!batch) {
    throw new Error("SOURCE_BATCH_NOT_AVAILABLE");
  }

  return {
    id: normalizeText(batch.id),
    fund_name: normalizeText(batch.fund_name),
    batch_name: normalizeText(batch.batch_name) || null,
    processing_status:
      normalizeText(batch.processing_status) || null,
    processed_at: normalizeText(batch.processed_at) || null,
  };
}

async function resolveDocument(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  documentId: string
): Promise<DataRow | null> {
  if (!documentId) return null;

  const {
    data: rawDocument,
    error,
  } = await supabase
    .from("data_room_documents")
    .select("*")
    .eq("id", documentId)
    .ilike("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load data room document: ${error.message}`
    );
  }

  const document = rawDocument as unknown as DataRow | null;

  if (!document) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  return document;
}

async function resolveInvestorIdentity(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  investorCodeInput: string,
  investorNameInput: string,
  investorEmailInput: string
): Promise<InvestorIdentity> {
  const investorCode = normalizeLimitedText(investorCodeInput, 120);

  if (!investorCode) {
    return {
      investorCode: "",
      investorName: normalizeLimitedText(investorNameInput, 250),
      investorEmail: normalizeLimitedText(investorEmailInput, 320),
    };
  }

  const {
    data: rawInvestor,
    error,
  } = await supabase
    .from("investor_master")
    .select("*")
    .ilike("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .eq("investor_code", investorCode)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load investor identity: ${error.message}`
    );
  }

  const investor = rawInvestor as unknown as DataRow | null;

  if (!investor) {
    throw new Error("INVESTOR_NOT_FOUND");
  }

  return {
    investorCode,
    investorName:
      normalizeText(investor.investor_name) ||
      normalizeLimitedText(investorNameInput, 250),
    investorEmail:
      normalizeText(investor.email) ||
      normalizeLimitedText(investorEmailInput, 320),
  };
}

async function loadQuestionForUpdate(
  supabase: SupabaseAdmin,
  fundName: string,
  sourceBatchId: string,
  questionId: string
): Promise<DataRow> {
  const {
    data: rawQuestion,
    error,
  } = await supabase
    .from("data_room_questions")
    .select("*")
    .eq("id", questionId)
    .ilike("fund_name", fundName)
    .eq("source_batch_id", sourceBatchId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load DDQ question: ${error.message}`);
  }

  const question = rawQuestion as unknown as DataRow | null;

  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  return question;
}

function getLimit(request: NextRequest) {
  const requested = Number(
    request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT
  );

  if (!Number.isFinite(requested)) return DEFAULT_LIMIT;

  return Math.min(Math.max(Math.trunc(requested), 1), MAX_LIMIT);
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName")
    );
    const requestedSourceBatchId = normalizeText(
      request.nextUrl.searchParams.get("sourceBatchId")
    );
    const investorCode = normalizeText(
      request.nextUrl.searchParams.get("investorCode")
    );
    const documentId = normalizeOptionalUuid(
      request.nextUrl.searchParams.get("documentId")
    );
    const status = normalizeText(
      request.nextUrl.searchParams.get("status")
    );
    const limit = getLimit(request);

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(request, supabase, fundName, "view");

    const sourceBatch = await resolveSourceBatch(
      supabase,
      fundName,
      requestedSourceBatchId
    );

    let engagementQuery: any = supabase
      .from("data_room_engagement_events")
      .select("*")
      .ilike("fund_name", fundName)
      .eq("source_batch_id", sourceBatch.id)
      .order("event_time", { ascending: false })
      .limit(limit);

    let questionQuery: any = supabase
      .from("data_room_questions")
      .select("*")
      .ilike("fund_name", fundName)
      .eq("source_batch_id", sourceBatch.id)
      .order("asked_at", { ascending: false })
      .limit(limit);

    if (user.role === "investor") {
      if (investorCode) {
        assertInvestorCodeAllowed(user, investorCode);
      }

      engagementQuery = engagementQuery.in(
        "investor_code",
        user.investorCodes
      );
      questionQuery = questionQuery.in(
        "investor_code",
        user.investorCodes
      );
    } else if (investorCode) {
      engagementQuery = engagementQuery.eq(
        "investor_code",
        investorCode
      );
      questionQuery = questionQuery.eq("investor_code", investorCode);
    }

    if (documentId) {
      engagementQuery = engagementQuery.eq(
        "document_id",
        documentId
      );
      questionQuery = questionQuery.eq("document_id", documentId);
    }

    if (status) {
      questionQuery = questionQuery.eq("status", status);
    }

    const [
      engagementResult,
      questionResult,
    ] = await Promise.all([
      engagementQuery,
      questionQuery,
    ]);

    if (engagementResult.error) {
      throw new Error(
        `Unable to load LP engagement events: ${engagementResult.error.message}`
      );
    }

    if (questionResult.error) {
      throw new Error(
        `Unable to load DDQ questions: ${questionResult.error.message}`
      );
    }

    const engagementEvents = Array.isArray(engagementResult.data)
      ? (engagementResult.data as unknown as DataRow[])
      : [];
    const questions = Array.isArray(questionResult.data)
      ? (questionResult.data as unknown as DataRow[])
      : [];

    return NextResponse.json(
      {
        sourceBatch,
        engagementEvents,
        questions,
        counts: {
          engagementEvents: engagementEvents.length,
          questions: questions.length,
          openQuestions: questions.filter(
            (question) =>
              normalizeText(question.status).toLowerCase() !==
              "answered"
          ).length,
          answeredQuestions: questions.filter(
            (question) =>
              normalizeText(question.status).toLowerCase() ===
              "answered"
          ).length,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const validationResponse = getValidationErrorResponse(error);
    if (validationResponse) return validationResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Investor Data Room workflow.";

    console.error("Investor Data Room workflow GET failed:", error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const operation = normalizeText(body.operation).toLowerCase();
    const fundName = normalizeLimitedText(body.fundName, 250);
    const requestedSourceBatchId = normalizeText(body.sourceBatchId);

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    if (
      operation !== "record_engagement" &&
      operation !== "create_question"
    ) {
      return NextResponse.json(
        {
          error:
            "Use operation record_engagement or create_question.",
        },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(
      request,
      supabase,
      fundName,
      operation === "record_engagement" ? "view" : "view"
    );

    const sourceBatch = await resolveSourceBatch(
      supabase,
      fundName,
      requestedSourceBatchId
    );

    const documentId = normalizeOptionalUuid(body.documentId);
    const document = await resolveDocument(
      supabase,
      fundName,
      sourceBatch.id,
      documentId
    );

    if (!canInvestorAccessDocument(user, document)) {
      throw new Error("DOCUMENT_NOT_FOUND");
    }

    const requestedInvestorCode =
      user.role === "investor"
        ? normalizeText(body.investorCode) ||
          (user.investorCodes.length === 1 ? user.investorCodes[0] : "")
        : normalizeText(body.investorCode);

    if (user.role === "investor") {
      assertInvestorCodeAllowed(user, requestedInvestorCode);

      if (
        operation === "create_question" &&
        !user.canSubmitQuestions
      ) {
        throw new Error("INVESTOR_QUESTION_ACCESS_REQUIRED");
      }
    }

    const investor = await resolveInvestorIdentity(
      supabase,
      fundName,
      sourceBatch.id,
      requestedInvestorCode,
      user.role === "investor" ? "" : normalizeText(body.investorName),
      user.role === "investor" ? "" : normalizeText(body.investorEmail)
    );

    const documentName =
      normalizeText(document?.document_name) ||
      normalizeText(document?.file_name) ||
      normalizeLimitedText(body.documentName, 500) ||
      "Investor Data Room";

    if (operation === "record_engagement") {
      const action = normalizeLimitedText(body.action, 80);

      if (!ENGAGEMENT_ACTIONS.has(action)) {
        throw new Error("INVALID_ACTION");
      }

      if (
        (action === "Viewed" || action === "Downloaded") &&
        !documentId
      ) {
        throw new Error("DOCUMENT_NOT_FOUND");
      }

      const metadata = {
        ...normalizeMetadata(body.metadata),
        source: "VENTIQ Data Room Workflow API",
        actorName: user.fullName,
        actorRole: user.role,
      };

      const {
        data: rawEvent,
        error: eventError,
      } = await supabase
        .from("data_room_engagement_events")
        .insert({
          fund_name: fundName,
          source_batch_id: sourceBatch.id,
          document_id: documentId || null,
          investor_code: investor.investorCode || null,
          investor_name: investor.investorName || null,
          investor_email: investor.investorEmail || null,
          document_name: documentName,
          action,
          event_time: new Date().toISOString(),
          note:
            normalizeLimitedText(body.note, 2000) ||
            `${action} recorded in the VENTIQ Investor Data Room.`,
          metadata,
          recorded_by: user.userId,
          recorded_by_email: user.email,
        })
        .select("*")
        .single();

      if (eventError || !rawEvent) {
        throw new Error(
          eventError?.message ||
            "Unable to record the LP engagement event."
        );
      }

      return NextResponse.json(
        {
          message: `${action} event recorded successfully.`,
          sourceBatch,
          engagementEvent:
            rawEvent as unknown as DataRow,
        },
        { status: 201 }
      );
    }

    const questionText = normalizeLimitedText(body.question, 10000);

    if (!questionText) {
      throw new Error("QUESTION_REQUIRED");
    }

    const status =
      normalizeLimitedText(body.status, 80) || "Open";

    if (!QUESTION_STATUSES.has(status)) {
      throw new Error("INVALID_QUESTION_STATUS");
    }

    const askedAt = new Date().toISOString();
    const metadata = {
      ...normalizeMetadata(body.metadata),
      source: "VENTIQ Data Room Workflow API",
      createdByName: user.fullName,
      createdByRole: user.role,
    };

    const {
      data: rawQuestion,
      error: questionError,
    } = await supabase
      .from("data_room_questions")
      .insert({
        fund_name: fundName,
        source_batch_id: sourceBatch.id,
        document_id: documentId || null,
        investor_code: investor.investorCode || null,
        investor_name: investor.investorName || null,
        investor_email: investor.investorEmail || null,
        document_name: documentName,
        category:
          normalizeLimitedText(body.category, 250) || "General",
        question: questionText,
        answer: null,
        status,
        asked_at: askedAt,
        answered_at: null,
        assigned_to:
          normalizeLimitedText(body.assignedTo, 320) || null,
        metadata,
        created_by: user.userId,
        created_by_email: user.email,
        updated_at: askedAt,
      })
      .select("*")
      .single();

    if (questionError || !rawQuestion) {
      throw new Error(
        questionError?.message || "Unable to create the DDQ question."
      );
    }

    let engagementWarning = "";

    const {
      error: engagementError,
    } = await supabase
      .from("data_room_engagement_events")
      .insert({
        fund_name: fundName,
        source_batch_id: sourceBatch.id,
        document_id: documentId || null,
        investor_code: investor.investorCode || null,
        investor_name: investor.investorName || null,
        investor_email: investor.investorEmail || null,
        document_name: documentName,
        action: "Asked Question",
        event_time: askedAt,
        note: questionText.slice(0, 2000),
        metadata: {
          source: "VENTIQ Data Room Workflow API",
          questionId: normalizeText(
            (rawQuestion as unknown as DataRow).id
          ),
          actorName: user.fullName,
          actorRole: user.role,
        },
        recorded_by: user.userId,
        recorded_by_email: user.email,
      });

    if (engagementError) {
      engagementWarning =
        "The question was saved, but its engagement event could not be recorded.";
    }

    return NextResponse.json(
      {
        message: "DDQ question created successfully.",
        warning: engagementWarning || undefined,
        sourceBatch,
        question: rawQuestion as unknown as DataRow,
      },
      { status: 201 }
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const validationResponse = getValidationErrorResponse(error);
    if (validationResponse) return validationResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update the Investor Data Room workflow.";

    console.error("Investor Data Room workflow POST failed:", error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const body = (await request
      .json()
      .catch(() => ({}))) as Record<string, unknown>;

    const operation = normalizeText(body.operation).toLowerCase();
    const fundName = normalizeLimitedText(body.fundName, 250);
    const requestedSourceBatchId = normalizeText(body.sourceBatchId);
    const questionId = normalizeOptionalUuid(body.questionId);

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    if (!questionId) {
      return NextResponse.json(
        { error: "DDQ question ID is required." },
        { status: 400 }
      );
    }

    if (
      operation !== "assign_question" &&
      operation !== "save_draft_answer" &&
      operation !== "approve_answer" &&
      operation !== "reopen_question"
    ) {
      return NextResponse.json(
        {
          error:
            "Use operation assign_question, save_draft_answer, approve_answer or reopen_question.",
        },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(
      request,
      supabase,
      fundName,
      "edit"
    );

    const sourceBatch = await resolveSourceBatch(
      supabase,
      fundName,
      requestedSourceBatchId
    );

    const existingQuestion = await loadQuestionForUpdate(
      supabase,
      fundName,
      sourceBatch.id,
      questionId
    );

    const currentMetadata = normalizeMetadata(
      existingQuestion.metadata
    );
    const now = new Date().toISOString();

    let updatePayload: Record<string, unknown> = {
      updated_at: now,
      metadata: {
        ...currentMetadata,
        lastUpdatedBy: user.fullName,
        lastUpdatedByEmail: user.email,
        lastUpdatedByRole: user.role,
        lastUpdatedAt: now,
      },
    };

    if (operation === "assign_question") {
      const assignedTo = normalizeLimitedText(body.assignedTo, 320);

      if (!assignedTo) {
        throw new Error("ASSIGNEE_REQUIRED");
      }

      updatePayload = {
        ...updatePayload,
        assigned_to: assignedTo,
      };
    }

    if (operation === "save_draft_answer") {
      const answer = normalizeLimitedText(body.answer, 30000);

      if (!answer) {
        throw new Error("ANSWER_REQUIRED");
      }

      updatePayload = {
        ...updatePayload,
        answer,
        status: "Needs Internal Review",
        answered_at: null,
        assigned_to:
          normalizeLimitedText(body.assignedTo, 320) ||
          normalizeText(existingQuestion.assigned_to) ||
          null,
        metadata: {
          ...normalizeMetadata(updatePayload.metadata),
          draftPreparedBy: user.fullName,
          draftPreparedByEmail: user.email,
          draftPreparedAt: now,
        },
      };
    }

    if (operation === "approve_answer") {
      const answer =
        normalizeLimitedText(body.answer, 30000) ||
        normalizeText(existingQuestion.answer);

      if (!answer) {
        throw new Error("ANSWER_REQUIRED");
      }

      updatePayload = {
        ...updatePayload,
        answer,
        status: "Answered",
        answered_at: now,
        assigned_to:
          normalizeLimitedText(body.assignedTo, 320) ||
          normalizeText(existingQuestion.assigned_to) ||
          null,
        metadata: {
          ...normalizeMetadata(updatePayload.metadata),
          approvedBy: user.fullName,
          approvedByEmail: user.email,
          approvedByRole: user.role,
          approvedAt: now,
        },
      };
    }

    if (operation === "reopen_question") {
      updatePayload = {
        ...updatePayload,
        status: "Open",
        answered_at: null,
        metadata: {
          ...normalizeMetadata(updatePayload.metadata),
          reopenedBy: user.fullName,
          reopenedByEmail: user.email,
          reopenedAt: now,
        },
      };
    }

    const {
      data: rawUpdatedQuestion,
      error: updateError,
    } = await supabase
      .from("data_room_questions")
      .update(updatePayload)
      .eq("id", questionId)
      .ilike("fund_name", fundName)
      .eq("source_batch_id", sourceBatch.id)
      .select("*")
      .single();

    if (updateError || !rawUpdatedQuestion) {
      throw new Error(
        updateError?.message || "Unable to update the DDQ question."
      );
    }

    return NextResponse.json({
      message:
        operation === "assign_question"
          ? "DDQ question assigned successfully."
          : operation === "save_draft_answer"
          ? "Draft answer saved for internal review."
          : operation === "approve_answer"
          ? "DDQ answer approved successfully."
          : "DDQ question reopened successfully.",
      sourceBatch,
      question: rawUpdatedQuestion as unknown as DataRow,
    });
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const validationResponse = getValidationErrorResponse(error);
    if (validationResponse) return validationResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to update the DDQ question.";

    console.error("Investor Data Room workflow PATCH failed:", error);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
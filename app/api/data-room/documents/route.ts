import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORAGE_BUCKET = "ventiq-data-room";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;
const SIGNED_URL_SECONDS = 300;

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
  "finance_head",
  "investment_team",
  "compliance_team",
  "investor_relations",
  "maker",
]);

const ACCESS_LEVELS = new Set([
  "All LPs",
  "Restricted LP Access",
  "Internal Only",
  "Prospective LPs Only",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  csv: "text/csv",
  txt: "text/plain",
};

const ALLOWED_MIME_TYPES = new Set(Object.values(MIME_BY_EXTENSION));

type SupabaseAdmin = ReturnType<typeof createClient<any, "public", any>>;
type AccessMode = "view" | "edit";

type AuthorisedUser = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  organisationId: string;
  investorCodes: string[];
  downloadableInvestorCodes: string[];
  canDownloadDocuments: boolean;
  canUseDataRoom: boolean;
};

type SourceBatch = {
  id: string;
  fund_name: string;
  batch_name: string | null;
  processing_status: string | null;
  processed_at: string | null;
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

  const { data: userResult, error: userError } =
    await supabase.auth.getUser(accessToken);
  const user = userResult?.user;

  if (userError || !user) {
    throw new Error("INVALID_SESSION");
  }

  const { data: profile, error: profileError } = await supabase
    .from("ventiq_user_profiles")
    .select(
      "user_id, email, full_name, default_role, active_organisation_id, status"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
  }

  if (!profile || profile.status !== "Active") {
    throw new Error("PROFILE_NOT_ACTIVE");
  }

  const allowedRoles = mode === "edit" ? EDIT_ROLES : VIEW_ROLES;
  let role = String(profile.default_role || "").trim();
  let organisationId = String(profile.active_organisation_id || "").trim();

  if (!allowedRoles.has(role) || !organisationId) {
    const { data: membership, error: membershipError } = await supabase
      .from("ventiq_organisation_members")
      .select("role,organisation_id")
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

    if (!allowedRoles.has(role)) {
      role = String(membership?.role || "").trim();
    }

    if (!organisationId) {
      organisationId = String(membership?.organisation_id || "").trim();
    }
  }

  if (!allowedRoles.has(role)) {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  if (!organisationId) {
    throw new Error("ORGANISATION_REQUIRED");
  }

  if (role !== "fund_admin") {
    const { data: fundAccess, error: fundAccessError } = await supabase
      .from("ventiq_user_fund_access")
      .select("organisation_id,can_view,can_edit")
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

    const hasRequiredAccess =
      Boolean(fundAccess?.can_view) &&
      (mode === "view" || Boolean(fundAccess?.can_edit));

    const fundOrganisationId = String(
      fundAccess?.organisation_id || ""
    ).trim();

    if (
      fundOrganisationId &&
      organisationId &&
      fundOrganisationId !== organisationId
    ) {
      throw new Error("FUND_VIEW_ACCESS_REQUIRED");
    }

    if (!hasRequiredAccess) {
      throw new Error(
        mode === "edit"
          ? "FUND_EDIT_ACCESS_REQUIRED"
          : "FUND_VIEW_ACCESS_REQUIRED"
      );
    }
  }

  let investorCodes: string[] = [];
  let downloadableInvestorCodes: string[] = [];
  let canDownloadDocuments = role !== "investor";
  let canUseDataRoom = role !== "investor";

  if (role === "investor") {
    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("ventiq_user_investor_access")
      .select(
        "investor_code,status,expires_at,can_view_documents,can_download_documents,can_use_data_room"
      )
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName);

    if (entitlementError) {
      throw new Error(
        `Unable to verify investor data-room entitlement: ${entitlementError.message}`
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
          .filter(
            (row: any) =>
              Boolean(row?.can_view_documents) &&
              Boolean(row?.can_use_data_room)
          )
          .map((row: any) => normalizeText(row?.investor_code))
          .filter(Boolean)
      )
    );

    downloadableInvestorCodes = Array.from(
      new Set(
        activeEntitlements
          .filter(
            (row: any) =>
              Boolean(row?.can_view_documents) &&
              Boolean(row?.can_use_data_room) &&
              Boolean(row?.can_download_documents)
          )
          .map((row: any) => normalizeText(row?.investor_code))
          .filter(Boolean)
      )
    );

    canDownloadDocuments = downloadableInvestorCodes.length > 0;
    canUseDataRoom = investorCodes.length > 0;

    if (!canUseDataRoom) {
      throw new Error("INVESTOR_DATA_ROOM_ACCESS_REQUIRED");
    }
  }

  return {
    userId: String(user.id),
    email: String(profile.email || user.email || ""),
    fullName: String(profile.full_name || user.email || "VENTIQ User"),
    role,
    organisationId,
    investorCodes,
    downloadableInvestorCodes,
    canDownloadDocuments,
    canUseDataRoom,
  };
}

function canInvestorAccessDocument(
  user: AuthorisedUser,
  document: Record<string, unknown>,
  forDownload = false
) {
  if (user.role !== "investor") return true;
  if (!user.canUseDataRoom) return false;

  const accessLevel = normalizeText(document.access_level).toLowerCase();
  const investorCode = normalizeText(document.investor_code).toLowerCase();
  const entitledCodes = new Set(
    user.investorCodes.map((code) => code.toLowerCase())
  );
  const downloadableCodes = new Set(
    user.downloadableInvestorCodes.map((code) => code.toLowerCase())
  );

  if (accessLevel === "all lps" || accessLevel === "all investors") {
    return !forDownload || user.canDownloadDocuments;
  }

  if (accessLevel === "restricted lp access") {
    if (!investorCode || !entitledCodes.has(investorCode)) return false;
    return !forDownload || downloadableCodes.has(investorCode);
  }

  return false;
}

function sanitizeDocumentForInvestor(
  document: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: normalizeText(document.id),
    fund_name: normalizeText(document.fund_name),
    source_batch_id: normalizeText(document.source_batch_id),
    investor_code: normalizeText(document.investor_code) || null,
    investor_name: normalizeText(document.investor_name) || null,
    document_name: normalizeText(document.document_name),
    file_name: normalizeText(document.file_name),
    detected_type: normalizeText(document.detected_type),
    suggested_folder: normalizeText(document.suggested_folder),
    access_level: normalizeText(document.access_level),
    file_size:
      typeof document.file_size === "number"
        ? document.file_size
        : Number(document.file_size || 0),
    mime_type: normalizeText(document.mime_type),
    document_status: normalizeText(document.document_status),
    ddq_impact: normalizeText(document.ddq_impact),
    imported_at: normalizeText(document.imported_at),
    updated_at: normalizeText(document.updated_at),
    download_ready: Boolean(normalizeText(document.storage_path)),
  };
}

async function assertInvestorDataRoomModuleActive(
  supabase: SupabaseAdmin,
  user: AuthorisedUser,
  fundName: string
) {
  if (user.role !== "investor") return;

  const [moduleResult, fullFundResult] = await Promise.all([
    supabase
      .from("ventiq_module_activation_status")
      .select("status")
      .eq("organisation_id", user.organisationId)
      .ilike("fund_name", fundName)
      .eq("module_key", "investor_data_room_portal")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("fund_activation_status")
      .select("status")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle(),
  ]);

  if (moduleResult.error) {
    throw new Error(
      `Unable to verify Investor Data Room activation: ${moduleResult.error.message}`
    );
  }

  if (fullFundResult.error) {
    throw new Error(
      `Unable to verify full-fund activation: ${fullFundResult.error.message}`
    );
  }

  const moduleActive =
    normalizeText(moduleResult.data?.status).toLowerCase() === "active";
  const fullFundActive =
    normalizeText(fullFundResult.data?.status).toLowerCase() === "active";

  if (!moduleActive && !fullFundActive) {
    throw new Error("INVESTOR_DATA_ROOM_NOT_ACTIVE");
  }
}

function getAuthErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message === "AUTHENTICATION_REQUIRED" ||
    message === "INVALID_SESSION"
  ) {
    return NextResponse.json(
      { error: "Please sign in before accessing the Investor Data Room." },
      { status: 401 }
    );
  }

  if (
    message === "PROFILE_NOT_ACTIVE" ||
    message === "ROLE_NOT_ALLOWED" ||
    message === "ORGANISATION_REQUIRED" ||
    message === "FUND_EDIT_ACCESS_REQUIRED" ||
    message === "FUND_VIEW_ACCESS_REQUIRED" ||
    message === "INVESTOR_DATA_ROOM_ACCESS_REQUIRED" ||
    message === "INVESTOR_DATA_ROOM_NOT_ACTIVE"
  ) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to access the Investor Data Room for this fund.",
      },
      { status: 403 }
    );
  }

  return null;
}

function getConflictErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  const messages: Record<string, string> = {
    SOURCE_BATCH_NOT_AVAILABLE:
      "No completed canonical source batch is available for this fund.",
    SOURCE_BATCH_NOT_FOUND: "The selected canonical source batch was not found.",
    SOURCE_BATCH_FUND_MISMATCH:
      "The selected source batch does not belong to the active fund.",
    SOURCE_BATCH_NOT_COMPLETED:
      "The selected source batch has not completed processing.",
  };

  if (!messages[message]) return null;

  return NextResponse.json({ error: messages[message] }, { status: 409 });
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

function safePathSegment(value: string, fallback: string) {
  const safe = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return safe || fallback;
}

function getFileExtension(fileName: string) {
  const part = fileName.split(".").pop();
  return part && part !== fileName ? part.toLowerCase() : "";
}

function resolveMimeType(file: File) {
  const extension = getFileExtension(file.name);
  const mapped = MIME_BY_EXTENSION[extension] || "";
  const provided = String(file.type || "").trim().toLowerCase();

  if (provided && ALLOWED_MIME_TYPES.has(provided)) {
    return provided;
  }

  return mapped;
}

function detectDocumentType(fileName: string) {
  const value = fileName.toLowerCase();

  if (value.includes("ppm") || value.includes("private placement")) {
    return "PPM / Fund Offering Document";
  }
  if (value.includes("ddq")) return "DDQ Response";
  if (value.includes("track") || value.includes("irr")) return "Track Record";
  if (value.includes("capital call")) return "Capital Call Notice";
  if (value.includes("distribution")) return "Distribution Notice";
  if (value.includes("soa") || value.includes("statement of account")) {
    return "Statement of Account";
  }
  if (
    value.includes("tax") ||
    value.includes("64c") ||
    value.includes("64d")
  ) {
    return "Tax / Regulatory Document";
  }
  if (value.includes("deck") || value.includes("presentation")) {
    return "Fundraising Deck";
  }
  if (
    value.includes("compliance") ||
    value.includes("sebi") ||
    value.includes("gift")
  ) {
    return "Compliance Document";
  }

  return "Investor Document";
}

function suggestDestination(documentType: string) {
  if (documentType.includes("DDQ")) return "DDQ & Q&A";
  if (documentType.includes("Track")) return "Track Record & Performance";
  if (documentType.includes("Capital Call")) {
    return "Investor Reporting Samples";
  }
  if (documentType.includes("Distribution")) {
    return "Investor Reporting Samples";
  }
  if (documentType.includes("Statement")) {
    return "Investor Reporting Samples";
  }
  if (documentType.includes("Tax")) return "Tax & Regulatory";
  if (documentType.includes("Compliance")) return "Legal & Compliance";
  if (documentType.includes("Deck")) return "Fund Overview";
  if (documentType.includes("PPM")) return "Legal & Compliance";

  return "General Investor Documents";
}

function getDDQImpact(documentType: string, destination: string) {
  if (destination === "DDQ & Q&A") {
    return "Can support DDQ response drafting";
  }
  if (destination === "Track Record & Performance") {
    return "Can support performance DDQ questions";
  }
  if (destination === "Legal & Compliance") {
    return "Can support legal and compliance diligence";
  }
  if (destination === "Investor Reporting Samples") {
    return "Can support operations and reporting DDQ questions";
  }
  if (destination === "Tax & Regulatory") {
    return "Can support tax and regulatory DDQ questions";
  }
  if (documentType.includes("Deck")) {
    return "Can support fund strategy and overview DDQ questions";
  }

  return "Available as supporting diligence evidence";
}

function valueAt(values: FormDataEntryValue[], index: number, fallback = "") {
  if (values.length === 0) return fallback;
  const selected = values[index] ?? values[0];
  return normalizeText(selected) || fallback;
}

async function resolveSourceBatch(
  supabase: SupabaseAdmin,
  fundName: string,
  requestedSourceBatchId: string
): Promise<SourceBatch> {
  if (requestedSourceBatchId) {
    const { data, error } = await supabase
      .from("migration_intake_batches")
      .select(
        "id, fund_name, batch_name, processing_status, processed_at, intake_mode"
      )
      .eq("id", requestedSourceBatchId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load source batch: ${error.message}`);
    }

    if (!data) throw new Error("SOURCE_BATCH_NOT_FOUND");

    if (
      String(data.fund_name || "").trim().toLowerCase() !==
      fundName.trim().toLowerCase()
    ) {
      throw new Error("SOURCE_BATCH_FUND_MISMATCH");
    }

    if (String(data.processing_status || "") !== "Completed") {
      throw new Error("SOURCE_BATCH_NOT_COMPLETED");
    }

    return data as unknown as SourceBatch;
  }

  const { data, error } = await supabase
    .from("migration_intake_batches")
    .select("id, fund_name, batch_name, processing_status, processed_at")
    .ilike("fund_name", fundName)
    .eq("processing_status", "Completed")
    .ilike("intake_mode", "Canonical")
    .gt("total_rows", 0)
    .order("processed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve canonical source batch: ${error.message}`);
  }

  if (!data) throw new Error("SOURCE_BATCH_NOT_AVAILABLE");

  return data as unknown as SourceBatch;
}

const DATA_ROOM_DOCUMENT_SELECT =
  "id,fund_name,source_batch_id,investor_code,investor_name,document_name,file_name,detected_type,suggested_folder,access_level,storage_bucket,storage_path,file_size,mime_type,document_status,ddq_impact,metadata,uploaded_by,created_by_email,imported_at,updated_at" as const;

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured." },
      { status: 500 }
    );
  }

  try {
    const fundName = normalizeText(request.nextUrl.searchParams.get("fundName"));
    const requestedSourceBatchId = normalizeText(
      request.nextUrl.searchParams.get("sourceBatchId")
    );
    const documentId = normalizeText(
      request.nextUrl.searchParams.get("documentId")
    );
    const folder = normalizeText(request.nextUrl.searchParams.get("folder"));
    const investorCode = normalizeText(
      request.nextUrl.searchParams.get("investorCode")
    );
    const status = normalizeText(request.nextUrl.searchParams.get("status"));
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 200);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 200, 1), 500);

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(request, supabase, fundName, "view");
    await assertInvestorDataRoomModuleActive(supabase, user, fundName);

    const sourceBatch = await resolveSourceBatch(
      supabase,
      fundName,
      requestedSourceBatchId
    );

    if (documentId) {
      const { data: document, error: documentError } = await supabase
        .from("data_room_documents")
        .select(DATA_ROOM_DOCUMENT_SELECT)
        .eq("id", documentId)
        .ilike("fund_name", fundName)
        .eq("source_batch_id", sourceBatch.id)
        .maybeSingle();

      if (documentError) {
        throw new Error(
          `Unable to load data room document: ${documentError.message}`
        );
      }

      if (!document) {
        return NextResponse.json(
          { error: "The requested data room document was not found." },
          { status: 404 }
        );
      }

      const documentRecord = document as unknown as Record<string, unknown>;

      if (!canInvestorAccessDocument(user, documentRecord, true)) {
        return NextResponse.json(
          { error: "The requested data room document was not found." },
          { status: 404 }
        );
      }

      const storageBucket = String(
        documentRecord.storage_bucket || STORAGE_BUCKET
      );
      const storagePath = String(documentRecord.storage_path || "");

      if (!storagePath) {
        return NextResponse.json(
          { error: "This document does not have a stored file path." },
          { status: 409 }
        );
      }

      const downloadFileName =
        normalizeText(documentRecord.file_name) ||
        normalizeText(documentRecord.document_name) ||
        "data-room-document";

      const { data: signedData, error: signedError } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(storagePath, SIGNED_URL_SECONDS, {
          download: downloadFileName || true,
        });

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          signedError?.message || "Unable to create a signed document link."
        );
      }

      return NextResponse.json(
        {
          document:
            user.role === "investor"
              ? sanitizeDocumentForInvestor(documentRecord)
              : documentRecord,
          signedUrl: signedData.signedUrl,
          expiresInSeconds: SIGNED_URL_SECONDS,
          sourceBatch,
          requestedBy: {
            userId: user.userId,
            email: user.email,
            role: user.role,
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let documents: Array<Record<string, unknown>> = [];

    if (user.role === "investor") {
      const buildBaseQuery = () => {
        let query: any = supabase
          .from("data_room_documents")
          .select(DATA_ROOM_DOCUMENT_SELECT)
          .ilike("fund_name", fundName)
          .eq("source_batch_id", sourceBatch.id)
          .order("imported_at", { ascending: false })
          .limit(limit);

        if (folder) query = query.eq("suggested_folder", folder);
        if (status) query = query.eq("document_status", status);

        return query;
      };

      const allLpQuery = buildBaseQuery().eq("access_level", "All LPs");

      const restrictedQuery =
        user.investorCodes.length > 0
          ? buildBaseQuery()
              .eq("access_level", "Restricted LP Access")
              .in("investor_code", user.investorCodes)
          : null;

      const [allLpResult, restrictedResult] = await Promise.all([
        allLpQuery,
        restrictedQuery,
      ]);

      if (allLpResult.error) {
        throw new Error(
          `Unable to load data room documents: ${allLpResult.error.message}`
        );
      }

      if (restrictedResult?.error) {
        throw new Error(
          `Unable to load investor-mapped documents: ${restrictedResult.error.message}`
        );
      }

      documents = [
        ...((allLpResult.data ?? []) as unknown as Array<Record<string, unknown>>),
        ...(((restrictedResult?.data ?? []) as unknown) as Array<
          Record<string, unknown>
        >),
      ]
        .filter((document, index, rows) => {
          const id = normalizeText(document.id);
          return rows.findIndex((row) => normalizeText(row.id) === id) === index;
        })
        .filter((document) => canInvestorAccessDocument(user, document))
        .sort((left, right) => {
          const leftTime = Date.parse(normalizeText(left.imported_at)) || 0;
          const rightTime = Date.parse(normalizeText(right.imported_at)) || 0;
          return rightTime - leftTime;
        })
        .slice(0, limit);
    } else {
      let query: any = supabase
        .from("data_room_documents")
        .select(DATA_ROOM_DOCUMENT_SELECT)
        .ilike("fund_name", fundName)
        .eq("source_batch_id", sourceBatch.id)
        .order("imported_at", { ascending: false })
        .limit(limit);

      if (folder) query = query.eq("suggested_folder", folder);
      if (investorCode) query = query.eq("investor_code", investorCode);
      if (status) query = query.eq("document_status", status);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Unable to load data room documents: ${error.message}`);
      }

      documents = Array.isArray(data)
        ? (data as unknown as Array<Record<string, unknown>>)
        : [];
    }

    const releasedDocuments =
      user.role === "investor"
        ? documents.map((document) => sanitizeDocumentForInvestor(document))
        : documents;

    return NextResponse.json(
      {
        documents: releasedDocuments,
        sourceBatch,
        count: releasedDocuments.length,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const conflictResponse = getConflictErrorResponse(error);
    if (conflictResponse) return conflictResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to access Investor Data Room documents.";

    console.error("Investor Data Room document GET failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    const formData = await request.formData();
    const fundName = normalizeText(formData.get("fundName"));
    const requestedSourceBatchId = normalizeText(formData.get("sourceBatchId"));
    const rawFiles = formData.getAll("files");
    const files = rawFiles.filter((entry): entry is File => entry instanceof File);

    if (!fundName) {
      return NextResponse.json(
        { error: "Active fund name is required." },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Select at least one document to upload." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `Upload a maximum of ${MAX_FILES_PER_REQUEST} documents per request.`,
        },
        { status: 400 }
      );
    }

    const user = await authoriseRequest(request, supabase, fundName, "edit");
    const sourceBatch = await resolveSourceBatch(
      supabase,
      fundName,
      requestedSourceBatchId
    );

    const documentNames = formData.getAll("documentNames");
    const detectedTypes = formData.getAll("detectedTypes");
    const folders = formData.getAll("folders");
    const accessLevels = formData.getAll("accessLevels");
    const investorCodes = formData.getAll("investorCodes");
    const investorNames = formData.getAll("investorNames");
    const ddqImpacts = formData.getAll("ddqImpacts");
    const notes = formData.getAll("notes");

    const commonFolder = normalizeText(formData.get("suggestedFolder"));
    const commonAccessLevel = normalizeText(formData.get("accessLevel"));
    const commonInvestorCode = normalizeText(formData.get("investorCode"));
    const commonInvestorName = normalizeText(formData.get("investorName"));
    const commonDetectedType = normalizeText(formData.get("detectedType"));
    const commonDDQImpact = normalizeText(formData.get("ddqImpact"));
    const commonNote = normalizeText(formData.get("note"));

    const uploadedDocuments: Array<Record<string, unknown>> = [];
    const failedDocuments: Array<{
      fileName: string;
      error: string;
    }> = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      let uploadedStoragePath = "";

      try {
        if (file.size <= 0) {
          throw new Error("The selected file is empty.");
        }

        if (file.size > MAX_FILE_SIZE) {
          throw new Error("The file exceeds the 50 MB data-room limit.");
        }

        const mimeType = resolveMimeType(file);
        if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
          throw new Error(
            "Unsupported file type. Use PDF, Excel, Word, PowerPoint, CSV or text."
          );
        }

        const detectedType =
          valueAt(detectedTypes, index, commonDetectedType) ||
          detectDocumentType(file.name);
        const suggestedFolder =
          valueAt(folders, index, commonFolder) ||
          suggestDestination(detectedType);
        const requestedAccessLevel =
          valueAt(accessLevels, index, commonAccessLevel) || "Internal Only";
        const accessLevel = ACCESS_LEVELS.has(requestedAccessLevel)
          ? requestedAccessLevel
          : "Internal Only";
        const investorCode = valueAt(
          investorCodes,
          index,
          commonInvestorCode
        );
        const investorName = valueAt(
          investorNames,
          index,
          commonInvestorName
        );
        const documentName =
          valueAt(documentNames, index) || file.name.replace(/\.[^.]+$/, "");
        const ddqImpact =
          valueAt(ddqImpacts, index, commonDDQImpact) ||
          getDDQImpact(detectedType, suggestedFolder);
        const note = valueAt(notes, index, commonNote);

        const safeFund = safePathSegment(fundName, "fund");
        const safeFolder = safePathSegment(suggestedFolder, "general");
        const safeFileName = safePathSegment(file.name, "document");
        const datePrefix = new Date().toISOString().slice(0, 10);
        const storagePath = `${safeFund}/${sourceBatch.id}/${safeFolder}/${datePrefix}-${randomUUID()}-${safeFileName}`;
        uploadedStoragePath = storagePath;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const sha256 = createHash("sha256").update(buffer).digest("hex");

        const { error: storageError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false,
            cacheControl: "3600",
          });

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        const now = new Date().toISOString();
        const metadata = {
          sha256,
          originalFileName: file.name,
          lastModified: Number(file.lastModified || 0),
          note,
          uploadedByName: user.fullName,
          uploadedByRole: user.role,
          sourceBatchName: sourceBatch.batch_name,
        };

        const { data: insertedDocument, error: insertError } = await supabase
          .from("data_room_documents")
          .insert({
            fund_name: fundName,
            source_batch_id: sourceBatch.id,
            investor_code: investorCode || null,
            investor_name: investorName || null,
            document_name: documentName,
            file_name: file.name,
            detected_type: detectedType,
            suggested_folder: suggestedFolder,
            access_level: accessLevel,
            storage_bucket: STORAGE_BUCKET,
            storage_path: storagePath,
            storage_url: null,
            file_size: file.size,
            mime_type: mimeType,
            document_status: "Imported",
            ddq_impact: ddqImpact,
            metadata,
            uploaded_by: user.userId,
            created_by_email: user.email,
            imported_at: now,
            updated_at: now,
          })
          .select(DATA_ROOM_DOCUMENT_SELECT)
          .single();

        if (insertError || !insertedDocument) {
          await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
          uploadedStoragePath = "";
          throw new Error(
            `Document metadata save failed: ${
              insertError?.message || "No saved document returned"
            }`
          );
        }

        uploadedDocuments.push(
          insertedDocument as unknown as Record<string, unknown>
        );
      } catch (fileError) {
        if (uploadedStoragePath) {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([uploadedStoragePath]);
        }

        failedDocuments.push({
          fileName: file.name,
          error:
            fileError instanceof Error ? fileError.message : "Upload failed.",
        });
      }
    }

    const status = uploadedDocuments.length > 0 ? 200 : 400;

    return NextResponse.json(
      {
        message: `${uploadedDocuments.length} document(s) uploaded; ${failedDocuments.length} failed.`,
        sourceBatch,
        uploadedCount: uploadedDocuments.length,
        failedCount: failedDocuments.length,
        documents: uploadedDocuments,
        failures: failedDocuments,
      },
      { status }
    );
  } catch (error) {
    const authResponse = getAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const conflictResponse = getConflictErrorResponse(error);
    if (conflictResponse) return conflictResponse;

    const message =
      error instanceof Error
        ? error.message
        : "Unable to upload Investor Data Room documents.";

    console.error("Investor Data Room document POST failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DataRow = Record<string, unknown>;

const ALLOWED_ROLES = new Set([
  "fund_admin",
  "compliance_team",
  "maker",
  "checker",
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
        "Please sign in before opening the Compliance workspace.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const sourceBatchId = normalizeText(
      request.nextUrl.searchParams.get("sourceBatchId"),
      120
    );

    if (!fundName) {
      return jsonError("Fund name is required.", 400, "FUND_NAME_REQUIRED");
    }

    if (!sourceBatchId) {
      return jsonError(
        "A verified compliance source batch is required.",
        400,
        "SOURCE_BATCH_REQUIRED"
      );
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

    const { data: rawProfile, error: profileError } = await supabaseAdmin
      .from("ventiq_user_profiles")
      .select("user_id,default_role,active_organisation_id,status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
    }

    const profile = rawProfile as unknown as DataRow | null;

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

    const activeOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );

    let fundAccessQuery = supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id,role,can_view,status")
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

    const fundAccess = rawFundAccess as unknown as DataRow | null;
    const role = normalizeText(fundAccess?.role, 80).toLowerCase();

    if (
      !fundAccess ||
      !Boolean(fundAccess.can_view) ||
      !ALLOWED_ROLES.has(role)
    ) {
      return jsonError(
        "The requested Compliance workspace was not found.",
        404,
        "COMPLIANCE_WORKSPACE_NOT_FOUND"
      );
    }

    const userDb = createUserScopedClient(accessToken);

    const [
      activationResult,
      complianceItemsResult,
      migrationPdfFilesResult,
      fundRowResult,
      regulatoryMatchesResult,
      regulatoryCircularsResult,
    ] = await Promise.all([
      userDb
        .from("fund_activation_status")
        .select("status,activated_by")
        .eq("fund_name", fundName)
        .maybeSingle(),

      userDb
        .from("compliance_items")
        .select(
          "id,created_at,due_date,filing_status,migration_status,risk_level,evidence_available,authority,item_type,document_name,category,owner,remarks"
        )
        .eq("fund_name", fundName)
        .eq("source_batch_id", sourceBatchId)
        .order("due_date", { ascending: true }),

      userDb
        .from("migration_file_uploads")
        .select("storage_path")
        .eq("batch_id", sourceBatchId)
        .eq("fund_name", fundName)
        .eq("category", "pdf")
        .order("created_at", { ascending: false }),

      userDb
        .from("fund_master")
        .select("id")
        .eq("fund_name", fundName)
        .eq("source_batch_id", sourceBatchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),

      userDb
        .from("regulatory_source_matches")
        .select("id,created_at")
        .eq("status", "needs_review"),

      userDb
        .from("regulatory_circulars")
        .select("id")
        .eq("status", "active"),
    ]);

    const firstError =
      complianceItemsResult.error ||
      migrationPdfFilesResult.error ||
      fundRowResult.error;

    if (firstError) {
      throw new Error(firstError.message);
    }

    const activation = activationResult.error
      ? null
      : ((activationResult.data as unknown as DataRow | null) ?? null);

    const complianceRows =
      (complianceItemsResult.data ?? []) as unknown as DataRow[];
    const migrationPdfFiles =
      (migrationPdfFilesResult.data ?? []) as unknown as DataRow[];

    const pdfStoragePaths = Array.from(
      new Set(
        migrationPdfFiles
          .map((row) => normalizeText(row.storage_path, 1000))
          .filter(Boolean)
      )
    );

    let pdfRows: DataRow[] = [];
    let investorDocumentRows: DataRow[] = [];

    if (pdfStoragePaths.length > 0) {
      const [pdfDocumentsResult, investorDocumentsResult] = await Promise.all([
        userDb
          .from("pdf_intelligence_documents")
          .select("storage_path,status,created_at")
          .eq("fund_name", fundName)
          .in("storage_path", pdfStoragePaths)
          .order("created_at", { ascending: false }),

        userDb
          .from("investor_documents")
          .select("storage_path,storage_url")
          .eq("fund_name", fundName)
          .in("storage_path", pdfStoragePaths)
          .order("created_at", { ascending: false }),
      ]);

      if (pdfDocumentsResult.error) {
        throw new Error(pdfDocumentsResult.error.message);
      }

      pdfRows =
        (pdfDocumentsResult.data ?? []) as unknown as DataRow[];
      investorDocumentRows = investorDocumentsResult.error
        ? []
        : ((investorDocumentsResult.data ?? []) as unknown as DataRow[]);
    }

    const fundRow =
      (fundRowResult.data as unknown as DataRow | null) ?? null;
    const regulatoryMatchRows = regulatoryMatchesResult.error
      ? []
      : ((regulatoryMatchesResult.data ?? []) as unknown as DataRow[]);
    const regulatoryCircularRows = regulatoryCircularsResult.error
      ? []
      : ((regulatoryCircularsResult.data ?? []) as unknown as DataRow[]);

    return jsonResponse({
      activation,
      complianceRows,
      migrationPdfFiles,
      fundRow,
      regulatoryMatchRows,
      regulatoryCircularRows,
      pdfRows,
      investorDocumentRows,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to load the Compliance workspace.";

    if (message === "SUPABASE_NOT_CONFIGURED") {
      return jsonError(
        "The Compliance workspace is unavailable because Supabase is not configured.",
        503,
        "SUPABASE_NOT_CONFIGURED"
      );
    }

    console.error("Compliance overview load failed:", error);

    return jsonError(
      message,
      500,
      "COMPLIANCE_OVERVIEW_LOAD_FAILED"
    );
  }
}

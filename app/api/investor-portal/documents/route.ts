import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODULE_KEY = "investor_documents_portal";

type DataRow = Record<string, unknown>;

const INTERNAL_VIEW_ROLES = new Set([
  "fund_admin",
  "managing_partner",
  "finance_head",
  "investor_relations",
  "maker",
  "checker",
]);

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isFutureOrNoExpiry(value: unknown) {
  const text = normalizeText(value, 100);
  if (!text) return true;

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function jsonResponse(body: DataRow, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function jsonError(error: string, status: number, code?: string) {
  return jsonResponse(
    {
      error,
      ...(code ? { code } : {}),
    },
    status
  );
}

function unavailable(
  fundName: string,
  investorCode: string,
  reason: string,
  message: string
) {
  return jsonResponse({
    available: false,
    fund_name: fundName,
    investor_code: investorCode,
    reason,
    message,
  });
}

function isPortalVisibleDocument(row: DataRow) {
  const portalStatus = normalizeText(row.portal_status, 80).toLowerCase();
  const status = normalizeText(row.status, 80).toLowerCase();

  const portalVisible = new Set(["available", "published", "ready", "active"]);
  const publishedStatuses = new Set(["published", "available", "ready", "active"]);

  return portalVisible.has(portalStatus) || publishedStatuses.has(status);
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError(
        "Please sign in before opening investor documents.",
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const fundName = normalizeText(
      request.nextUrl.searchParams.get("fundName"),
      240
    );
    const requestedInvestorCode = normalizeText(
      request.nextUrl.searchParams.get("investorCode"),
      160
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

    const { data: rawProfile, error: profileError } = await supabaseAdmin
      .from("ventiq_user_profiles")
      .select(
        "user_id,email,full_name,default_role,active_organisation_id,investor_id,status"
      )
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

    const { data: rawFundAccess, error: fundAccessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id,role,can_view,investor_id,status")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(
        `Unable to verify governed fund access: ${fundAccessError.message}`
      );
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;

    if (!fundAccess || !Boolean(fundAccess.can_view)) {
      return jsonError(
        "The requested investor document library was not found.",
        404,
        "INVESTOR_DOCUMENTS_NOT_FOUND"
      );
    }

    const organisationId = normalizeText(fundAccess.organisation_id, 80);
    const activeOrganisationId = normalizeText(
      profile.active_organisation_id,
      80
    );

    if (
      activeOrganisationId &&
      organisationId &&
      activeOrganisationId !== organisationId
    ) {
      return jsonError(
        "The requested investor document library was not found.",
        404,
        "INVESTOR_DOCUMENTS_NOT_FOUND"
      );
    }

    const governedRole =
      normalizeText(fundAccess.role, 80).toLowerCase() ||
      normalizeText(profile.default_role, 80).toLowerCase();

    if (
      governedRole !== "investor" &&
      !INTERNAL_VIEW_ROLES.has(governedRole)
    ) {
      return jsonError(
        "You do not have access to investor documents.",
        403,
        "ROLE_NOT_ALLOWED"
      );
    }

    const [moduleResult, fullFundResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("status,readiness_score,readiness_evidence")
        .eq("organisation_id", organisationId)
        .ilike("fund_name", fundName)
        .eq("module_key", MODULE_KEY)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("fund_activation_status")
        .select("status")
        .ilike("fund_name", fundName)
        .limit(1)
        .maybeSingle(),
    ]);

    if (moduleResult.error) {
      throw new Error(
        `Unable to verify Investor Documents activation: ${moduleResult.error.message}`
      );
    }

    if (fullFundResult.error) {
      throw new Error(
        `Unable to verify full-fund activation: ${fullFundResult.error.message}`
      );
    }

    const moduleActive =
      normalizeText(
        (moduleResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    const fullFundActive =
      normalizeText(
        (fullFundResult.data as unknown as DataRow | null)?.status,
        80
      ).toLowerCase() === "active";

    if (!moduleActive && !fullFundActive) {
      return unavailable(
        fundName,
        "",
        "DOCUMENTS_NOT_ACTIVE",
        "Investor documents are not available for this fund yet."
      );
    }

    let investorCode = "";
    let canDownloadDocuments = true;

    if (governedRole === "investor") {
      const { data: entitlementData, error: entitlementError } =
        await supabaseAdmin
          .from("ventiq_user_investor_access")
          .select(
            "investor_code,status,expires_at,can_view_documents,can_download_documents"
          )
          .eq("user_id", user.id)
          .eq("status", "Active")
          .ilike("fund_name", fundName);

      if (entitlementError) {
        throw new Error(
          `Unable to verify investor document entitlement: ${entitlementError.message}`
        );
      }

      const eligibleEntitlements = (
        (entitlementData ?? []) as unknown as DataRow[]
      ).filter(
        (row) =>
          isFutureOrNoExpiry(row.expires_at) &&
          Boolean(row.can_view_documents) &&
          Boolean(normalizeText(row.investor_code, 160))
      );

      const entitlementCodes = Array.from(
        new Set(
          eligibleEntitlements
            .map((row) => normalizeText(row.investor_code, 160))
            .filter(Boolean)
        )
      );

      if (entitlementCodes.length === 0) {
        return jsonError(
          "The requested investor document library was not found.",
          404,
          "INVESTOR_DOCUMENTS_NOT_FOUND"
        );
      }

      // Investor-role URL investorCode is deliberately ignored.
      const preferredCodes = [
        normalizeText(profile.investor_id, 160),
        normalizeText(fundAccess.investor_id, 160),
      ].filter(Boolean);

      investorCode =
        preferredCodes.find((code) =>
          entitlementCodes.some(
            (entitledCode) =>
              entitledCode.toLowerCase() === code.toLowerCase()
          )
        ) ||
        (entitlementCodes.length === 1 ? entitlementCodes[0] : "");

      if (!investorCode) {
        return unavailable(
          fundName,
          "",
          "INVESTOR_CONTEXT_AMBIGUOUS",
          "Your investor account context could not be resolved."
        );
      }

      const matchedEntitlement = eligibleEntitlements.find(
        (row) =>
          normalizeText(row.investor_code, 160).toLowerCase() ===
          investorCode.toLowerCase()
      );

      canDownloadDocuments = Boolean(
        matchedEntitlement?.can_download_documents
      );
    } else {
      investorCode = requestedInvestorCode;

      if (!investorCode) {
        return jsonError(
          "Investor code is required for internal support view.",
          400,
          "INVESTOR_CODE_REQUIRED"
        );
      }
    }

    const { data: rawInvestor, error: investorError } = await supabaseAdmin
      .from("investor_master")
      .select("id,investor_code,investor_name,fund_name")
      .ilike("fund_name", fundName)
      .ilike("investor_code", investorCode)
      .limit(1)
      .maybeSingle();

    if (investorError) {
      throw new Error(
        `Unable to verify governed investor: ${investorError.message}`
      );
    }

    const investorRecord = rawInvestor as unknown as DataRow | null;

    if (!investorRecord) {
      return jsonError(
        "The requested investor document library was not found.",
        404,
        "INVESTOR_DOCUMENTS_NOT_FOUND"
      );
    }

    const { data: rawDocuments, error: documentError } = await supabaseAdmin
      .from("investor_documents")
      .select("*")
      .ilike("fund_name", fundName)
      .ilike("investor_code", investorCode)
      .order("published_at", { ascending: false });

    if (documentError) {
      throw new Error(
        `Unable to load governed investor documents: ${documentError.message}`
      );
    }

    const visibleDocuments = (
      (rawDocuments ?? []) as unknown as DataRow[]
    ).filter(isPortalVisibleDocument);

    const documents = visibleDocuments.map((row) => {
      const storageBucket = normalizeText(row.storage_bucket, 200);
      const storagePath = normalizeText(row.storage_path, 1200);
      const publishedAt =
        normalizeText(row.published_at, 100) ||
        normalizeText(row.generated_at, 100) ||
        normalizeText(row.uploaded_at, 100) ||
        normalizeText(row.created_at, 100) ||
        null;

      const periodLabel =
        normalizeText(row.period_label, 120) ||
        normalizeText(row.period, 120) ||
        normalizeText(row.fund_memory_reporting_period, 120) ||
        null;

      const canonical =
        normalizeText(row.publish_source, 120).toLowerCase() ===
          "document_studio" &&
        Boolean(normalizeText(row.fund_memory_snapshot_id, 160)) &&
        Boolean(
          normalizeText(row.document_studio_generated_document_id, 160)
        );

      return {
        id: normalizeText(row.id, 100),
        investor_master_id:
          normalizeText(row.investor_master_id, 100) || null,
        investor_code: normalizeText(row.investor_code, 160),
        investor_name:
          normalizeText(row.investor_name, 240) ||
          normalizeText(investorRecord.investor_name, 240),
        document_type:
          normalizeText(row.document_type, 200) ||
          normalizeText(row.document_category, 200) ||
          "Investor Document",
        document_name:
          normalizeText(row.document_name, 300) ||
          normalizeText(row.file_name, 300) ||
          "Investor document",
        document_category:
          normalizeText(row.document_category, 200) || null,
        fund_name: fundName,
        amount: safeNumber(row.amount),
        status: normalizeText(row.status, 80) || "Published",
        email_status: normalizeText(row.email_status, 80) || null,
        portal_status:
          normalizeText(row.portal_status, 80) || "Available",
        file_name: normalizeText(row.file_name, 300) || null,
        publish_source: normalizeText(row.publish_source, 120) || null,
        migration_status:
          normalizeText(row.migration_status, 80) || null,
        period_label: periodLabel,
        published_at: publishedAt,
        created_at: normalizeText(row.created_at, 100) || null,
        download_ready: Boolean(storageBucket && storagePath),
        canonical,
      };
    });

    const downloadReadyCount = documents.filter(
      (document) => document.download_ready
    ).length;

    const canonicalCount = documents.filter(
      (document) => document.canonical
    ).length;

    return jsonResponse({
      available: true,
      fund_name: fundName,
      investor_code: investorCode,
      investor_name: normalizeText(investorRecord.investor_name, 240),
      permissions: {
        can_view_documents: true,
        can_download_documents: canDownloadDocuments,
      },
      summary: {
        total_documents: documents.length,
        download_ready: downloadReadyCount,
        canonical_documents: canonicalCount,
      },
      documents,
    });
  } catch (error) {
    console.error("Investor Portal document listing failed:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Unable to load governed investor documents.",
      500,
      "INVESTOR_DOCUMENTS_LOAD_FAILED"
    );
  }
}

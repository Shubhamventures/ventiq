import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 180;
const MODULE_KEY = "investor_documents_portal";

type DataRow = Record<string, unknown>;

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return "";
  return authorization.slice(7).trim();
}

function jsonError(
  error: string,
  status: number,
  code?: string
) {
  return NextResponse.json(
    { error, ...(code ? { code } : {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function isFutureOrNoExpiry(value: unknown) {
  const text = normalizeText(value, 100);
  if (!text) return true;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > Date.now();
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
      return jsonError("Please sign in before opening investor documents.", 401, "AUTHENTICATION_REQUIRED");
    }

    const body = (await request.json()) as DataRow;
    const documentId = normalizeText(body.document_id, 80);
    const accessMode =
      normalizeText(body.access_mode, 20).toLowerCase() === "download"
        ? "download"
        : "view";

    if (!documentId) {
      return jsonError("Investor document ID is required.", 400, "DOCUMENT_ID_REQUIRED");
    }

    const {
      data: userResult,
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    const user = userResult?.user;

    if (userError || !user) {
      return jsonError("Your session is no longer valid.", 401, "INVALID_SESSION");
    }

    const { data: rawProfile, error: profileError } = await supabaseAdmin
      .from("ventiq_user_profiles")
      .select("user_id, email, full_name, default_role, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Unable to load VENTIQ profile: ${profileError.message}`);
    }

    const profile = rawProfile as unknown as DataRow | null;

    if (!profile || normalizeText(profile.status, 40).toLowerCase() !== "active") {
      return jsonError("Your VENTIQ profile is not active.", 403, "PROFILE_NOT_ACTIVE");
    }

    const { data: rawDocument, error: documentError } = await supabaseAdmin
      .from("investor_documents")
      .select(
        "id, organisation_id, investor_master_id, investor_code, investor_name, fund_name, document_name, document_type, file_name, storage_bucket, storage_path, publish_source, status, portal_status, period_label, fund_memory_snapshot_id, document_studio_generated_document_id"
      )
      .eq("id", documentId)
      .maybeSingle();

    if (documentError) {
      throw new Error(`Unable to load investor document: ${documentError.message}`);
    }

    const documentRecord = rawDocument as unknown as DataRow | null;

    if (!documentRecord) {
      return jsonError("The requested investor document was not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const fundName = normalizeText(documentRecord.fund_name, 240);
    const documentOrganisationId = normalizeText(documentRecord.organisation_id, 80);
    const investorCode = normalizeText(documentRecord.investor_code, 160);
    const investorMasterId = normalizeText(documentRecord.investor_master_id, 80);
    const storageBucket = normalizeText(documentRecord.storage_bucket, 160);
    const storagePath = normalizeText(documentRecord.storage_path, 1000);
    const status = normalizeText(documentRecord.status, 80).toLowerCase();
    const portalStatus = normalizeText(documentRecord.portal_status, 80).toLowerCase();

    if (!fundName) {
      return jsonError("This investor document has no governed fund context.", 409, "FUND_CONTEXT_MISSING");
    }

    if (status !== "published" || portalStatus !== "available") {
      return jsonError(
        "This document is not currently available in Investor Portal.",
        409,
        "DOCUMENT_NOT_PORTAL_AVAILABLE"
      );
    }

    if (!storageBucket || !storagePath) {
      return jsonError(
        "This investor document does not have a private storage reference.",
        409,
        "PRIVATE_STORAGE_REFERENCE_MISSING"
      );
    }

    const { data: rawFundAccess, error: fundAccessError } = await supabaseAdmin
      .from("ventiq_user_fund_access")
      .select("organisation_id, role, can_view, investor_id, status")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .ilike("fund_name", fundName)
      .limit(1)
      .maybeSingle();

    if (fundAccessError) {
      throw new Error(`Unable to verify governed fund access: ${fundAccessError.message}`);
    }

    const fundAccess = rawFundAccess as unknown as DataRow | null;

    if (!fundAccess || !Boolean(fundAccess.can_view)) {
      return jsonError("The requested investor document was not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const organisationId = normalizeText(fundAccess.organisation_id, 80);

    if (
      documentOrganisationId &&
      organisationId &&
      documentOrganisationId !== organisationId
    ) {
      return jsonError("The requested investor document was not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const governedRole =
      normalizeText(fundAccess.role, 80).toLowerCase() ||
      normalizeText(profile.default_role, 80).toLowerCase();

    const [moduleResult, fullFundResult] = await Promise.all([
      supabaseAdmin
        .from("ventiq_module_activation_status")
        .select("status")
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
      throw new Error(`Unable to verify Investor Documents activation: ${moduleResult.error.message}`);
    }

    if (fullFundResult.error) {
      throw new Error(`Unable to verify full-fund activation: ${fullFundResult.error.message}`);
    }

    const moduleActive =
      normalizeText((moduleResult.data as unknown as DataRow | null)?.status, 80).toLowerCase() ===
      "active";
    const fullFundActive =
      normalizeText((fullFundResult.data as unknown as DataRow | null)?.status, 80).toLowerCase() ===
      "active";

    if (!moduleActive && !fullFundActive) {
      return jsonError(
        "Investor Documents access is not active for this fund.",
        403,
        "INVESTOR_DOCUMENTS_NOT_ACTIVE"
      );
    }

    let entitlementBasis = `ventiq_user_fund_access:${governedRole || "view"}`;

    if (governedRole === "investor") {
      const { data: entitlementData, error: entitlementError } = await supabaseAdmin
        .from("ventiq_user_investor_access")
        .select(
          "investor_code, status, expires_at, can_view_documents, can_download_documents"
        )
        .eq("user_id", user.id)
        .eq("status", "Active")
        .ilike("fund_name", fundName);

      if (entitlementError) {
        throw new Error(
          `Unable to verify investor document entitlement: ${entitlementError.message}`
        );
      }

      const entitlements = ((entitlementData ?? []) as unknown as DataRow[]).filter(
        (row) => isFutureOrNoExpiry(row.expires_at)
      );

      const matchingEntitlement = entitlements.find(
        (row) =>
          normalizeText(row.investor_code, 160).toLowerCase() ===
          investorCode.toLowerCase()
      );

      if (!investorCode || !matchingEntitlement) {
        // Do not reveal whether another investor's document exists.
        return jsonError(
          "The requested investor document was not found.",
          404,
          "DOCUMENT_NOT_FOUND"
        );
      }

      if (!Boolean(matchingEntitlement.can_view_documents)) {
        // A user without document-view entitlement should not learn that the
        // requested record exists.
        return jsonError(
          "The requested investor document was not found.",
          404,
          "DOCUMENT_NOT_FOUND"
        );
      }

      if (
        accessMode === "download" &&
        !Boolean(matchingEntitlement.can_download_documents)
      ) {
        return jsonError(
          "Download access is not enabled for this investor entitlement.",
          403,
          "INVESTOR_DOCUMENT_DOWNLOAD_NOT_ALLOWED"
        );
      }

      entitlementBasis =
        accessMode === "download"
          ? `ventiq_user_investor_access:${investorCode}:download`
          : `ventiq_user_investor_access:${investorCode}:view`;
    }

    const fileName =
      normalizeText(documentRecord.file_name, 260) ||
      normalizeText(documentRecord.document_name, 260) ||
      "VENTIQ-investor-document.pdf";

    const signedOptions =
      accessMode === "download" ? { download: fileName || true } : undefined;

    const { data: signedData, error: signedError } = signedOptions
      ? await supabaseAdmin.storage
          .from(storageBucket)
          .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS, signedOptions)
      : await supabaseAdmin.storage
          .from(storageBucket)
          .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) {
      throw new Error(
        signedError?.message || "Unable to create secure investor document access."
      );
    }

    const expiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000
    ).toISOString();

    const forwardedFor = normalizeText(request.headers.get("x-forwarded-for"), 300);
    const ipAddress = forwardedFor.split(",")[0]?.trim() || null;

    const { error: auditError } = await supabaseAdmin
      .from("ventiq_investor_document_access_events")
      .insert({
        organisation_id: organisationId || documentOrganisationId || null,
        fund_name: fundName,
        investor_document_id: documentId,
        investor_master_id: investorMasterId || null,
        investor_code: investorCode || null,
        document_type: normalizeText(documentRecord.document_type, 200) || null,
        file_name: fileName || null,
        access_mode: accessMode,
        actor_user_id: user.id,
        actor_email:
          normalizeText(profile.email, 320) ||
          normalizeText(user.email, 320) ||
          null,
        actor_name: normalizeText(profile.full_name, 240) || null,
        actor_role: governedRole || null,
        entitlement_basis: entitlementBasis,
        signed_url_expires_at: expiresAt,
        user_agent: normalizeText(request.headers.get("user-agent"), 1000) || null,
        ip_address: ipAddress,
      });

    if (auditError) {
      // Fail closed: do not return a signed URL if the governed access event
      // could not be recorded.
      throw new Error(`Secure PDF access was not released because audit evidence could not be recorded: ${auditError.message}`);
    }

    return NextResponse.json(
      {
        document_id: documentId,
        file_name: fileName,
        signed_url: signedData.signedUrl,
        access_mode: accessMode,
        expires_in_seconds: SIGNED_URL_TTL_SECONDS,
        expires_at: expiresAt,
        investor_code: investorCode || null,
        fund_name: fundName,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Investor Portal secure document access failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create secure investor document access.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

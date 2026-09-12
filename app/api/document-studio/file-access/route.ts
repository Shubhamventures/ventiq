import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  requireDocumentStudioFundAccess,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300;
const INVESTOR_DOCUMENT_BUCKET = "investor-documents";
const MAX_INVESTOR_DOCUMENT_PDF_BYTES = 20 * 1024 * 1024;

type DataRow = Record<string, unknown>;

function normalizeText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function sanitizePdfFileName(value: unknown) {
  const raw = normalizeText(value, 260) || "VENTIQ-investor-document.pdf";
  const safe = raw
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);

  return safe.toLowerCase().endsWith(".pdf")
    ? safe
    : `${safe || "VENTIQ-investor-document"}.pdf`;
}

async function loadInvestorDocumentForActor(
  baseActor: Awaited<ReturnType<typeof authenticateDocumentStudioUser>>,
  documentId: string,
  fundNameInput: unknown,
  permission: "view" | "edit"
) {
  const requestedFundName = normalizeText(fundNameInput, 240);

  if (!requestedFundName) {
    throw new Error("FUND_REQUIRED");
  }

  const actor = await requireDocumentStudioFundAccess(
    baseActor,
    requestedFundName,
    permission
  );

  const { data: documentRecord, error: documentError } = await supabaseAdmin
    .from("investor_documents")
    .select(
      "id, organisation_id, fund_name, document_name, file_name, storage_bucket, storage_path, status, portal_status"
    )
    .eq("id", documentId)
    .ilike("fund_name", actor.fundName)
    .maybeSingle();

  if (documentError) {
    throw new Error(`Unable to load investor document: ${documentError.message}`);
  }

  if (!documentRecord) {
    return { actor, documentRecord: null };
  }

  const documentOrganisationId = normalizeText(
    documentRecord.organisation_id,
    80
  );

  if (
    documentOrganisationId &&
    documentOrganisationId !== actor.organisationId
  ) {
    return { actor, documentRecord: null };
  }

  return { actor, documentRecord };
}

async function createInvestorDocumentSignedAccess(
  request: NextRequest,
  body: DataRow
) {
  const baseActor = await authenticateDocumentStudioUser(request);
  const documentId = normalizeText(body.document_id, 80);

  if (!documentId) {
    return NextResponse.json(
      { error: "Investor document ID is required." },
      { status: 400 }
    );
  }

  const { actor, documentRecord } = await loadInvestorDocumentForActor(
    baseActor,
    documentId,
    body.fund_name,
    "view"
  );

  if (!documentRecord) {
    return NextResponse.json(
      { error: "Private investor PDF not found for the selected fund." },
      { status: 404 }
    );
  }

  const bucket =
    normalizeText(documentRecord.storage_bucket, 160) ||
    INVESTOR_DOCUMENT_BUCKET;
  const storagePath = normalizeText(documentRecord.storage_path, 1000);

  if (!storagePath) {
    return NextResponse.json(
      { error: "This investor document does not have a private storage reference." },
      { status: 409 }
    );
  }

  if (bucket !== INVESTOR_DOCUMENT_BUCKET) {
    return NextResponse.json(
      { error: "Investor document storage bucket is not governed." },
      { status: 409 }
    );
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: signedError?.message || "Unable to create secure PDF access." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      document_kind: "investor_document",
      document_id: documentId,
      fund_name: actor.fundName,
      file_name:
        normalizeText(documentRecord.file_name, 260) ||
        normalizeText(documentRecord.document_name, 260) ||
        "VENTIQ-investor-document.pdf",
      signed_url: signedData.signedUrl,
      expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DataRow;

    if (normalizeText(body.document_kind, 80) === "investor_document") {
      return await createInvestorDocumentSignedAccess(request, body);
    }

    const baseActor = await authenticateDocumentStudioUser(request);
    const documentId = normalizeText(body.document_id, 80);

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required." },
        { status: 400 }
      );
    }

    const { data: documentRecord, error: documentError } = await supabaseAdmin
      .from("document_studio_generated_documents")
      .select(
        "id, organisation_id, fund_name, storage_bucket, storage_path, file_name, generation_status"
      )
      .eq("id", documentId)
      .eq("organisation_id", baseActor.organisationId)
      .maybeSingle();

    if (documentError) {
      return NextResponse.json({ error: documentError.message }, { status: 500 });
    }

    if (!documentRecord || !documentRecord.fund_name) {
      return NextResponse.json(
        { error: "Private PDF not found for your organisation." },
        { status: 404 }
      );
    }

    const actor = await requireDocumentStudioFundAccess(
      baseActor,
      documentRecord.fund_name,
      "view"
    );

    if (
      String(documentRecord.organisation_id || "") !== actor.organisationId ||
      String(documentRecord.fund_name || "") !== actor.fundName
    ) {
      return NextResponse.json(
        { error: "Private PDF not found for the selected fund." },
        { status: 404 }
      );
    }

    const bucket = normalizeText(documentRecord.storage_bucket, 160);
    const storagePath = normalizeText(documentRecord.storage_path, 1000);
    const generationStatus = normalizeText(
      documentRecord.generation_status,
      80
    );

    if (!bucket || !storagePath) {
      return NextResponse.json(
        { error: "This document does not have a private storage reference." },
        { status: 409 }
      );
    }

    if (generationStatus !== "Generated" && generationStatus !== "Published") {
      return NextResponse.json(
        { error: "The PDF is not ready for secure access yet." },
        { status: 409 }
      );
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message || "Unable to create secure PDF access." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        document_id: documentId,
        file_name: documentRecord.file_name || "VENTIQ-document.pdf",
        signed_url: signedData.signedUrl,
        expires_in_seconds: SIGNED_URL_TTL_SECONDS,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create secure PDF access.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const formData = await request.formData();

    const documentKind = normalizeText(
      formData.get("document_kind"),
      80
    );
    const documentId = normalizeText(formData.get("document_id"), 80);
    const fundName = normalizeText(formData.get("fund_name"), 240);
    const fileValue = formData.get("file");

    if (documentKind !== "investor_document") {
      return NextResponse.json(
        { error: "Only governed investor-document storage is supported." },
        { status: 400 }
      );
    }

    if (!documentId || !fundName) {
      return NextResponse.json(
        { error: "Investor document ID and fund name are required." },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required." },
        { status: 400 }
      );
    }

    if (
      fileValue.type !== "application/pdf" ||
      !fileValue.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Only PDF files can be stored in the investor document vault." },
        { status: 400 }
      );
    }

    if (
      fileValue.size <= 0 ||
      fileValue.size > MAX_INVESTOR_DOCUMENT_PDF_BYTES
    ) {
      return NextResponse.json(
        { error: "The PDF must be between 1 byte and 20 MB." },
        { status: 400 }
      );
    }

    const { actor, documentRecord } = await loadInvestorDocumentForActor(
      baseActor,
      documentId,
      fundName,
      "edit"
    );

    if (!documentRecord) {
      return NextResponse.json(
        { error: "Private investor PDF record not found for the selected fund." },
        { status: 404 }
      );
    }

    const fileName = sanitizePdfFileName(fileValue.name);
    const storagePath = `${documentId}/${fileName}`;
    const bytes = Buffer.from(await fileValue.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(INVESTOR_DOCUMENT_BUCKET)
      .upload(storagePath, bytes, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    let updateQuery = supabaseAdmin
      .from("investor_documents")
      .update({
        organisation_id:
          normalizeText(documentRecord.organisation_id, 80) ||
          actor.organisationId,
        storage_bucket: INVESTOR_DOCUMENT_BUCKET,
        storage_path: storagePath,
        storage_url: null,
        status: "stored",
        portal_status: "available",
      })
      .eq("id", documentId)
      .ilike("fund_name", actor.fundName);

    const documentOrganisationId = normalizeText(
      documentRecord.organisation_id,
      80
    );

    if (documentOrganisationId) {
      updateQuery = updateQuery.eq(
        "organisation_id",
        documentOrganisationId
      );
    }

    const { data: updatedDocument, error: updateError } = await updateQuery
      .select(
        "id, organisation_id, fund_name, storage_bucket, storage_path, status, portal_status"
      )
      .maybeSingle();

    if (updateError || !updatedDocument) {
      await supabaseAdmin.storage
        .from(INVESTOR_DOCUMENT_BUCKET)
        .remove([storagePath]);

      return NextResponse.json(
        {
          error:
            updateError?.message ||
            "Unable to persist the private investor document reference.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        document_kind: "investor_document",
        document_id: documentId,
        fund_name: actor.fundName,
        storage_bucket: INVESTOR_DOCUMENT_BUCKET,
        storage_path: storagePath,
        status: updatedDocument.status,
        portal_status: updatedDocument.portal_status,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to store the private investor PDF.",
      },
      { status: 500 }
    );
  }
}

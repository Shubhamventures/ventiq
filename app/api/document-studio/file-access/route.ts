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

export async function POST(request: NextRequest) {
  try {
    const baseActor = await authenticateDocumentStudioUser(request);
    const body = await request.json();
    const documentId = String(body.document_id || "").trim();

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

    const bucket = String(documentRecord.storage_bucket || "").trim();
    const storagePath = String(documentRecord.storage_path || "").trim();
    const generationStatus = String(
      documentRecord.generation_status || ""
    ).trim();

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

    return NextResponse.json({
      document_id: documentId,
      file_name: documentRecord.file_name || "VENTIQ-document.pdf",
      signed_url: signedData.signedUrl,
      expires_in_seconds: SIGNED_URL_TTL_SECONDS,
    });
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
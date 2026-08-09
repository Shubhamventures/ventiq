import { NextRequest, NextResponse } from "next/server";
import {
  authenticateDocumentStudioUser,
  documentStudioAuthErrorResponse,
  listDocumentStudioFunds,
} from "../../../../lib/server/documentStudioAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateDocumentStudioUser(request);
    const funds = await listDocumentStudioFunds(actor);

    return NextResponse.json({
      funds,
      activeOrganisationId: actor.organisationId,
    });
  } catch (error) {
    const authResponse = documentStudioAuthErrorResponse(error);
    if (authResponse) return authResponse;

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load Document Studio fund access.",
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from "next/server";
import {
  authenticateGovernedFundUser,
  governedFundAuthErrorResponse,
  listGovernedFunds,
} from "../../../lib/server/governedFundAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateGovernedFundUser(request);
    const funds = await listGovernedFunds(actor);

    return NextResponse.json({
      funds,
      activeOrganisationId: actor.organisationId,
    });
  } catch (error) {
    const authResponse = governedFundAuthErrorResponse(error);

    if (authResponse) {
      return authResponse;
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load governed VENTIQ fund context.",
      },
      { status: 500 }
    );
  }
}

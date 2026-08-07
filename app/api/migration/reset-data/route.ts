import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DISABLED_MESSAGE =
  "The migration reset endpoint has been disabled as part of VENTIQ production hardening. Use an authorised, fund-scoped recovery procedure instead.";

function disabledResponse(request: NextRequest) {
  console.warn("Blocked migration reset API attempt", {
    method: request.method,
    path: request.nextUrl.pathname,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json(
    {
      error: DISABLED_MESSAGE,
      code: "MIGRATION_RESET_DISABLED",
      destructiveOperationAllowed: false,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}

export async function GET(request: NextRequest) {
  return disabledResponse(request);
}

export async function POST(request: NextRequest) {
  return disabledResponse(request);
}

export async function PUT(request: NextRequest) {
  return disabledResponse(request);
}

export async function PATCH(request: NextRequest) {
  return disabledResponse(request);
}

export async function DELETE(request: NextRequest) {
  return disabledResponse(request);
}
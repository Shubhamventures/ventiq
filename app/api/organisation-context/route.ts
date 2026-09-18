import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function switchErrorResponse(message: string) {
  if (
    message.includes("VENTIQ_SWITCH_STALE_CONTEXT")
  ) {
    return NextResponse.json(
      {
        error:
          "Your organisation context changed in another session. Reload VENTIQ and try again.",
      },
      { status: 409 }
    );
  }

  if (message.includes("VENTIQ_SWITCH_AAL2_REQUIRED")) {
    return NextResponse.json(
      {
        error:
          "Multi-factor authentication is required before switching this organisation context.",
      },
      { status: 428 }
    );
  }

  if (
    message.includes("VENTIQ_SWITCH_TARGET_MEMBERSHIP_REQUIRED") ||
    message.includes("VENTIQ_SWITCH_TARGET_ORGANISATION_INACTIVE") ||
    message.includes("VENTIQ_SWITCH_PROFILE_NOT_ACTIVE")
  ) {
    return NextResponse.json(
      {
        error:
          "That organisation is not available to your active VENTIQ membership.",
      },
      { status: 403 }
    );
  }

  if (message.includes("VENTIQ_SWITCH_TARGET_REQUIRED")) {
    return NextResponse.json(
      { error: "Select a valid organisation before switching context." },
      { status: 400 }
    );
  }

  return null;
}

export async function POST(request: NextRequest) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Please sign in before switching organisation context." },
      { status: 401 }
    );
  }

  const { data: authResult, error: authError } =
    await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !authResult.user) {
    return NextResponse.json(
      { error: "Your VENTIQ session is no longer valid. Please sign in again." },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "VENTIQ could not read the organisation switch request." },
      { status: 400 }
    );
  }

  const targetOrganisationId = normalizeText(
    body.targetOrganisationId,
    80
  );
  const expectedOrganisationIdRaw = normalizeText(
    body.expectedOrganisationId,
    80
  );

  if (!targetOrganisationId || !isUuid(targetOrganisationId)) {
    return NextResponse.json(
      { error: "Select a valid organisation before switching context." },
      { status: 400 }
    );
  }

  if (
    expectedOrganisationIdRaw &&
    !isUuid(expectedOrganisationIdRaw)
  ) {
    return NextResponse.json(
      { error: "The current organisation context is invalid. Reload VENTIQ." },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "VENTIQ organisation switching is not configured." },
      { status: 503 }
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await userClient.rpc(
    "ventiq_switch_active_organisation",
    {
      p_expected_current_organisation_id:
        expectedOrganisationIdRaw || null,
      p_target_organisation_id: targetOrganisationId,
    }
  );

  if (error) {
    const mapped = switchErrorResponse(error.message || "");

    if (mapped) {
      return mapped;
    }

    return NextResponse.json(
      { error: "VENTIQ could not switch organisation context." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    context: data,
  });
}

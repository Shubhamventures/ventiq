import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const APP_ACCESS_COOKIE = "ventiq_app_access";
const ACCESS_SECONDS = 8 * 60 * 60;

function getSecret() {
  // W1G5: dedicated application-perimeter secret only.
  return process.env.VENTIQ_APP_ACCESS_SECRET || "";
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return authorization.slice(7).trim();
}

function signPayload(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function clearCookie(response: NextResponse) {
  response.cookies.set(APP_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const secret = getSecret();
  const accessToken = getBearerToken(request);

  if (!supabaseUrl || !serviceRoleKey || !secret) {
    return NextResponse.json(
      { error: "VENTIQ authentication perimeter is not configured." },
      { status: 503 }
    );
  }

  if (!accessToken) {
    return clearCookie(
      NextResponse.json(
        { error: "A VENTIQ session is required." },
        { status: 401 }
      )
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    return clearCookie(
      NextResponse.json(
        { error: "The VENTIQ session is no longer valid." },
        { status: 401 }
      )
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("ventiq_user_profiles")
    .select("user_id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "VENTIQ could not verify the application profile." },
      { status: 500 }
    );
  }

  if (!profile || profile.status !== "Active") {
    return clearCookie(
      NextResponse.json(
        { error: "This VENTIQ account is not active." },
        { status: 403 }
      )
    );
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_SECONDS;
  const payload = `${user.id}.${expiresAt}`;
  const signature = signPayload(secret, payload);
  const cookieValue = `${payload}.${signature}`;

  const response = NextResponse.json({
    ok: true,
    expires_at: expiresAt,
  });

  response.cookies.set(APP_ACCESS_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SECONDS,
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export async function DELETE() {
  return clearCookie(
    NextResponse.json({
      ok: true,
      cleared: true,
    })
  );
}

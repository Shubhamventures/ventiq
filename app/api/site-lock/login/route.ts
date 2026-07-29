import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const COOKIE_NAME = "ventiq_site_access";

export async function POST(request: NextRequest) {
  try {
    const expectedPassword = process.env.SITE_LOCK_PASSWORD;
    const accessToken = process.env.SITE_LOCK_TOKEN;

    if (!expectedPassword || !accessToken) {
      return NextResponse.json(
        { error: "Site lock environment variables are not configured." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password = String(body.password || "");

    if (password !== expectedPassword) {
      return NextResponse.json(
        { error: "Incorrect password." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      message: "VENTIQ unlocked successfully.",
    });

    response.cookies.set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to unlock VENTIQ.",
      },
      { status: 500 }
    );
  }
}
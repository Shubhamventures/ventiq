import { NextRequest, NextResponse } from "next/server";

const APP_ACCESS_COOKIE = "ventiq_app_access";

// W1G5: public marketing/demo/auth surfaces only.
// Everything not explicitly public is private by default.
const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/demo",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/product-overview",
  "/auth/login",
  "/auth/set-password",
  "/auth/welcome",
  "/auth/unauthorized",
  "/api/auth/perimeter",
  "/api/founder/leads",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/google158f336352e02741.html",
]);

function isStaticPublicAsset(pathname: string) {
  if (pathname.startsWith("/api/")) return false;

  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/public/") ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

function isPublicPath(pathname: string) {
  return PUBLIC_EXACT_PATHS.has(pathname) || isStaticPublicAsset(pathname);
}

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

function getAppAccessSecret() {
  // W1G5: the authenticated application perimeter uses its own
  // dedicated signing secret with no legacy password-gate fallback.
  return process.env.VENTIQ_APP_ACCESS_SECRET || "";
}

async function signPayload(secret: string, payload: string) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function equalSignature(left: string, right: string) {
  if (left.length !== right.length) return false;

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

async function hasValidAppAccess(request: NextRequest) {
  const secret = getAppAccessSecret();
  const cookie = request.cookies.get(APP_ACCESS_COOKIE)?.value || "";

  if (!secret || !cookie) return false;

  const parts = cookie.split(".");
  if (parts.length !== 3) return false;

  const [userId, expiresAtRaw, suppliedSignature] = parts;
  const expiresAt = Number(expiresAtRaw);

  if (
    !userId ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000) ||
    !suppliedSignature
  ) {
    return false;
  }

  const payload = `${userId}.${expiresAtRaw}`;
  const expectedSignature = await signPayload(secret, payload);

  return equalSignature(suppliedSignature, expectedSignature);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (await hasValidAppAccess(request)) {
    return privateResponse(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return privateResponse(
      NextResponse.json(
        { error: "Authenticated VENTIQ application access is required." },
        { status: 401 }
      )
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.search = "";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return privateResponse(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

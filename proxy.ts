import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ventiq_site_access";
const LOCK_PAGE = "/site-lock";
const LOGIN_API = "/api/site-lock/login";

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/faq",
  "/security",
  "/privacy",
  "/terms",
  "/product-overview",
  "/auth/login",
  "/auth/set-password",
  "/auth/welcome",
  "/auth/unauthorized",
  "/robots.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/google158f336352e02741.html",
  LOCK_PAGE,
  LOGIN_API,
]);

function isStaticPublicAsset(pathname: string) {
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

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public marketing pages and authentication entry points are deliberately
  // reachable without the temporary VENTIQ site-lock cookie.
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // During Architecture Safety & Canonicalisation, keep every operational
  // workspace and API behind the existing site lock. This is intentionally
  // temporary: the site lock is not a substitute for application auth/RBAC.
  const expectedToken = process.env.SITE_LOCK_TOKEN;
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;

  if (expectedToken && cookieToken === expectedToken) {
    return privateResponse(NextResponse.next());
  }

  if (pathname.startsWith("/api")) {
    return privateResponse(
      NextResponse.json(
        { error: "VENTIQ private application access is required." },
        { status: 401 }
      )
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOCK_PAGE;
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return privateResponse(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ventiq_site_access";
const LOCK_PAGE = "/site-lock";
const LOGIN_API = "/api/site-lock/login";

function isPublicPath(pathname: string) {
  return (
    pathname === LOCK_PAGE ||
    pathname === LOGIN_API ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const expectedToken = process.env.SITE_LOCK_TOKEN;
  const cookieToken = request.cookies.get(COOKIE_NAME)?.value;

  if (expectedToken && cookieToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.json(
      { error: "VENTIQ is locked. Password access is required." },
      { status: 401 }
    );
  }

  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = LOCK_PAGE;
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

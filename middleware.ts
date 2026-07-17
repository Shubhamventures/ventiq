import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/manifest.json") return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/.well-known/")) return true;
  if (PUBLIC_FILE.test(pathname)) return true;

  return false;
}

function unauthorizedResponse() {
  return new NextResponse("VENTIQ demo access required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="VENTIQ Private Demo"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const demoUsername = process.env.VENTIQ_DEMO_USERNAME;
  const demoPassword = process.env.VENTIQ_DEMO_PASSWORD;

  if (!demoUsername || !demoPassword) {
    return new NextResponse("VENTIQ demo lock is not configured.", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  try {
    const encodedCredentials = authHeader.replace("Basic ", "");
    const decodedCredentials = atob(encodedCredentials);
    const [username, ...passwordParts] = decodedCredentials.split(":");
    const password = passwordParts.join(":");

    const isValidUser = username === demoUsername && password === demoPassword;

    if (!isValidUser) {
      return unauthorizedResponse();
    }

    const response = NextResponse.next();

    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch {
    return unauthorizedResponse();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

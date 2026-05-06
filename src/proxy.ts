import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import { verifySessionToken } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/health", "/_next", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.searchParams.set("next", nextPath);

  const response = NextResponse.redirect(url);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

function apiUnauthorized() {
  const response = NextResponse.json(
    { ok: false, error: "Unauthorized", details: null },
    { status: 401 },
  );
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authenticated = verifySessionToken(token);

  if (pathname === "/login") {
    if (!authenticated) return NextResponse.next();

    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!authenticated) {
    if (pathname.startsWith("/api")) {
      return apiUnauthorized();
    }

    return redirectToLogin(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"],
};

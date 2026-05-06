import { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";

export function requestIsAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

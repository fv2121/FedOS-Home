import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

// Dev-only fallback: bcrypt hash of "fedos". Override AUTH_PASSWORD_HASH in production.
const DEV_PASSWORD_HASH = "$2b$10$IYe0jl7VjQEcDtktwfIRJ.4E49KqTg16WlK4ctTosEWPN5xiCIVI2";

function passwordHash(): string {
  return process.env.AUTH_PASSWORD_HASH ?? DEV_PASSWORD_HASH;
}

export async function isPasswordValid(candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, passwordHash());
}

export async function getSessionAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export const authCookieName = AUTH_COOKIE_NAME;
export { createSessionToken, verifySessionToken };

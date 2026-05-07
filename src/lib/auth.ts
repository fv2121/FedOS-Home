import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth-constants";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/session-token";

function passwordHash(): string {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!hash) throw new Error("AUTH_PASSWORD_HASH environment variable is required");
  return hash;
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

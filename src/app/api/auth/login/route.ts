import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { authCookieName, createSessionToken, isPasswordValid } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return fail("Too many login attempts. Try again later.", 429);
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim() ?? "";

  if (!(await isPasswordValid(password))) {
    return fail("Invalid password", 401);
  }

  const token = createSessionToken();
  const store = await cookies();

  store.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return ok({ authenticated: true });
}

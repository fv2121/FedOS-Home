import { cookies } from "next/headers";
import { authCookieName } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function POST() {
  const store = await cookies();
  store.delete(authCookieName);
  return ok({ authenticated: false });
}

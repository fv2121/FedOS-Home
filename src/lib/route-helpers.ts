import { NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { fail } from "@/lib/http";
import { requestIsAuthenticated } from "@/lib/api-auth";

export async function requireJson<T>(request: NextRequest, schema: ZodSchema<T>) {
  if (!requestIsAuthenticated(request)) {
    return { error: fail("Unauthorized", 401) };
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      error: fail("Invalid request", 400, parsed.error.flatten()),
    };
  }

  return { data: parsed.data };
}

export function requireAuth(request: NextRequest) {
  if (!requestIsAuthenticated(request)) {
    return fail("Unauthorized", 401);
  }

  return null;
}

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
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

export function failFromError(operation: string, error: unknown) {
  if (error instanceof Error && error.message === "Task not found") {
    return fail("Task not found", 404);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return fail("Related record not found", 400, error.meta);
    }

    if (error.code === "P2025") {
      return fail("Record not found", 404, error.meta);
    }

    if (error.code === "P2002") {
      return fail("Duplicate record", 400, error.meta);
    }
  }

  return fail(`${operation} failed`, 500, String(error));
}

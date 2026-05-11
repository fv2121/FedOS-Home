"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function safeNextPath(nextPath: string): string {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
  return nextPath;
}

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body?.error ?? "Login failed");
      setLoading(false);
      return;
    }

    router.push(safeNextPath(nextPath || "/"));
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">FedOS Home</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-[var(--color-text-primary)]">Sign in</h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Single-user gate for your personal task execution workspace.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:ring focus:ring-[color-mix(in_srgb,var(--color-accent)_35%,transparent)]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-[var(--color-text-danger)]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

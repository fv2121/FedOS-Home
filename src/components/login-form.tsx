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
    <div className="mx-auto w-full max-w-sm rounded-3xl border border-white/60 bg-white/85 p-6 shadow-[0_30px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">FedOS Tasks</p>
      <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">
        Single-user gate for your personal task execution workspace.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-amber-200 transition focus:ring"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

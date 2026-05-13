export const dynamic = "force-dynamic";

export const metadata = {
  title: "System / API — FedOS Admin",
};

type Endpoint = {
  method: "GET" | "POST";
  path: string;
  description: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/health",
    description: "Basic service liveness probe.",
  },
  {
    method: "GET",
    path: "/api/briefings",
    description: "Most recent persisted briefing packages.",
  },
  {
    method: "POST",
    path: "/api/briefings/run",
    description: "Generate a briefing from a prepared signal pack.",
  },
  {
    method: "POST",
    path: "/api/debug/intelligence/preflight",
    description: "Preflight the briefing pipeline without LLM or DB.",
  },
  {
    method: "POST",
    path: "/api/debug/intelligence/run",
    description: "Full debug pipeline; honours the persist flag.",
  },
  {
    method: "GET",
    path: "/api/memory-digest/status",
    description: "Current digest workflow status — hash, staleness, presence.",
  },
];

const METHOD_STYLE: Record<"GET" | "POST", string> = {
  GET: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  POST: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export default function SystemApiPage() {
  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-10">
      <div className="w-full px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            System / API
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Home-owned HTTP endpoints. GET routes are browser-clickable; POST
            routes require a request body.
          </p>
        </header>

        <div className="overflow-hidden rounded-lg border border-[var(--color-line)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-panel)]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Path
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)] bg-[var(--color-surface-primary)]">
              {ENDPOINTS.map((ep) => (
                <tr key={ep.path}>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${METHOD_STYLE[ep.method]}`}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)]">
                    {ep.path}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
                    {ep.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

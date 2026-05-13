import Link from "next/link";
import { ExternalLink } from "lucide-react";

type Status = "live" | "planned" | "api" | "post-only" | "retired";

type NavEntry = {
  name: string;
  href: string;
  status: Status;
  description: string;
  external?: boolean;
};

type NavGroup = {
  title: string;
  description: string;
  entries: NavEntry[];
};

const GROUPS: NavGroup[] = [
  {
    title: "Product",
    description:
      "Surfaces Federico uses day-to-day. Primary navigation lives in the top/bottom bar.",
    entries: [
      {
        name: "Home (briefing)",
        href: "/",
        status: "live",
        description: "Latest morning briefing and proposed-action review.",
      },
      {
        name: "Tasks",
        href: "/?view=tasks",
        status: "live",
        description: "Durable task list. Approved proposals land here.",
      },
      {
        name: "New task",
        href: "/?view=new",
        status: "live",
        description: "Manual task creation flow.",
      },
      {
        name: "Chat feedback / revisions",
        href: "#",
        status: "planned",
        description:
          "Challenge and revise briefings inline. Tracked as HCI-09.",
      },
    ],
  },
  {
    title: "Operator",
    description:
      "Internal tools for tuning the briefing pipeline and Memory artifacts.",
    entries: [
      {
        name: "Debug Console",
        href: "/admin/debug",
        status: "live",
        description:
          "Run the briefing pipeline end-to-end and inspect each stage.",
      },
      {
        name: "Memory Digest",
        href: "/admin/memory-digest",
        status: "live",
        description:
          "Generate, review, edit, and approve the digest of FedOS Memory.",
      },
    ],
  },
  {
    title: "System / API",
    description:
      "Home-owned endpoints. Pages with the `api` badge are JSON; `post-only` items are not browser-clickable.",
    entries: [
      {
        name: "Health check",
        href: "/api/health",
        status: "api",
        description: "GET — basic service liveness probe.",
      },
      {
        name: "Briefings list",
        href: "/api/briefings",
        status: "api",
        description: "GET — most recent persisted briefing packages.",
      },
      {
        name: "Run briefing",
        href: "/api/briefings/run",
        status: "post-only",
        description: "POST — generate a briefing from a prepared signal pack.",
      },
      {
        name: "Debug preflight",
        href: "/api/debug/intelligence/preflight",
        status: "post-only",
        description: "POST — preflight the briefing pipeline without LLM/DB.",
      },
      {
        name: "Debug run",
        href: "/api/debug/intelligence/run",
        status: "post-only",
        description: "POST — full debug pipeline; honours `persist` flag.",
      },
      {
        name: "Memory Digest status",
        href: "/api/memory-digest/status",
        status: "api",
        description:
          "GET — current digest workflow status (hash, staleness, presence).",
      },
    ],
  },
];

const STATUS_STYLE: Record<Status, string> = {
  live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  planned:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  api: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "post-only":
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  retired:
    "border-[var(--color-line)] bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function EntryRow({ entry }: { entry: NavEntry }) {
  const clickable = entry.status !== "post-only" && entry.status !== "planned";
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            {entry.name}
          </span>
          <StatusBadge status={entry.status} />
        </div>
        <div className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
          {entry.description}
        </div>
        <div className="mt-1 font-mono text-[11px] text-[var(--color-text-tertiary)]">
          {entry.href}
        </div>
      </div>
      {entry.external ? (
        <ExternalLink className="mt-1 h-3.5 w-3.5 text-[var(--color-text-tertiary)]" />
      ) : null}
    </div>
  );

  const baseClass =
    "block rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-3 transition";

  if (!clickable) {
    return (
      <div className={`${baseClass} opacity-70`} aria-disabled="true">
        {content}
      </div>
    );
  }
  return (
    <Link
      href={entry.href}
      className={`${baseClass} hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-secondary)]`}
    >
      {content}
    </Link>
  );
}

export function NavIndex() {
  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-10">
      <div className="w-full px-6 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            FedOS Navigation
          </h1>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Launchpad for product surfaces, operator tools, and Home-owned API
            endpoints. Use the primary nav for day-to-day work; this page is
            for finding less-frequent surfaces quickly.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <section
              key={group.title}
              className="rounded-lg border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
            >
              <div className="mb-3">
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {group.description}
                </p>
              </div>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <EntryRow key={entry.name} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 text-[11px] text-[var(--color-text-tertiary)]">
          Retired / intentionally omitted: the legacy scored debug page and the
          FedOS Intelligence FastAPI/Swagger surfaces are not linked here. Home
          owns its own pipeline and does not depend on the legacy runtime.
        </p>
      </div>
    </div>
  );
}

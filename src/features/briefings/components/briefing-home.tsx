"use client";

import { useMemo, useTransition } from "react";
import { format, getISOWeek } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PrimaryNav } from "@/components/primary-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { DEFAULT_OWNER } from "@/lib/constants";
import type {
  BriefingPackageDetail,
  BriefingProposedAction,
} from "../model/briefing-types";
import { BriefingSection } from "./briefing-section";
import { ProposedActionCard } from "./proposed-action-card";
import { useBriefingActions } from "../hooks/use-briefing-actions";

type Props = {
  briefing: BriefingPackageDetail | null;
};

export function BriefingHome({ briefing }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const actions = useBriefingActions();

  function updateURL(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    });
  }

  const activeView = searchParams.get("view");

  const { pending, decided } = useMemo(() => {
    const pending: BriefingProposedAction[] = [];
    const decided: BriefingProposedAction[] = [];
    for (const action of briefing?.proposed_actions ?? []) {
      if (action.status === "pending") pending.push(action);
      else decided.push(action);
    }
    return { pending, decided };
  }, [briefing]);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const now = new Date();
  const dateLabel = `${format(now, "EEE d MMM")} · week ${getISOWeek(now)}`;

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-28 md:pb-10">
      <PrimaryNav activeView={activeView} updateURL={updateURL} />

      <div className="mx-auto w-full max-w-3xl px-3 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] md:p-6">
        <header className="mb-5 flex items-start justify-between gap-3 md:mb-8">
          <div>
            <h1 className="text-[1.6rem] font-bold leading-tight text-[var(--color-text-primary)] md:text-3xl">
              {greeting}, {DEFAULT_OWNER}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
              {dateLabel}
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/avatar.png"
            alt="Profile"
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        </header>

        {!briefing ? (
          <EmptyState />
        ) : (
          <main className="space-y-4">
            {actions.error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
                {actions.error}{" "}
                <button
                  type="button"
                  onClick={actions.clearError}
                  className="ml-1 underline"
                >
                  dismiss
                </button>
              </div>
            )}

            <BriefingSection title="Narrative">
              <p>{briefing.payload.narrative}</p>
            </BriefingSection>

            {briefing.payload.top_priorities.length > 0 && (
              <BriefingSection title="Top priorities">
                <ol className="space-y-3">
                  {briefing.payload.top_priorities
                    .slice()
                    .sort((a, b) => a.rank - b.rank)
                    .map((priority) => (
                      <li
                        key={`${priority.rank}-${priority.title}`}
                        className="flex gap-3"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-xs font-semibold text-[var(--color-accent)]">
                          {priority.rank}
                        </span>
                        <div>
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {priority.title}
                          </p>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {priority.why}
                          </p>
                        </div>
                      </li>
                    ))}
                </ol>
              </BriefingSection>
            )}

            {briefing.payload.recommendations.length > 0 && (
              <BriefingSection title="Recommendations">
                <ul className="space-y-2">
                  {briefing.payload.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl bg-[var(--color-surface-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              </BriefingSection>
            )}

            {briefing.payload.uncertainty && (
              <BriefingSection title="Uncertainty">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {briefing.payload.uncertainty}
                </p>
              </BriefingSection>
            )}

            <section>
              <h3 className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Proposed actions {pending.length > 0 ? `· ${pending.length} pending` : ""}
              </h3>
              {pending.length === 0 && decided.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-4 text-sm text-[var(--color-text-tertiary)]">
                  No proposed actions in this briefing.
                </p>
              ) : (
                <div className="space-y-3">
                  {pending.map((p) => (
                    <ErrorBoundary key={p.id}>
                      <ProposedActionCard proposal={p} actions={actions} />
                    </ErrorBoundary>
                  ))}
                  {decided.length > 0 && (
                    <details className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)]/60 p-3">
                      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Already decided ({decided.length})
                      </summary>
                      <div className="mt-3 space-y-3">
                        {decided.map((p) => (
                          <ErrorBoundary key={p.id}>
                            <ProposedActionCard proposal={p} actions={actions} />
                          </ErrorBoundary>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </section>

            <footer className="pt-2 text-[11px] text-[var(--color-text-tertiary)]">
              Briefing {briefing.id.slice(0, 8)} · {format(new Date(briefing.created_at), "d MMM HH:mm")}
              {briefing.model ? ` · ${briefing.model}` : ""}
              {briefing.memory_digest_stale ? " · memory digest stale" : ""}
            </footer>
          </main>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)] p-8 text-center">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
        No briefing yet
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Generate one with{" "}
        <code className="rounded bg-[var(--color-surface-primary)] px-1.5 py-0.5 text-xs">
          npx tsx scripts/smoke-briefing-generation.ts --persist
        </code>{" "}
        or by calling{" "}
        <code className="rounded bg-[var(--color-surface-primary)] px-1.5 py-0.5 text-xs">
          POST /api/briefings/run
        </code>
        .
      </p>
    </div>
  );
}

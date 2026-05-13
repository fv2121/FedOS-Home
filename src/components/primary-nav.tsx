"use client";

import clsx from "clsx";
import { Home, ListChecks, Plus, type LucideIcon } from "lucide-react";

type NavItem = {
  id: "home" | "tasks" | "new";
  label: string;
  icon: LucideIcon;
  matches: (activeView: string | null | undefined) => boolean;
  hrefView: string | null;
};

const ITEMS: NavItem[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    matches: (v) => !v || v === "home",
    hrefView: null,
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: ListChecks,
    matches: (v) => v === "tasks" || v === "done",
    hrefView: "tasks",
  },
  {
    id: "new",
    label: "New task",
    icon: Plus,
    matches: (v) => v === "new",
    hrefView: "new",
  },
];

type Props = {
  activeView: string | null | undefined;
  updateURL: (next: Record<string, string | null>) => void;
};

/**
 * Primary navigation surface used by both the briefing Home view and the
 * durable Tasks view. Renders as a sticky top bar on desktop and a bottom
 * tab bar on mobile so the labels and ordering stay consistent.
 */
export function PrimaryNav({ activeView, updateURL }: Props) {
  return (
    <>
      <nav className="sticky top-0 z-20 hidden border-b border-[var(--color-line)] bg-[var(--color-panel)]/90 backdrop-blur md:block">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-6 py-3">
          <span className="mr-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            FedOS
          </span>
          <ul className="flex items-center gap-1">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.matches(activeView);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => updateURL({ view: item.hrefView })}
                    className={clsx(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active
                        ? "bg-[var(--color-surface-secondary)] text-[var(--color-accent)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-panel)] px-2 pt-1 [padding-bottom:max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <ul className="grid grid-cols-3 gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.matches(activeView);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => updateURL({ view: item.hrefView })}
                  className={clsx(
                    "flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-1 py-2 text-[13px] font-medium transition",
                    active
                      ? "bg-[var(--color-surface-secondary)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)]",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label.toLowerCase()}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

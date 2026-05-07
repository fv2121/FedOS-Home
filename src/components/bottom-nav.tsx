"use client";

import clsx from "clsx";
import { Home, Plus } from "lucide-react";

type Props = {
  activeView: string;
  updateURL: (next: Record<string, string | null>) => void;
};

export function BottomNav({ activeView, updateURL }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-line)] bg-[var(--color-panel)] px-2 pt-1 [padding-bottom:max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <ul className="grid grid-cols-2 gap-1">
        <li>
          <button
            onClick={() => updateURL({ view: "home" })}
            className={clsx(
              "flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-1 py-2 text-[13px] font-medium transition",
              activeView === "home"
                ? "bg-[var(--color-surface-secondary)] text-[var(--color-accent)]"
                : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)]",
            )}
          >
            <Home className="h-5 w-5" />
            home
          </button>
        </li>
        <li>
          <button
            onClick={() => updateURL({ view: "new" })}
            className={clsx(
              "flex min-h-14 w-full flex-col items-center justify-center rounded-xl px-1 py-2 text-[13px] font-medium transition",
              activeView === "new"
                ? "bg-[var(--color-surface-secondary)] text-[var(--color-accent)]"
                : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-secondary)]",
            )}
          >
            <Plus className="h-5 w-5" />
            new task
          </button>
        </li>
      </ul>
    </nav>
  );
}

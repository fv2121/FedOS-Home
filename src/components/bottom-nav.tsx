"use client";

import clsx from "clsx";
import { Home, Plus } from "lucide-react";

type Props = {
  activeView: string;
  updateURL: (next: Record<string, string | null>) => void;
};

export function BottomNav({ activeView, updateURL }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pt-1 [padding-bottom:max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <ul className="grid grid-cols-2 gap-1">
        <li>
          <button
            onClick={() => updateURL({ view: "home" })}
            className={clsx(
              "flex w-full flex-col items-center rounded-xl px-1 py-1 text-[11px]",
              activeView === "home" ? "bg-slate-900 text-white" : "text-slate-600",
            )}
          >
            <Home className="h-4 w-4" />
            home
          </button>
        </li>
        <li>
          <button
            onClick={() => updateURL({ view: "new" })}
            className={clsx(
              "flex w-full flex-col items-center rounded-xl px-1 py-1 text-[11px]",
              activeView === "new" ? "bg-slate-900 text-white" : "text-slate-600",
            )}
          >
            <Plus className="h-4 w-4" />
            new task
          </button>
        </li>
      </ul>
    </nav>
  );
}

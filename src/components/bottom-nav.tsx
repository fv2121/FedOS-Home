"use client";

import clsx from "clsx";
import { CircleCheck, Home } from "lucide-react";

const navItems = ["home", "done"] as const;

const navIcon = {
  home: Home,
  done: CircleCheck,
} as const;

type Props = {
  activeView: string;
  updateURL: (next: Record<string, string | null>) => void;
};

export function BottomNav({ activeView, updateURL }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 px-2 pt-1 [padding-bottom:max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <ul className="grid grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = navIcon[item];
          const active = item === activeView;
          return (
            <li key={item}>
              <button
                onClick={() => updateURL({ view: item })}
                className={clsx(
                  "flex w-full flex-col items-center rounded-xl px-1 py-1 text-[11px]",
                  active ? "bg-slate-900 text-white" : "text-slate-600",
                )}
              >
                <Icon className="h-4 w-4" />
                {item}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

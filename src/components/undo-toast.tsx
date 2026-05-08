"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 50;

type Props = {
  taskTitle: string;
  durationMs: number;
  onUndo: () => void;
};

export function UndoToast({ taskTitle, durationMs, onUndo }: Props) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(pct);
      if (pct <= 0) clearInterval(interval);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 z-[65] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] shadow-xl md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      {/* Progress bar drains left to right */}
      <div
        className="h-0.5 bg-[var(--color-accent)]"
        style={{ width: `${progress}%`, transition: `width ${TICK_MS}ms linear` }}
      />
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate text-sm text-[var(--color-text-primary)]">
          <span className="text-[var(--color-text-tertiary)]">Deleted </span>
          <span className="font-semibold">{taskTitle}</span>
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-lg px-3 py-1 text-sm font-bold text-[var(--color-accent)] transition active:opacity-70"
        >
          Undo
        </button>
      </div>
    </div>
  );
}

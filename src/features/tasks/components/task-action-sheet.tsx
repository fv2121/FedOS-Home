"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { Edit2, Trash2 } from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { PriorityConfig, StatusConfig, VisibleTaskRow } from "../model/dashboard-types";

type Props = {
  task: VisibleTaskRow;
  statusConfigs: StatusConfig[];
  priorityConfigs: PriorityConfig[];
  onEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: string) => void;
  onSetPriority: (priority: string) => void;
  onClose: () => void;
};

export function TaskActionSheet({
  task,
  statusConfigs,
  priorityConfigs,
  onEdit,
  onDelete,
  onSetStatus,
  onSetPriority,
  onClose,
}: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const statusColorMap = Object.fromEntries(statusConfigs.map((c) => [c.status, c.color]));
  const priorityColorMap = Object.fromEntries(priorityConfigs.map((c) => [c.priority, c.color]));

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
        onPointerDown={onClose}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Actions for ${task.title}`}
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-3xl bg-[var(--color-surface-primary)] shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-[var(--color-line)]" />
        </div>

        {/* Task title */}
        <p className="truncate px-5 py-2 text-sm font-semibold text-[var(--color-text-secondary)]">
          {task.title}
        </p>

        <div className="space-y-1 px-3 pb-3">
          <ActionRow
            icon={<Edit2 className="h-5 w-5" />}
            label="Edit"
            onClick={() => {
              onEdit();
              onClose();
            }}
          />

          <SectionLabel>Status</SectionLabel>
          <div className="flex gap-2 px-4 pb-1">
            {TASK_STATUSES.map((status) => {
              const color = statusColorMap[status] ?? "var(--color-text-secondary)";
              const selected = task.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    onSetStatus(status);
                    onClose();
                  }}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold capitalize transition-opacity active:opacity-70"
                  style={{
                    border: `1.5px solid ${color}`,
                    backgroundColor: selected ? color : `${color}22`,
                    color: selected ? "var(--color-accent-foreground)" : color,
                  }}
                >
                  {status}
                </button>
              );
            })}
          </div>

          <SectionLabel>Priority</SectionLabel>
          <div className="flex gap-2 px-4 pb-1">
            {TASK_PRIORITIES.map((priority) => {
              const color = priorityColorMap[priority] ?? "var(--color-text-secondary)";
              const selected = task.priority === priority;
              return (
                <button
                  key={priority}
                  type="button"
                  onClick={() => {
                    onSetPriority(priority);
                    onClose();
                  }}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold capitalize transition-opacity active:opacity-70"
                  style={{
                    border: `1.5px solid ${color}`,
                    backgroundColor: selected ? color : `${color}22`,
                    color: selected ? "var(--color-accent-foreground)" : color,
                  }}
                >
                  {priority}
                </button>
              );
            })}
          </div>

          <ActionRow
            icon={<Trash2 className="h-5 w-5" />}
            label="Delete"
            onClick={() => {
              onDelete();
              onClose();
            }}
            danger
          />
        </div>
      </div>
    </>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left text-base font-semibold transition active:bg-[var(--color-surface-secondary)]",
        danger ? "text-[var(--color-text-danger)]" : "text-[var(--color-text-primary)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
      {children}
    </p>
  );
}

"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import type { VisibleTaskRow, Category, TaskStatus, PriorityConfig, StatusConfig } from "./dashboard-types";

export type TaskCardMenu = "status" | "priority" | "category";

type Props = {
  task: VisibleTaskRow;
  categories: Category[];
  priorityConfigs: PriorityConfig[];
  statusConfigs: StatusConfig[];
  openMenu: TaskCardMenu | null;
  onOpenMenu: (menu: TaskCardMenu | null) => void;
  onComplete: (id: string) => void | Promise<void>;
  onSetStatus: (id: string, status: string) => void | Promise<void>;
  onSetPriority: (id: string, priority: string) => void | Promise<void>;
  onSetCategory: (id: string, categoryId: string) => void | Promise<void>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
};

const PRIORITY_DISPLAY: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

function displayStatus(status: TaskStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function requiredColor(colors: Record<string, string>, key: string, configName: string) {
  const color = colors[key];
  if (!color) {
    throw new Error(`Missing ${configName} color config for "${key}"`);
  }
  return color;
}

export function TaskCard({
  task,
  categories,
  openMenu,
  onOpenMenu,
  priorityConfigs,
  statusConfigs,
  onComplete,
  onSetStatus,
  onSetPriority,
  onSetCategory,
  onEdit,
  onDelete,
}: Props) {
  const [previousStatus, setPreviousStatus] = useState<TaskStatus>(
    task.status === "done" ? "active" : task.status,
  );
  const isDone = task.status === "done";
  const priorityColorMap = Object.fromEntries(priorityConfigs.map((c) => [c.priority, c.color]));
  const statusColorMap = Object.fromEntries(statusConfigs.map((c) => [c.status, c.color]));
  const statusColor = requiredColor(statusColorMap, task.status, "status");
  const priorityColor = requiredColor(priorityColorMap, task.priority, "priority");

  function toggleComplete() {
    onOpenMenu(null);

    if (isDone) {
      void onSetStatus(task.id, previousStatus || "active");
      return;
    }

    setPreviousStatus(task.status);
    void onComplete(task.id);
  }

  function chooseStatus(status: TaskStatus) {
    onOpenMenu(null);
    if (status === "done") {
      if (task.status !== "done") {
        setPreviousStatus(task.status);
      }
      void onComplete(task.id);
      return;
    }

    setPreviousStatus(status);
    void onSetStatus(task.id, status);
  }

  function choosePriority(priority: string) {
    onOpenMenu(null);
    void onSetPriority(task.id, priority);
  }

  function chooseCategory(categoryId: string) {
    onOpenMenu(null);
    void onSetCategory(task.id, categoryId);
  }

  function deleteTask() {
    onOpenMenu(null);
    if (confirm("Delete this task permanently?")) {
      void onDelete(task.id);
    }
  }

  function editTask() {
    onOpenMenu(null);
    onEdit(task.id);
  }

  return (
    <article
      data-task-menu-root={task.id}
      className={clsx(
        "relative grid min-h-10 grid-cols-[16px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg bg-[var(--color-surface-primary)] px-3 py-2 text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)] lg:grid-cols-[16px_minmax(0,1fr)_4.5rem_minmax(14rem,18rem)_4.75rem]",
        openMenu ? "z-40" : "z-0",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? "Mark task active" : "Mark task done"}
        onClick={toggleComplete}
        className={clsx(
          "flex h-4 w-4 items-center justify-center rounded-[4px] border transition",
          isDone
            ? "border-[var(--color-text-success)] bg-[var(--color-text-success)] text-white"
            : "border-[var(--color-line)] bg-transparent text-transparent hover:border-[var(--color-text-success)]",
        )}
      >
        <Check className="h-3 w-3 stroke-[3]" />
      </button>

      <button
        type="button"
        onClick={editTask}
        aria-label={`Edit ${task.title}`}
        className={clsx(
          "min-w-0 truncate text-left text-[13px] font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-text-secondary)]",
          isDone && "text-[var(--color-text-tertiary)] line-through",
        )}
      >
        {task.title}
      </button>

      <span className="col-start-2 whitespace-nowrap text-[11px] font-medium text-[var(--color-text-tertiary)] lg:col-auto lg:justify-self-end">
        {task.due_at ? format(new Date(task.due_at), "d MMM") : ""}
      </span>

      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 lg:col-auto">
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => onOpenMenu(openMenu === "status" ? null : "status")}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} />
            <span className="truncate">{displayStatus(task.status)}</span>
          </button>

          {openMenu === "status" && (
            <Popover title="Edit status">
              {TASK_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => chooseStatus(status)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-surface-secondary)]",
                    status === task.status ? "font-semibold" : "text-[var(--color-text-primary)]",
                  )}
                  style={{ color: requiredColor(statusColorMap, status, "status") }}
                >
                  {displayStatus(status)}
                </button>
              ))}
            </Popover>
          )}
        </div>

        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => onOpenMenu(openMenu === "category" ? null : "category")}
            className="inline-flex max-w-32 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: task.category?.color ?? "#5F5E5A" }}
            />
            <span className="min-w-0 truncate">{task.category?.name ?? "Uncategorized"}</span>
          </button>

          {openMenu === "category" && (
            <Popover title="Edit category">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => chooseCategory(category.id)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-surface-secondary)]",
                    category.id === task.category_id ? "font-semibold" : "text-[var(--color-text-primary)]",
                  )}
                  style={{ color: category.color }}
                >
                  <span className="min-w-0 truncate">{category.name}</span>
                </button>
              ))}
            </Popover>
          )}
        </div>

        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => onOpenMenu(openMenu === "priority" ? null : "priority")}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: priorityColor }} />
            <span className="truncate">{PRIORITY_DISPLAY[task.priority] ?? task.priority}</span>
          </button>

          {openMenu === "priority" && (
            <Popover title="Edit priority">
              {TASK_PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => choosePriority(priority)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-surface-secondary)]",
                    priority === task.priority ? "font-semibold" : "text-[var(--color-text-primary)]",
                  )}
                  style={{ color: requiredColor(priorityColorMap, priority, "priority") }}
                >
                  {PRIORITY_DISPLAY[priority]}
                </button>
              ))}
            </Popover>
          )}
        </div>
      </div>

      <div className="col-start-2 flex items-center gap-1.5 lg:col-auto lg:justify-self-end">
        <button
          type="button"
          onClick={editTask}
          className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-primary)] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
          aria-label={`Edit ${task.title}`}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={deleteTask}
          className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-primary)] text-[var(--color-text-tertiary)] shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
          aria-label={`Delete ${task.title}`}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-lg border border-[var(--color-line)] p-2 shadow-xl"
      style={{
        backgroundColor: "var(--color-menu)",
        backgroundImage: "linear-gradient(var(--color-menu), var(--color-menu))",
        opacity: 1,
      }}
    >
      <p className="mb-1 border-b border-[var(--color-line)] px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        {title}
      </p>
      {children}
    </div>
  );
}

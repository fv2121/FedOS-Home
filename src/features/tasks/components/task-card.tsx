"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Check, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/constants";
import type { VisibleTaskRow, Category, TaskStatus, PriorityConfig, StatusConfig } from "../model/dashboard-types";
import { useSwipeAction } from "../hooks/use-swipe-action";
import { useLongPress } from "../hooks/use-long-press";

export type TaskCardMenu = "status" | "priority" | "category" | "delete";

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
  onLongPress?: (id: string) => void;
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

function safeColor(color: string | undefined | null, fallback: string): string {
  if (!color) return fallback;
  return /^#[0-9a-f]{3,6}$|^rgb\(|^hsl\(/i.test(color) ? color : fallback;
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
  onLongPress,
}: Props) {
  const [previousStatus, setPreviousStatus] = useState<TaskStatus>(
    task.status === "done" ? "active" : task.status,
  );
  const isDone = task.status === "done";
  const priorityColorMap = Object.fromEntries(priorityConfigs.map((c) => [c.priority, c.color]));
  const statusColorMap = Object.fromEntries(statusConfigs.map((c) => [c.status, c.color]));
  const statusColor = requiredColor(statusColorMap, task.status, "status");
  const priorityColor = requiredColor(priorityColorMap, task.priority, "priority");

  const didSwipeRef = useRef(false);

  const swipe = useSwipeAction(() => void onDelete(task.id));
  const longPress = useLongPress(() => onLongPress?.(task.id));

  function combinedPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    swipe.handlers.onPointerDown(event);
    longPress.onPointerDown(event);
  }

  function combinedPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    swipe.handlers.onPointerMove(event);
    longPress.onPointerMove(event);
  }

  function combinedPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (swipe.isActivelyDragging()) {
      didSwipeRef.current = true;
      setTimeout(() => {
        didSwipeRef.current = false;
      }, 350);
    }
    swipe.handlers.onPointerUp(event);
    longPress.onPointerUp();
  }

  function combinedPointerCancel() {
    swipe.handlers.onPointerCancel();
    longPress.onPointerCancel();
  }

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
    void onDelete(task.id);
  }

  function editTask() {
    onOpenMenu(null);
    onEdit(task.id);
  }

  const deleteZoneWidth = Math.abs(swipe.translateX);
  const showDeleteZoneContent = deleteZoneWidth > 48;
  const isCommitting = swipe.phase === "committing" || swipe.phase === "settling";

  return (
    <div
      className="relative touch-pan-y overflow-hidden md:overflow-visible"
      onPointerDown={combinedPointerDown}
      onPointerMove={combinedPointerMove}
      onPointerUp={combinedPointerUp}
      onPointerCancel={combinedPointerCancel}
      onClickCapture={(event) => {
        if (didSwipeRef.current) {
          event.stopPropagation();
          didSwipeRef.current = false;
        }
      }}
    >
      {/* Delete reveal zone — mobile only, sits behind the sliding card */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 flex items-center justify-end bg-[var(--color-text-danger)] md:hidden"
        style={{
          width: deleteZoneWidth,
          opacity: swipe.phase === "dragging" ? 0.7 : 1,
        }}
      >
        {showDeleteZoneContent && (
          <div className="flex items-center gap-1.5 pr-4">
            <Trash2 className="h-5 w-5 text-white" />
            {isCommitting && (
              <span className="text-sm font-bold text-white">Delete</span>
            )}
          </div>
        )}
      </div>

      {/* Transform wrapper — isolates translate from the article's own styles */}
      <div
        style={{
          transform: `translateX(${swipe.translateX}px)`,
          transition: swipe.isTransitioning ? "transform 220ms ease-out" : "none",
          willChange: "transform",
        }}
      >
        <article
          data-task-menu-root={task.id}
          className={clsx(
            "relative grid min-h-11 grid-cols-[16px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 bg-transparent px-1 py-2.5 text-[var(--color-text-primary)] transition-colors md:min-h-10 md:gap-x-3 md:rounded-lg md:bg-[var(--color-surface-primary)] md:px-3 md:py-2 md:hover:bg-[var(--color-surface-secondary)] lg:grid-cols-[16px_minmax(0,1fr)_4.5rem_minmax(14rem,18rem)_4.75rem]",
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
              "flex h-5 w-5 items-center justify-center rounded-[5px] border-2 transition md:h-4 md:w-4 md:rounded-[4px] md:border",
              isDone
                ? "border-[var(--color-text-success)] bg-[var(--color-text-success)] text-[var(--color-accent-foreground)]"
                : "border-[var(--color-line)] bg-transparent text-transparent hover:border-[var(--color-text-success)]",
            )}
          >
            <Check className="h-3.5 w-3.5 stroke-[3] md:h-3 md:w-3" />
          </button>

          <div className="flex min-w-0 items-center gap-2 lg:contents">
            <span
              className={clsx(
                "min-w-0 flex-1 truncate text-base font-medium text-[var(--color-text-primary)] md:hidden",
                isDone && "text-[var(--color-text-tertiary)] line-through",
              )}
            >
              {task.title}
            </span>
            <button
              type="button"
              onClick={editTask}
              aria-label={`Edit ${task.title}`}
              className={clsx(
                "hidden min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[var(--color-text-primary)] transition hover:text-[var(--color-text-secondary)] md:block",
                isDone && "text-[var(--color-text-tertiary)] line-through",
              )}
            >
              {task.title}
            </button>
            <button
              type="button"
              onClick={editTask}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] md:hidden"
              aria-label={`Edit ${task.title}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Hidden on mobile. On desktop: lg:contents unwraps children into the grid. */}
          <div className="hidden lg:contents">

            <span className="whitespace-nowrap text-[11px] font-medium text-[var(--color-text-tertiary)] lg:justify-self-end">
              {task.due_at ? format(new Date(task.due_at), "d MMM") : ""}
            </span>

            <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 lg:gap-x-3">
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
                    style={{ backgroundColor: safeColor(task.category?.color, "#5F5E5A") }}
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
                        style={{ color: safeColor(category.color, "inherit") }}
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

            <div className="flex items-center gap-1 lg:justify-self-end">
              <button
                type="button"
                onClick={editTask}
                className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-primary)] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
                aria-label={`Edit ${task.title}`}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => onOpenMenu(openMenu === "delete" ? null : "delete")}
                  className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-primary)] text-[var(--color-text-tertiary)] shadow-sm transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-danger)]"
                  aria-label={`Delete ${task.title}`}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>

                {openMenu === "delete" && (
                  <Popover title="Delete task">
                    <p className="mb-2 px-1 text-[12px] text-[var(--color-text-secondary)]">
                      Delete permanently?
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenMenu(null)}
                        className="flex-1 rounded-md border border-[var(--color-line)] px-2 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={deleteTask}
                        className="flex-1 rounded-md bg-[var(--color-text-danger)] px-2 py-1.5 text-[12px] font-semibold text-[var(--color-accent-foreground)] transition hover:opacity-90"
                      >
                        Delete
                      </button>
                    </div>
                  </Popover>
                )}
              </div>
            </div>

          </div>
        </article>
      </div>
    </div>
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

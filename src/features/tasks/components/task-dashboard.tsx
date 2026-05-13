"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { endOfDay, startOfDay, addDays, format, getISOWeek, isAfter, isBefore, isEqual } from "date-fns";
import { useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import clsx from "clsx";
import { DEFAULT_OWNER, isViewOption, TASK_PRIORITIES } from "@/lib/constants";
import {
  isVisibleTaskRow,
  type TaskRow,
  type VisibleTaskRow,
  type Category,
  type Project,
  type PriorityConfig,
  type StatusConfig,
} from "../model/dashboard-types";
import { useTaskActions } from "../hooks/use-task-actions";
import { TaskCard, type TaskCardMenu } from "./task-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { TaskEditOverlay } from "./task-edit-overlay";
import { TaskActionSheet } from "./task-action-sheet";
import { UndoToast } from "@/components/undo-toast";
import { CreateTaskPanel } from "./create-task-panel";
import { PrimaryNav } from "@/components/primary-nav";
import { NewTaskView } from "./new-task-view";

type Props = {
  initialTasks: TaskRow[];
  categories: Category[];
  projects: Project[];
  priorityConfigs: PriorityConfig[];
  statusConfigs: StatusConfig[];
};

type ListGroup = "date" | "priority" | "category" | "project";
type OpenTaskMenu = { taskId: string; menu: TaskCardMenu } | null;
type PendingUndo = { taskId: string; taskTitle: string; tasksSnapshot: TaskRow[] };

const LIST_GROUP_OPTIONS = [
  { id: "date", label: "By date", mobileLabel: "date" },
  { id: "priority", label: "By priority", mobileLabel: "priority" },
  { id: "category", label: "By category", mobileLabel: "category" },
  { id: "project", label: "By project", mobileLabel: "project" },
] as const;

export function TaskDashboard({ initialTasks, categories, projects, priorityConfigs, statusConfigs }: Props) {
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState(initialTasks);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openTaskMenu, setOpenTaskMenu] = useState<OpenTaskMenu>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [actionSheetTaskId, setActionSheetTaskId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Keep optimistic local task state aligned after server refreshes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    if (!openTaskMenu) return;
    const activeMenu = openTaskMenu;

    function closeOnPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element) {
        const taskRoot = target.closest<HTMLElement>("[data-task-menu-root]");
        if (taskRoot?.dataset.taskMenuRoot === activeMenu.taskId) return;
      }

      setOpenTaskMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenTaskMenu(null);
      }
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openTaskMenu]);

  const requestedView = searchParams.get("view");
  const view = isViewOption(requestedView) ? requestedView : "tasks";
  const requestedGroup = searchParams.get("groupBy");
  const listGroup: ListGroup =
    requestedGroup === "priority" || requestedGroup === "category" || requestedGroup === "project" ? requestedGroup : "date";
  const {
    updateURL,
    createTask,
    complete,
    setStatus,
    setPriority,
    setCategory,
    updateTask,
    deleteTask,
    error,
    clearError,
    isPending,
  } = useTaskActions(setTasks);

  function handleOptimisticDelete(id: string) {
    // If another delete is already pending, commit it immediately before starting a new one.
    if (pendingUndo && pendingUndo.taskId !== id) {
      if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
      void deleteTask(pendingUndo.taskId);
      setPendingUndo(null);
    }

    if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);

    const taskToDelete = tasks.find((t) => t.id === id);
    const snapshot = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setPendingUndo({
      taskId: id,
      taskTitle: taskToDelete?.title ?? "Task",
      tasksSnapshot: snapshot,
    });

    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      void deleteTask(id);
      setPendingUndo(null);
    }, 5000);
  }

  function handleUndo() {
    if (!pendingUndo) return;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setTasks(pendingUndo.tasksSnapshot);
    setPendingUndo(null);
  }

  const filteredTasks = useMemo(() => tasks.filter(isVisibleTaskRow), [tasks]);

  const stats = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    let overdue = 0, today = 0, upcoming = 0;
    for (const task of filteredTasks) {
      const d = task.due_at ? new Date(task.due_at) : null;
      if (d && isBefore(d, todayStart) && task.status !== "done") {
        overdue++;
      } else if (d && !isAfter(d, todayEnd)) {
        today++;
      } else {
        upcoming++;
      }
    }
    return { overdue, today, upcoming };
  }, [filteredTasks]);

  const editingTask = useMemo(() => {
    const task = tasks.find((item) => item.id === editingTaskId);
    return task && isVisibleTaskRow(task) ? task : null;
  }, [editingTaskId, tasks]);

  const actionSheetTask = useMemo(() => {
    const task = tasks.find((item) => item.id === actionSheetTaskId);
    return task && isVisibleTaskRow(task) ? task : null;
  }, [actionSheetTaskId, tasks]);

  const groups = useMemo(() => {
    if (listGroup === "date") {
      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(new Date());
      const tomorrowEnd = endOfDay(addDays(new Date(), 1));
      const soonEnd = endOfDay(addDays(new Date(), 7));

      const buckets = new Map<string, VisibleTaskRow[]>([
        ["Overdue", []],
        ["Today", []],
        ["Tomorrow", []],
        ["This week", []],
        ["Sometime", []],
      ]);

      for (const task of filteredTasks) {
        const d = task.due_at ? new Date(task.due_at) : null;

        let bucket = "Sometime";
        if (d) {
          if (isBefore(d, todayStart) && task.status !== "done") {
            bucket = "Overdue";
          } else if ((isAfter(d, tomorrowEnd) || isEqual(d, tomorrowEnd)) && !isAfter(d, soonEnd)) {
            bucket = "This week";
          } else if ((isAfter(d, todayEnd) || isEqual(d, todayEnd)) && !isAfter(d, tomorrowEnd)) {
            bucket = "Tomorrow";
          } else if (!isAfter(d, todayEnd)) {
            bucket = "Today";
          }
        }

        buckets.get(bucket)!.push(task);
      }

      return [...buckets.entries()].filter(([, items]) => items.length > 0);
    }

    if (listGroup === "priority") {
      const priorityOrder = [...TASK_PRIORITIES].reverse();
      const buckets = new Map<string, VisibleTaskRow[]>(
        priorityOrder.map((p) => [p.charAt(0).toUpperCase() + p.slice(1), []]),
      );
      for (const task of filteredTasks) {
        const label = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
        buckets.get(label)!.push(task);
      }
      return [...buckets.entries()].filter(([, items]) => items.length > 0);
    }

    const map = new Map<string, VisibleTaskRow[]>();
    for (const task of filteredTasks) {
      const key =
        listGroup === "project" ? task.project?.name ?? "No project" : task.category?.name ?? "Uncategorized";
      const current = map.get(key) ?? [];
      current.push(task);
      map.set(key, current);
    }
    return [...map.entries()];
  }, [listGroup, filteredTasks]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
    setOpenTaskMenu(null);
  }

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const now = new Date();
  const dateLabel = `${format(now, "EEE d MMM")} · week ${getISOWeek(now)}`;

  return (
    <div className="min-h-screen bg-[var(--color-app-bg)] pb-28 md:pb-10">
      <PrimaryNav activeView={view} updateURL={updateURL} />
      <div className="mx-auto w-full max-w-6xl px-3 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] md:p-6">
        <main className="space-y-4">
          <section className="md:hidden">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[1.6rem] font-bold leading-tight text-[var(--color-text-primary)]">
                  {greeting}, {DEFAULT_OWNER}
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{dateLabel}</p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avatar.png"
                alt="Profile"
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[var(--color-surface-primary)] p-4">
                <p className="text-4xl font-bold text-red-400">{stats.overdue}</p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Overdue</p>
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-primary)] p-4">
                <p className="text-4xl font-bold text-amber-400">{stats.today}</p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Today</p>
              </div>
              <div className="rounded-2xl bg-[var(--color-surface-primary)] p-4">
                <p className="text-4xl font-bold text-[var(--color-text-primary)]">{stats.upcoming}</p>
                <p className="mt-1 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Upcoming</p>
              </div>
            </div>
          </section>

          <section className="hidden rounded-3xl bg-[var(--color-panel)] p-5 shadow-sm backdrop-blur md:block md:p-10">
            <CreateTaskPanel categories={categories} projects={projects} onCreateTask={createTask} />
          </section>

          <section className="bg-[var(--color-panel)] p-3 shadow-sm backdrop-blur max-md:bg-transparent max-md:shadow-none md:rounded-3xl md:border md:border-[var(--color-line)] md:p-5">
            <div className="mb-5 md:mb-3">
              <div className="grid grid-cols-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-1 max-md:w-full">
                {LIST_GROUP_OPTIONS.map((option) => {
                  const active = listGroup === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setOpenTaskMenu(null);
                        updateURL({ groupBy: option.id === "date" ? null : option.id });
                      }}
                      className={clsx(
                        "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs max-md:min-h-12 max-md:gap-2 max-md:text-base",
                        active
                          ? "bg-[var(--color-accent)] text-[var(--color-surface-primary)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]",
                      )}
                    >
                      <span className="md:hidden">{option.mobileLabel}</span>
                      <span className="hidden md:inline">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              {groups.map(([categoryName, categoryTasks]) => {
                const groupKey = `${listGroup}:${categoryName}`;
                const collapsed = collapsedGroups[groupKey] ?? false;

                return (
                  <section key={categoryName} className="space-y-1">
                    <SectionHeader
                      name={categoryName}
                      count={categoryTasks.length}
                      collapsed={collapsed}
                      dateStamp={listGroup === "date" ? sectionDateStamp(categoryName) : null}
                      onToggle={() => toggleGroup(groupKey)}
                    />
                    {!collapsed && (
                      <div className="space-y-0 md:space-y-1">
                        {[...categoryTasks].sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0)).map((task) => (
                          <ErrorBoundary key={task.id}>
                            <TaskCard
                              task={task}
                              categories={categories}
                              openMenu={
                                openTaskMenu?.taskId === task.id ? openTaskMenu.menu : null
                              }
                              onOpenMenu={(menu) =>
                                setOpenTaskMenu(menu ? { taskId: task.id, menu } : null)
                              }
                              priorityConfigs={priorityConfigs}
                              statusConfigs={statusConfigs}
                              onComplete={complete}
                              onSetStatus={setStatus}
                              onSetPriority={setPriority}
                              onSetCategory={setCategory}
                              onEdit={(id) => {
                                setOpenTaskMenu(null);
                                setEditingTaskId(id);
                              }}
                              onDelete={handleOptimisticDelete}
                              onLongPress={(id) => {
                                setOpenTaskMenu(null);
                                setActionSheetTaskId(id);
                              }}
                            />
                          </ErrorBoundary>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {view === "new" && (
        <NewTaskView
          categories={categories}
          projects={projects}
          onCreateTask={createTask}
          onBack={() => updateURL({ view: null })}
        />
      )}

      {editingTask && (
        <TaskEditOverlay
          key={editingTask.id}
          task={editingTask}
          categories={categories}
          projects={projects}
          priorityConfigs={priorityConfigs}
          statusConfigs={statusConfigs}
          onClose={() => setEditingTaskId(null)}
          onSave={updateTask}
        />
      )}

      {actionSheetTask && (
        <TaskActionSheet
          task={actionSheetTask}
          statusConfigs={statusConfigs}
          priorityConfigs={priorityConfigs}
          onEdit={() => {
            setActionSheetTaskId(null);
            setEditingTaskId(actionSheetTask.id);
          }}
          onDelete={() => {
            setActionSheetTaskId(null);
            handleOptimisticDelete(actionSheetTask.id);
          }}
          onSetStatus={(status) => {
            void setStatus(actionSheetTask.id, status);
          }}
          onSetPriority={(priority) => {
            void setPriority(actionSheetTask.id, priority);
          }}
          onClose={() => setActionSheetTaskId(null)}
        />
      )}

      {pendingUndo && (
        <UndoToast
          key={pendingUndo.taskId}
          taskTitle={pendingUndo.taskTitle}
          durationMs={5000}
          onUndo={handleUndo}
        />
      )}

      {error && (
        <div
          role="alert"
          className="fixed inset-x-3 top-3 z-[70] flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] px-4 py-3 text-sm font-medium text-[var(--color-text-danger)] shadow-lg md:left-auto md:w-96"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="rounded-full p-1 text-[var(--color-text-danger)] transition hover:bg-[var(--color-surface-secondary)]"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isPending && (
        <div className="fixed bottom-36 right-3 z-[70] rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-foreground)] md:bottom-auto md:top-20">
          Updating...
        </div>
      )}
    </div>
  );
}

function sectionDateStamp(name: string): string | null {
  if (name === "Today") return format(new Date(), "EEE d MMM");
  if (name === "Tomorrow") return format(addDays(new Date(), 1), "EEE d MMM");
  return null;
}

function SectionHeader({
  name,
  count,
  collapsed,
  dateStamp,
  onToggle,
}: {
  name: string;
  count: number;
  collapsed: boolean;
  dateStamp: string | null;
  onToggle: () => void;
}) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${name}${dateStamp ? `, ${dateStamp}` : ""}`}
        onClick={onToggle}
        className="flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ChevronDown
          className={clsx("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")}
        />
      </button>
      <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)] max-md:text-sm">
        {name}
      </h3>
      <span className="text-[11px] text-[var(--color-text-tertiary)] max-md:text-xs">({count})</span>
      <span className="h-px flex-1 bg-[var(--color-line)]" />
    </div>
  );
}

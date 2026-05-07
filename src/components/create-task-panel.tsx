"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import clsx from "clsx";
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_PRIORITIES } from "@/lib/constants";
import {
  CREATE_TASK_DUE_PRESETS,
  createDefaultTaskDraft,
  presetDueDate,
  type CreateTaskDuePreset,
  type CreateTaskInput,
} from "./create-task-model";
import type { Category, Project } from "./dashboard-types";

type Props = {
  categories: Category[];
  projects: Project[];
  onCreateTask: (task: CreateTaskInput) => Promise<boolean>;
};

export function CreateTaskPanel({ categories, projects, onCreateTask }: Props) {
  const [selectedDuePreset, setSelectedDuePreset] = useState<CreateTaskDuePreset | null>("today");
  const [newTask, setNewTask] = useState(createDefaultTaskDraft);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newTask.title.trim() || submitting) return;
    setSubmitting(true);
    const created = await onCreateTask(newTask);
    if (created) {
      setSelectedDuePreset("today");
      setNewTask((prev) => ({
        ...prev,
        title: "",
        description: "",
        category_id: "",
        project_id: "",
        due_at: presetDueDate("today"),
      }));
    }
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 md:grid-cols-[minmax(18rem,1.8fr)_minmax(12rem,1fr)_minmax(12rem,1fr)_auto] md:items-start md:gap-10"
    >
      <div className="min-w-0">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          New task
        </p>
        <input
          aria-label="Task title"
          className="block w-full bg-transparent text-lg font-medium leading-[1.2] text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
          placeholder="Title..."
          value={newTask.title}
          onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
        />
        <input
          aria-label="Task description"
          maxLength={TASK_DESCRIPTION_MAX_LENGTH}
          className="mt-3 block w-full border-b-[0.5px] border-[var(--color-line)] bg-transparent pb-0.5 text-[11px] text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-primary)]"
          placeholder="Description"
          value={newTask.description}
          onChange={(e) => setNewTask((prev) => ({ ...prev, description: e.target.value }))}
        />
      </div>

      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          When
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {CREATE_TASK_DUE_PRESETS.map((preset) => {
            const selected = selectedDuePreset === preset.dueDate;

            return (
              <button
                key={preset.dueDate}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedDuePreset(preset.dueDate);
                  setNewTask((prev) => ({ ...prev, due_at: presetDueDate(preset.dueDate) }));
                }}
                className={clsx(
                  "border-b-2 pb-0.5 text-sm font-bold transition",
                  selected
                    ? "border-[var(--color-text-primary)] text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]",
                )}
              >
                {preset.desktopLabel}
              </button>
            );
          })}
        </div>
        <input
          aria-label="Due date"
          type="date"
          value={newTask.due_at}
          onChange={(e) => {
            setSelectedDuePreset(null);
            setNewTask((prev) => ({ ...prev, due_at: e.target.value }));
          }}
          className="date-input-compact mt-3 block w-[7.75rem] max-w-full bg-transparent text-sm text-[var(--color-text-tertiary)] outline-none"
        />
      </div>

      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
          Meta
        </p>
        <div className="grid gap-1">
          <SelectShell>
            <select
              aria-label="Task category"
              value={newTask.category_id}
              onChange={(e) => setNewTask((prev) => ({ ...prev, category_id: e.target.value }))}
              className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-[var(--color-text-secondary)] outline-none"
            >
              <option value="">Category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </SelectShell>

          <SelectShell>
            <select
              aria-label="Task project"
              value={newTask.project_id}
              onChange={(e) => setNewTask((prev) => ({ ...prev, project_id: e.target.value }))}
              className="w-full appearance-none bg-transparent pr-6 text-sm font-medium text-[var(--color-text-secondary)] outline-none"
            >
              <option value="">Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </SelectShell>

          <SelectShell>
            <select
              aria-label="Task priority"
              value={newTask.priority}
              onChange={(e) => setNewTask((prev) => ({ ...prev, priority: e.target.value }))}
              className="w-full appearance-none bg-transparent pr-6 text-sm font-medium capitalize text-[var(--color-text-secondary)] outline-none"
            >
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </SelectShell>
        </div>
      </div>

      <button
        type="submit"
        disabled={!newTask.title.trim() || submitting}
        className="flex h-16 w-16 items-center justify-center justify-self-end rounded-full bg-[var(--color-text-primary)] text-[var(--color-surface-primary)] transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 md:h-24 md:w-24"
        aria-label="Add task"
      >
        <Plus className="h-8 w-8 stroke-[3]" />
      </button>
    </form>
  );
}

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-w-0 items-center">
      {children}
      <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-[var(--color-text-secondary)]" />
    </div>
  );
}

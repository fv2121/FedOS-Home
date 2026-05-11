"use client";

import { useEffect, useRef, useState, type ComponentType, type FormEvent } from "react";
import clsx from "clsx";
import { ChevronDown, CircleDot, FolderKanban, Plus, Tags } from "lucide-react";
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import {
  CREATE_TASK_DEFAULT_PRIORITY,
  CREATE_TASK_DUE_PRESETS,
  presetDueDate,
  type CreateTaskDuePreset,
  type CreateTaskInput,
} from "../model/create-task-model";
import type { Category, Project } from "../model/dashboard-types";

type Props = {
  categories: Category[];
  projects: Project[];
  onCreateTask: (task: CreateTaskInput) => Promise<boolean>;
  onBack: () => void;
};

export function NewTaskView({ categories, projects, onCreateTask, onBack }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedDuePreset, setSelectedDuePreset] = useState<CreateTaskDuePreset | null>("today");
  const [dueAt, setDueAt] = useState(() => presetDueDate("today"));
  const [priority, setPriority] = useState(CREATE_TASK_DEFAULT_PRIORITY);
  const [status, setStatus] = useState("active");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = title.trim().length > 0 && !submitting;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const created = await onCreateTask({
      title,
      description,
      status,
      category_id: categoryId || undefined,
      project_id: projectId || undefined,
      priority,
      due_at: dueAt,
      tags,
    });
    if (created) onBack();
    else setSubmitting(false);
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-10 flex flex-col bg-[var(--color-app-bg)] md:hidden"
      style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
    >
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-6 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
          <section>
            <div>
              <input
                ref={titleRef}
                aria-label="Task title"
                type="text"
                placeholder="Add a new task..."
                enterKeyHint="next"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    descriptionRef.current?.focus();
                  }
                }}
                className="block min-h-12 w-full bg-transparent py-3 text-lg font-medium text-[var(--color-text-primary)] outline-none transition placeholder:text-2xl placeholder:font-bold placeholder:italic placeholder:text-[var(--color-text-tertiary)]"
              />
              <textarea
                ref={descriptionRef}
                aria-label="Task description"
                maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                placeholder="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={8}
                className="block min-h-40 w-full resize-none bg-transparent py-3 text-base text-[var(--color-text-secondary)] outline-none transition placeholder:text-[var(--color-text-tertiary)]"
              />
            </div>
          </section>

          <section className="space-y-2">
            <SectionHeader name="When" />
            <div className="grid grid-cols-4 border-b border-[var(--color-line)]">
              {CREATE_TASK_DUE_PRESETS.map((preset) => {
                const selected = selectedDuePreset === preset.dueDate;

                return (
                  <button
                    key={preset.dueDate}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedDuePreset(preset.dueDate);
                      setDueAt(presetDueDate(preset.dueDate));
                    }}
                    className={clsx(
                      "flex min-h-11 items-center justify-center border-b-2 px-2 text-base font-semibold transition",
                      selected
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    {preset.mobileLabel}
                  </button>
                );
              })}
            </div>
            <FlatInputRow>
              <input
                aria-label="Due date"
                type="date"
                value={dueAt}
                onChange={(event) => {
                  setSelectedDuePreset(null);
                  setDueAt(event.target.value);
                }}
                className="date-input-compact w-full bg-transparent text-base font-medium text-[var(--color-text-secondary)] outline-none"
              />
            </FlatInputRow>
          </section>

          <section className="space-y-2">
            <SectionHeader name="Priority" />
            <div className="grid grid-cols-4 border-b border-[var(--color-line)]">
              {TASK_PRIORITIES.map((taskPriority) => {
                const selected = priority === taskPriority;

                return (
                  <button
                    key={taskPriority}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPriority(taskPriority)}
                    className={clsx(
                      "flex min-h-11 items-center justify-center border-b-2 px-2 text-base font-semibold capitalize transition",
                      selected
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    {taskPriority}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <SectionHeader name="Meta" />
            <div>
              <SelectShell icon={CircleDot}>
                <select
                  aria-label="Task status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full appearance-none bg-transparent pr-7 text-base font-medium text-[var(--color-text-secondary)] outline-none capitalize"
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </SelectShell>

              {categories.length > 0 && (
                <SelectShell icon={Tags}>
                  <select
                    aria-label="Task category"
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full appearance-none bg-transparent pr-7 text-base font-medium text-[var(--color-text-secondary)] outline-none"
                  >
                    <option value="">Category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              )}

              {projects.length > 0 && (
                <SelectShell icon={FolderKanban}>
                  <select
                    aria-label="Task project"
                    value={projectId}
                    onChange={(event) => setProjectId(event.target.value)}
                    className="w-full appearance-none bg-transparent pr-7 text-base font-medium text-[var(--color-text-secondary)] outline-none"
                  >
                    <option value="">Project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              )}

              <FlatInputRow>
                <input
                  aria-label="Task tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="Tags (comma-separated)"
                  className="w-full bg-transparent text-base font-medium text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
              </FlatInputRow>
            </div>
          </section>
        </div>

        <div className="pt-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className={clsx(
              "flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 py-3 text-base font-bold transition",
              canSubmit
                ? "border-transparent bg-[var(--color-accent)] text-[var(--color-surface-primary)]"
                : "cursor-not-allowed border-[var(--color-line)] bg-transparent text-[var(--color-text-tertiary)]",
            )}
          >
            <Plus className="h-5 w-5 stroke-[3]" />
            {submitting ? "Adding..." : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SectionHeader({ name }: { name: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <h2 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
        {name}
      </h2>
      <span className="h-px flex-1 bg-[var(--color-line)]" />
    </div>
  );
}

function FlatInputRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

function SelectShell({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-12 min-w-0 items-center gap-3 border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
      {children}
      <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-[var(--color-text-secondary)]" />
    </div>
  );
}

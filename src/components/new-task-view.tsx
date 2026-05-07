"use client";

import { useEffect, useRef, useState } from "react";
import { addDays, format } from "date-fns";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { TASK_PRIORITIES } from "@/lib/constants";
import type { Category, Project } from "./dashboard-types";

type Props = {
  categories: Category[];
  projects: Project[];
  onCreateTask: (task: {
    title: string;
    description: string;
    category_id?: string;
    project_id?: string;
    priority: string;
    due_at: string;
  }) => Promise<boolean>;
  onBack: () => void;
};

const DUE_PRESETS = [
  { label: "Today", value: format(new Date(), "yyyy-MM-dd") },
  { label: "Tomorrow", value: format(addDays(new Date(), 1), "yyyy-MM-dd") },
  { label: "This week", value: format(addDays(new Date(), (5 - new Date().getDay() + 7) % 7 || 7), "yyyy-MM-dd") },
  { label: "No date", value: "" },
] as const;

export function NewTaskView({ categories, projects, onCreateTask, onBack }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(DUE_PRESETS[0].value);
  const [priority, setPriority] = useState("medium");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    const created = await onCreateTask({
      title,
      description,
      category_id: categoryId || undefined,
      priority,
      due_at: dueAt,
    });
    if (created) onBack();
    else setSubmitting(false);
  }

  return (
    <div className="fixed inset-x-0 top-0 z-10 flex flex-col bg-[var(--color-app-bg)] md:hidden" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
          New task
        </span>
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pt-4 pb-8">
        {/* Title */}
        <input
          ref={titleRef}
          type="text"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-2xl font-semibold leading-snug text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />

        {/* Description */}
        <textarea
          placeholder="Notes..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full resize-none bg-transparent text-base text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
        />

        <hr className="border-[var(--color-line)]" />

        {/* Due date */}
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">When</p>
          <div className="flex flex-wrap gap-2">
            {DUE_PRESETS.map((preset) => {
              const active = dueAt === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setDueAt(preset.value)}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-[var(--color-text-primary)] text-[var(--color-surface-primary)]"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority */}
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Priority</p>
          <div className="flex flex-wrap gap-2">
            {TASK_PRIORITIES.map((p) => {
              const active = priority === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={clsx(
                    "rounded-full px-4 py-2 text-sm font-semibold capitalize transition",
                    active
                      ? "bg-[var(--color-text-primary)] text-[var(--color-surface-primary)]"
                      : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">Category</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={clsx(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      active
                        ? "bg-[var(--color-text-primary)] text-[var(--color-surface-primary)]"
                        : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]",
                    )}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="px-5 pb-6 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim() || submitting}
          className="w-full rounded-2xl bg-[var(--color-text-primary)] py-4 text-base font-bold text-[var(--color-surface-primary)] transition disabled:opacity-40"
        >
          {submitting ? "Adding…" : "Add task"}
        </button>
      </div>
    </div>
  );
}

"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { format } from "date-fns";
import clsx from "clsx";
import {
  Bold,
  CalendarDays,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Hash,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  Link2,
  List,
  ListOrdered,
  PencilLine,
  Save,
  Tags,
  X,
} from "lucide-react";
import {
  SOURCE_TYPES,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";
import type {
  Category,
  PriorityConfig,
  Project,
  SourceType,
  StatusConfig,
  TaskPriority,
  TaskStatus,
  TaskUpdateFields,
  VisibleTaskRow,
} from "./dashboard-types";

type Props = {
  task: VisibleTaskRow;
  categories: Category[];
  projects: Project[];
  priorityConfigs: PriorityConfig[];
  statusConfigs: StatusConfig[];
  onClose: () => void;
  onSave: (id: string, fields: TaskUpdateFields) => Promise<boolean>;
};

type Draft = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category_id: string;
  project_id: string;
  due_at: string;
  source_type: SourceType;
  source_ref: string;
  tags: string;
};

type DescriptionMode = "write" | "preview";

const PRIORITY_DISPLAY: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const SOURCE_DISPLAY: Record<SourceType, string> = {
  manual: "Manual",
  email: "Email",
  calendar: "Calendar",
  message: "Message",
  llm: "LLM",
  fedos: "FedOS",
};

const inputClass =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-text-primary)]";

function draftFromTask(task: VisibleTaskRow): Draft {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    category_id: task.category_id,
    project_id: task.project_id ?? "",
    due_at: toDateInput(task.due_at),
    source_type: task.source_type ?? "manual",
    source_ref: task.source_ref ?? "",
    tags: task.tags.map(({ tag }) => tag.name).join(", "),
  };
}

export function TaskEditOverlay({
  task,
  categories,
  projects,
  priorityConfigs,
  statusConfigs,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftFromTask(task));
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>(() =>
    task.description?.trim() ? "preview" : "write",
  );
  const [saving, setSaving] = useState(false);
  const mobileTitleRef = useRef<HTMLTextAreaElement>(null);
  const mobileDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const statusColorMap = Object.fromEntries(statusConfigs.map((c) => [c.status, c.color]));
  const priorityColorMap = Object.fromEntries(priorityConfigs.map((c) => [c.priority, c.color]));

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const textarea = mobileTitleRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft.title]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || saving) return;

    setSaving(true);
    const saved = await onSave(task.id, {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      status: draft.status,
      priority: draft.priority,
      category_id: draft.category_id,
      project_id: draft.project_id || null,
      due_at: draft.due_at || null,
      source_type: draft.source_type,
      source_ref: draft.source_ref.trim() || null,
      tags: splitTags(draft.tags),
    });

    setSaving(false);
    if (saved) onClose();
  }

  function insertDescription(before: string, after = "", placeholder = "") {
    const textarea = descriptionRef.current;
    if (!textarea) {
      setDraft((prev) => ({
        ...prev,
        description: `${prev.description}${before}${placeholder}${after}`,
      }));
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const inner = selected || placeholder;
    const next = `${value.slice(0, selectionStart)}${before}${inner}${after}${value.slice(selectionEnd)}`;
    const nextStart = selectionStart + before.length;
    const nextEnd = nextStart + inner.length;

    setDraft((prev) => ({ ...prev, description: next }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextStart, nextEnd);
    });
  }

  function formatDescriptionLines(prefixForLine: (index: number) => string) {
    const textarea = descriptionRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value } = textarea;
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", selectionEnd);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const selectedBlock = value.slice(lineStart, lineEnd);
    const lines = selectedBlock ? selectedBlock.split("\n") : [""];
    const nextBlock = lines
      .map((line, index) => `${prefixForLine(index)}${line.replace(/^(\s*)([-*]|\d+\.|#{1,6})\s+/, "$1")}`)
      .join("\n");
    const next = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;

    setDraft((prev) => ({ ...prev, description: next }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + nextBlock.length);
    });
  }

  return (
    <>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-task-edit-title"
        onSubmit={handleSubmit}
        className="fixed inset-0 z-50 flex flex-col bg-[var(--color-app-bg)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden"
      >
        <div className="mb-2 flex min-h-10 items-center justify-end">
          <h2 id="mobile-task-edit-title" className="sr-only">
            Edit task
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label="Close task editor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
          <section>
            <textarea
              ref={mobileTitleRef}
              aria-label="Task title"
              value={draft.title}
              maxLength={200}
              required
              enterKeyHint="next"
              rows={1}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  setDescriptionMode("write");
                  requestAnimationFrame(() => {
                    mobileDescriptionRef.current?.focus();
                  });
                }
              }}
              className="block min-h-12 w-full resize-none overflow-hidden bg-transparent py-3 text-2xl font-bold leading-tight text-[var(--color-text-primary)] outline-none placeholder:italic placeholder:text-[var(--color-text-tertiary)]"
              placeholder="Task title..."
            />
            <div>
              <div className="flex justify-end">
                <div className="grid grid-cols-2 border-b border-[var(--color-line)]">
                  <button
                    type="button"
                    aria-pressed={descriptionMode === "write"}
                    onClick={() => {
                      setDescriptionMode("write");
                      requestAnimationFrame(() => {
                        mobileDescriptionRef.current?.focus();
                      });
                    }}
                    className={clsx(
                      "min-h-9 border-b-2 px-4 text-sm font-semibold capitalize transition",
                      descriptionMode === "write"
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)]",
                    )}
                  >
                    write
                  </button>
                  <button
                    type="button"
                    aria-pressed={descriptionMode === "preview"}
                    onClick={() => setDescriptionMode("preview")}
                    className={clsx(
                      "min-h-9 border-b-2 px-4 text-sm font-semibold capitalize transition",
                      descriptionMode === "preview"
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)]",
                    )}
                  >
                    preview
                  </button>
                </div>
              </div>
              {descriptionMode === "write" ? (
                <textarea
                  ref={mobileDescriptionRef}
                  aria-label="Task description"
                  value={draft.description}
                  maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                  rows={8}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="block min-h-44 w-full resize-none bg-transparent py-3 text-base leading-relaxed text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                  placeholder="Description"
                />
              ) : (
                <div className="min-h-44 py-3">
                  <MarkdownPreview value={draft.description} />
                </div>
              )}
            </div>
          </section>

          <MobileSection title="When">
            <MobileFlatRow>
              <input
                aria-label="Due date"
                type="date"
                value={draft.due_at}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, due_at: event.target.value }))
                }
                className="date-input-compact w-full bg-transparent text-base font-medium text-[var(--color-text-secondary)] outline-none"
              />
            </MobileFlatRow>
          </MobileSection>

          <MobileSection title="Status">
            <MobileTabs>
              {TASK_STATUSES.map((status) => {
                const selected = draft.status === status;

                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((prev) => ({ ...prev, status }))}
                    className={clsx(
                      "flex min-h-11 items-center justify-center border-b-2 px-1 text-base font-semibold capitalize transition",
                      selected
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    {displayCode(status)}
                  </button>
                );
              })}
            </MobileTabs>
          </MobileSection>

          <MobileSection title="Priority">
            <MobileTabs>
              {TASK_PRIORITIES.map((priority) => {
                const selected = draft.priority === priority;

                return (
                  <button
                    key={priority}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((prev) => ({ ...prev, priority }))}
                    className={clsx(
                      "flex min-h-11 items-center justify-center border-b-2 px-1 text-base font-semibold capitalize transition",
                      selected
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
                    )}
                  >
                    {priority}
                  </button>
                );
              })}
            </MobileTabs>
          </MobileSection>

          <MobileSection title="Meta">
            <div>
              {categories.length > 0 && (
                <MobileSelectRow>
                  <select
                    aria-label="Task category"
                    value={draft.category_id}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, category_id: event.target.value }))
                    }
                    className="w-full appearance-none bg-transparent pr-7 text-base font-medium text-[var(--color-text-secondary)] outline-none"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </MobileSelectRow>
              )}

              {projects.length > 0 && (
                <MobileSelectRow>
                  <select
                    aria-label="Task project"
                    value={draft.project_id}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, project_id: event.target.value }))
                    }
                    className="w-full appearance-none bg-transparent pr-7 text-base font-medium text-[var(--color-text-secondary)] outline-none"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </MobileSelectRow>
              )}

              <MobileFlatRow>
                <input
                  aria-label="Task tags"
                  value={draft.tags}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, tags: event.target.value }))
                  }
                  placeholder="Tags"
                  className="w-full bg-transparent text-base font-medium text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
              </MobileFlatRow>
            </div>
          </MobileSection>
        </div>

        <button
          type="submit"
          disabled={!draft.title.trim() || saving}
          className={clsx(
            "flex min-h-12 w-full items-center justify-center rounded-lg border px-4 py-3 text-base font-bold transition",
            draft.title.trim() && !saving
              ? "border-transparent bg-[var(--color-accent)] text-[var(--color-surface-primary)]"
              : "cursor-not-allowed border-[var(--color-line)] bg-transparent text-[var(--color-text-tertiary)]",
          )}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>

    <div
      className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm md:flex md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-edit-title"
        onSubmit={handleSubmit}
        className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl md:max-h-[calc(100vh-3rem)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-4 py-4 md:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              Task data
            </p>
            <h2
              id="task-edit-title"
              className="mt-1 truncate text-xl font-semibold leading-tight text-[var(--color-text-primary)]"
            >
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            aria-label="Close task editor"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
            <div className="space-y-6">
              <Section title="Task" icon={FileText}>
                <div className="space-y-4">
                  <Field label="Title">
                    <input
                      value={draft.title}
                      maxLength={200}
                      required
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className={clsx(inputClass, "text-base font-semibold")}
                    />
                  </Field>
                  <DescriptionEditor
                    mode={descriptionMode}
                    value={draft.description}
                    textareaRef={descriptionRef}
                    onModeChange={setDescriptionMode}
                    onChange={(description) =>
                      setDraft((prev) => ({ ...prev, description }))
                    }
                    onBold={() => insertDescription("**", "**", "bold text")}
                    onItalic={() => insertDescription("*", "*", "italic text")}
                    onLink={() => insertDescription("[", "](https://)", "link text")}
                    onHeading1={() => formatDescriptionLines(() => "# ")}
                    onHeading2={() => formatDescriptionLines(() => "## ")}
                    onBulletList={() => formatDescriptionLines(() => "- ")}
                    onNumberedList={() => formatDescriptionLines((index) => `${index + 1}. `)}
                  />
                </div>
              </Section>

              <Section title="Planning" icon={CalendarDays}>
                <div className="space-y-5">
                  <Field label="Due date">
                    <input
                      type="date"
                      value={draft.due_at}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, due_at: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Status">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TASK_STATUSES.map((status) => {
                        const selected = draft.status === status;
                        const color = statusColorMap[status] ?? "var(--color-text-secondary)";

                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setDraft((prev) => ({ ...prev, status }))}
                            className="flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition"
                            style={{
                              borderColor: color,
                              backgroundColor: selected ? color : `${color}18`,
                              color: selected ? "#ffffff" : color,
                            }}
                          >
                            {displayCode(status)}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Priority">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {TASK_PRIORITIES.map((priority) => {
                        const selected = draft.priority === priority;
                        const color = priorityColorMap[priority] ?? "var(--color-text-secondary)";

                        return (
                          <button
                            key={priority}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setDraft((prev) => ({ ...prev, priority }))}
                            className="flex min-h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition"
                            style={{
                              borderColor: color,
                              backgroundColor: selected ? color : `${color}18`,
                              color: selected ? "#ffffff" : color,
                            }}
                          >
                            {PRIORITY_DISPLAY[priority]}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                </div>
              </Section>
            </div>

            <div className="space-y-6">
              <Section title="Meta" icon={Tags}>
                <div className="space-y-4">
                  <Field label="Category">
                    <SelectShell>
                      <select
                        value={draft.category_id}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, category_id: event.target.value }))
                        }
                        className={clsx(inputClass, "appearance-none pr-9")}
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </SelectShell>
                  </Field>
                  <Field label="Project">
                    <SelectShell>
                      <select
                        value={draft.project_id}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, project_id: event.target.value }))
                        }
                        className={clsx(inputClass, "appearance-none pr-9")}
                      >
                        <option value="">No project</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </SelectShell>
                  </Field>
                  <Field label="Tags">
                    <input
                      value={draft.tags}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, tags: event.target.value }))
                      }
                      placeholder="planning, calls, next"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Source" icon={LinkIcon}>
                <div className="space-y-4">
                  <Field label="Source type">
                    <SelectShell>
                      <select
                        value={draft.source_type}
                        onChange={(event) =>
                          setDraft((prev) => ({
                            ...prev,
                            source_type: event.target.value as SourceType,
                          }))
                        }
                        className={clsx(inputClass, "appearance-none pr-9")}
                      >
                        {SOURCE_TYPES.map((sourceType) => (
                          <option key={sourceType} value={sourceType}>
                            {SOURCE_DISPLAY[sourceType]}
                          </option>
                        ))}
                      </select>
                    </SelectShell>
                  </Field>
                  <Field label="Source reference">
                    <input
                      value={draft.source_ref}
                      maxLength={300}
                      onChange={(event) =>
                        setDraft((prev) => ({ ...prev, source_ref: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="System" icon={Hash}>
                <dl className="grid gap-3 text-sm">
                  <MetadataRow label="Owner" value={task.owner} />
                  <MetadataRow label="ID" value={task.id} mono />
                  <MetadataRow label="Created" value={formatDateTime(task.created_at)} />
                  <MetadataRow label="Updated" value={formatDateTime(task.updated_at)} />
                  <MetadataRow label="Completed" value={formatDateTime(task.completed_at)} />
                </dl>
              </Section>
            </div>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
            <Clock className="h-4 w-4" />
            <span>Updated {formatDateTime(task.updated_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--color-line)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={!draft.title.trim() || saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-text-primary)] px-4 text-sm font-semibold text-[var(--color-surface-primary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Clock className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </footer>
      </form>
    </div>
    </>
  );
}

function MobileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-7 items-center gap-2">
        <h3 className="text-sm font-medium uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
          {title}
        </h3>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>
      {children}
    </section>
  );
}

function MobileTabs({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 border-b border-[var(--color-line)]">{children}</div>;
}

function MobileFlatRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

function MobileSelectRow({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-12 items-center border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      {children}
      <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-[var(--color-text-secondary)]" />
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-text-tertiary)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
          {title}
        </h3>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function DescriptionEditor({
  mode,
  value,
  textareaRef,
  onModeChange,
  onChange,
  onBold,
  onItalic,
  onLink,
  onHeading1,
  onHeading2,
  onBulletList,
  onNumberedList,
}: {
  mode: DescriptionMode;
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onModeChange: (mode: DescriptionMode) => void;
  onChange: (value: string) => void;
  onBold: () => void;
  onItalic: () => void;
  onLink: () => void;
  onHeading1: () => void;
  onHeading2: () => void;
  onBulletList: () => void;
  onNumberedList: () => void;
}) {
  return (
    <div className="block space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Description</span>
        <div className="grid grid-cols-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-0.5">
          <button
            type="button"
            aria-pressed={mode === "write"}
            onClick={() => onModeChange("write")}
            className={clsx(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition",
              mode === "write"
                ? "bg-[var(--color-text-primary)] text-[var(--color-surface-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
            Write
          </button>
          <button
            type="button"
            aria-pressed={mode === "preview"}
            onClick={() => onModeChange("preview")}
            className={clsx(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition",
              mode === "preview"
                ? "bg-[var(--color-text-primary)] text-[var(--color-surface-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]",
            )}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <div className="overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] focus-within:border-[var(--color-text-primary)]">
          <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-2 py-1.5">
            <EditorButton label="Heading 1" onClick={onHeading1} icon={Heading1} />
            <EditorButton label="Heading 2" onClick={onHeading2} icon={Heading2} />
            <EditorButton label="Bold" onClick={onBold} icon={Bold} />
            <EditorButton label="Italic" onClick={onItalic} icon={Italic} />
            <EditorButton label="Link" onClick={onLink} icon={Link2} />
            <EditorButton label="Bulleted list" onClick={onBulletList} icon={List} />
            <EditorButton label="Numbered list" onClick={onNumberedList} icon={ListOrdered} />
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
            rows={8}
            onChange={(event) => onChange(event.target.value)}
            className="block min-h-48 w-full resize-y bg-transparent px-3 py-2 text-sm leading-relaxed text-[var(--color-text-primary)] outline-none"
          />
        </div>
      ) : (
        <div className="min-h-48 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-primary)] px-3 py-3">
          <MarkdownPreview value={value} />
        </div>
      )}
      <div className="text-right text-[11px] font-medium text-[var(--color-text-tertiary)]">
        {value.length}/{TASK_DESCRIPTION_MAX_LENGTH}
      </div>
    </div>
  );
}

function EditorButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-primary)] hover:text-[var(--color-text-primary)]"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function MarkdownPreview({ value }: { value: string }) {
  const blocks = parseMarkdownBlocks(value);

  if (blocks.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">No description</p>;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-primary)]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return (
            <HeadingTag key={index} className="font-semibold leading-tight text-[var(--color-text-primary)]">
              {renderInlineMarkdown(block.text)}
            </HeadingTag>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-[var(--color-line)] pl-3 text-[var(--color-text-secondary)]"
            >
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex}>{renderInlineMarkdown(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ol") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "paragraph") {
          return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
        }

        return null;
      })}
    </div>
  );
}

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "ul" | "ol"; items: string[] };

function parseMarkdownBlocks(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function isMarkdownBlockStart(line: string): boolean {
  const trimmed = line.trim();
  return /^(#{1,3})\s+/.test(trimmed) || /^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed) || /^>\s?/.test(trimmed);
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded border border-[var(--color-line)] bg-[var(--color-surface-secondary)] px-1 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      if (link && isSafePreviewHref(href)) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function isSafePreviewHref(href: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(href);
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
    </div>
  );
}

function MetadataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3 border-b border-[var(--color-line)] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-xs font-semibold text-[var(--color-text-tertiary)]">{label}</dt>
      <dd
        className={clsx(
          "min-w-0 break-words text-[var(--color-text-primary)]",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function toDateInput(value: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function formatDateTime(value: string | Date | null): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return format(date, "d MMM yyyy, HH:mm");
}

function displayCode(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))];
}

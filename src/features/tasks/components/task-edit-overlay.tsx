"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import { format } from "date-fns";
import clsx from "clsx";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  Hash,
  Link as LinkIcon,
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
import {
  CREATE_TASK_DUE_PRESETS,
  presetDueDate,
  type CreateTaskDuePreset,
} from "../model/create-task-model";
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
} from "../model/dashboard-types";
import { MarkdownPreview } from "./task-description-markdown";
import {
  DescriptionEditor,
  type DescriptionMode,
  Field,
  MetadataRow,
  MobileFlatRow,
  MobileSection,
  MobileTabs,
  Section,
  SelectShell,
} from "./task-edit-form-fields";

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
  const [initialDraft] = useState<Draft>(() => draftFromTask(task));
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [selectedDuePreset, setSelectedDuePreset] = useState<CreateTaskDuePreset | null>(() =>
    matchingDuePreset(initialDraft.due_at),
  );
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>(() =>
    task.description?.trim() ? "preview" : "write",
  );
  const [saving, setSaving] = useState(false);
  const [closeConfirmationOpen, setCloseConfirmationOpen] = useState(false);
  const mobileTitleRef = useRef<HTMLTextAreaElement>(null);
  const mobileDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const desktopTitleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const statusColorMap = Object.fromEntries(statusConfigs.map((c) => [c.status, c.color]));
  const priorityColorMap = Object.fromEntries(priorityConfigs.map((c) => [c.priority, c.color]));
  const hasUnsavedChanges = !draftsAreEqual(draft, initialDraft);
  const selectedCategory = categories.find((category) => category.id === draft.category_id);
  const selectedProject = projects.find((project) => project.id === draft.project_id);
  const projectLabel = selectedProject?.name ?? "No project";
  const categoryLabel = selectedCategory?.name ?? "Uncategorized";
  const statusLabel = displayCode(draft.status);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (hasUnsavedChanges) {
      setCloseConfirmationOpen(true);
      return;
    }

    onClose();
  }, [hasUnsavedChanges, onClose, saving]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (closeConfirmationOpen) {
          setCloseConfirmationOpen(false);
          return;
        }

        requestClose();
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [closeConfirmationOpen, requestClose]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        desktopTitleRef.current?.focus();
        return;
      }

      mobileTitleRef.current?.focus();
    });

    return () => cancelAnimationFrame(frame);
  }, []);

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
        onKeyDown={trapDialogFocus}
        className="fixed inset-0 z-50 flex flex-col bg-[var(--color-app-bg)] px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+1rem)] md:hidden"
      >
        <div className="mb-2 flex min-h-10 items-center justify-end">
          <h2 id="mobile-task-edit-title" className="sr-only">
            Edit task
          </h2>
          <button
            type="button"
            onClick={requestClose}
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
            <MobileTabs>
              {CREATE_TASK_DUE_PRESETS.map((preset) => {
                const selected = selectedDuePreset === preset.dueDate;

                return (
                  <button
                    key={preset.dueDate}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedDuePreset(preset.dueDate);
                      setDraft((prev) => ({ ...prev, due_at: presetDueDate(preset.dueDate) }));
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
            </MobileTabs>
            <MobileFlatRow>
              <input
                aria-label="Due date"
                type="date"
                value={draft.due_at}
                onChange={(event) => {
                  setSelectedDuePreset(null);
                  setDraft((prev) => ({ ...prev, due_at: event.target.value }));
                }}
                className="date-input-compact w-full bg-transparent text-base font-medium text-[var(--color-text-secondary)] outline-none"
              />
            </MobileFlatRow>
          </MobileSection>

          <MobileSection title="Meta">
            <div className="overflow-hidden rounded-3xl border border-[var(--color-line)] bg-[var(--color-surface-primary)]">
              <MobileMetaSelectRow icon={FolderKanban} label="Project" value={projectLabel}>
                <select
                  aria-label="Task project"
                  value={draft.project_id}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, project_id: event.target.value }))
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                >
                  <option value="">No project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </MobileMetaSelectRow>

              <MobileMetaSelectRow
                icon={Check}
                label="Category"
                value={categoryLabel}
              >
                {categories.length > 0 && (
                  <select
                    aria-label="Task category"
                    value={draft.category_id}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, category_id: event.target.value }))
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
              </MobileMetaSelectRow>

              <MobileMetaSelectRow icon={FileText} label="Status" value={statusLabel}>
                <select
                  aria-label="Task status"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, status: event.target.value as TaskStatus }))
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {displayCode(status)}
                    </option>
                  ))}
                </select>
              </MobileMetaSelectRow>

              <MobileMetaInputRow icon={Tags} label="Tags">
                <input
                  aria-label="Task tags"
                  value={draft.tags}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, tags: event.target.value }))
                  }
                  placeholder="Add"
                  className="min-w-0 flex-1 bg-transparent text-right text-lg font-bold text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                />
              </MobileMetaInputRow>
            </div>
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
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-edit-title"
        onSubmit={handleSubmit}
        onKeyDown={trapDialogFocus}
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
            onClick={requestClose}
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
                      ref={desktopTitleRef}
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
                    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {CREATE_TASK_DUE_PRESETS.map((preset) => {
                        const selected = selectedDuePreset === preset.dueDate;

                        return (
                          <button
                            key={preset.dueDate}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedDuePreset(preset.dueDate);
                              setDraft((prev) => ({ ...prev, due_at: presetDueDate(preset.dueDate) }));
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
                      type="date"
                      value={draft.due_at}
                      onChange={(event) => {
                        setSelectedDuePreset(null);
                        setDraft((prev) => ({ ...prev, due_at: event.target.value }));
                      }}
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
              onClick={requestClose}
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

      {closeConfirmationOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-changes-title"
            aria-describedby="discard-changes-description"
            onKeyDown={trapDialogFocus}
            className="w-full max-w-sm rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-primary)] p-5 shadow-2xl"
          >
            <h2 id="discard-changes-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              Discard changes?
            </h2>
            <p id="discard-changes-description" className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Your unsaved task edits will be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setCloseConfirmationOpen(false)}
                className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-secondary)]"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-[var(--color-text-danger)] px-3 py-2 text-sm font-semibold text-[var(--color-accent-foreground)] transition hover:opacity-90"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileMetaSelectRow({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-16 items-center gap-4 border-b border-[var(--color-line)] px-5 transition focus-within:bg-[var(--color-surface-secondary)] last:border-b-0">
      <Icon className="h-5 w-5 shrink-0 text-[var(--color-text-primary)]" />
      <span className="min-w-0 flex-1 truncate text-lg font-bold text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <span className="flex min-w-0 max-w-[52%] items-center justify-end gap-2 text-lg font-bold text-[var(--color-text-primary)]">
        <span className="min-w-0 truncate">{value}</span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-primary)]" />
      </span>
      {children}
    </div>
  );
}

function MobileMetaInputRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-16 items-center gap-4 border-b border-[var(--color-line)] px-5 last:border-b-0">
      <Icon className="h-5 w-5 shrink-0 text-[var(--color-text-primary)]" />
      <span className="min-w-0 flex-1 truncate text-lg font-bold text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="flex min-w-0 max-w-[52%] flex-1 items-center justify-end gap-2">
        {children}
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-primary)]" />
      </div>
    </div>
  );
}

function draftsAreEqual(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.category_id === b.category_id &&
    a.project_id === b.project_id &&
    a.due_at === b.due_at &&
    a.source_type === b.source_type &&
    a.source_ref === b.source_ref &&
    a.tags === b.tags
  );
}

function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab") return;

  const focusable = getFocusableElements(event.currentTarget);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;

  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !event.currentTarget.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getClientRects().length > 0);
}

function toDateInput(value: string | Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

function matchingDuePreset(dueAt: string): CreateTaskDuePreset | null {
  return (
    CREATE_TASK_DUE_PRESETS.find((preset) => presetDueDate(preset.dueDate) === dueAt)
      ?.dueDate ?? null
  );
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

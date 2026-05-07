import type { ComponentType, ReactNode, RefObject } from "react";
import clsx from "clsx";
import {
  Bold,
  ChevronDown,
  Eye,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  PencilLine,
} from "lucide-react";
import { TASK_DESCRIPTION_MAX_LENGTH } from "@/lib/constants";
import { MarkdownPreview } from "./task-description-markdown";

export type DescriptionMode = "write" | "preview";

export function MobileSection({ title, children }: { title: string; children: ReactNode }) {
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

export function MobileTabs({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 border-b border-[var(--color-line)]">{children}</div>;
}

export function MobileFlatRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      {children}
    </div>
  );
}

export function MobileSelectRow({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-12 items-center border-b border-[var(--color-line)] py-3 text-[var(--color-text-secondary)]">
      {children}
      <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-[var(--color-text-secondary)]" />
    </div>
  );
}

export function Section({
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

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

export function DescriptionEditor({
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

export function SelectShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
    </div>
  );
}

export function MetadataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
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

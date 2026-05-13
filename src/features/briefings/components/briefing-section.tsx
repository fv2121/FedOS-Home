import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

export function BriefingSection({ title, children }: Props) {
  return (
    <section className="rounded-3xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 md:p-6">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {title}
      </h3>
      <div className="text-[15px] leading-relaxed text-[var(--color-text-primary)]">
        {children}
      </div>
    </section>
  );
}

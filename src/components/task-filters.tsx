"use client";

import { useRef, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import type { Category, Project, Tag } from "./dashboard-types";

type Props = {
  categories: Category[];
  projects: Project[];
  tags: Tag[];
  updateURL: (next: Record<string, string | null>) => void;
};

export function TaskFilters({ categories, projects, tags, updateURL }: Props) {
  const searchParams = useSearchParams();
  const queryRef = useRef<HTMLInputElement>(null);
  const currentQuery = searchParams.get("q") ?? "";

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("q") ?? "");
    updateURL({ q: query.trim() || null, view: "search" });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Search</h2>
        <div className="flex items-center gap-2">
          <select
            value={searchParams.get("priority") ?? ""}
            onChange={(e) => updateURL({ priority: e.target.value || null })}
            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
          >
            <option value="">All priorities</option>
            {TASK_PRIORITIES.map((p) => (
              <option value={p} key={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={searchParams.get("categoryId") ?? ""}
            onChange={(e) => updateURL({ categoryId: e.target.value || null })}
            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={submitSearch}>
        <input
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          placeholder="Search title, note, owner..."
          name="q"
          ref={queryRef}
          defaultValue={currentQuery}
          key={currentQuery}
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"
        >
          Find
        </button>
      </form>

      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
        <select
          value={searchParams.get("projectId") ?? ""}
          onChange={(e) => updateURL({ projectId: e.target.value || null })}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("status") ?? ""}
          onChange={(e) => updateURL({ status: e.target.value || null })}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
        >
          <option value="">All status</option>
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={searchParams.get("due") ?? ""}
          onChange={(e) => updateURL({ due: e.target.value || null })}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
        >
          <option value="">Any due date</option>
          <option value="today">Due today</option>
          <option value="overdue">Overdue</option>
          <option value="none">No due date</option>
        </select>

        <select
          value={searchParams.get("tag") ?? ""}
          onChange={(e) => updateURL({ tag: e.target.value || null })}
          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs md:text-sm"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.slug}>
              #{tag.slug}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            if (queryRef.current) queryRef.current.value = "";
            updateURL({
              q: null,
              priority: null,
              categoryId: null,
              projectId: null,
              status: null,
              due: null,
              tag: null,
            });
          }}
          className="rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 md:text-sm"
        >
          Clear filters
        </button>
      </div>
    </>
  );
}

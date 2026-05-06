"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { TASK_PRIORITIES } from "@/lib/constants";
import type { Category } from "./dashboard-types";

type Props = {
  categories: Category[];
  onCreateTask: (task: {
    title: string;
    description: string;
    category_id: string;
    priority: string;
    due_at: string;
  }) => Promise<boolean>;
};

export function QuickAddBar({ categories, onCreateTask }: Props) {
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category_id: categories[0]?.id ?? "",
    priority: "medium",
    due_at: "",
  });

  async function handleCreate() {
    const created = await onCreateTask(newTask);
    if (created) {
      setNewTask((prev) => ({ ...prev, title: "" }));
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-16 z-20 px-3 md:hidden">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Quick add task"
            value={newTask.title}
            onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
          />
          <button
            onClick={handleCreate}
            className="rounded-xl bg-slate-900 px-3 py-2 text-white"
            aria-label="Fast add task"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select
            value={newTask.category_id}
            onChange={(e) => setNewTask((prev) => ({ ...prev, category_id: e.target.value }))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={newTask.priority}
            onChange={(e) =>
              setNewTask((prev) => ({ ...prev, priority: e.target.value as typeof prev.priority }))
            }
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newTask.due_at}
            onChange={(e) => setNewTask((prev) => ({ ...prev, due_at: e.target.value }))}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

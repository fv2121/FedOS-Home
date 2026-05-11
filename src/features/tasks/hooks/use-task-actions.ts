"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CreateTaskInput } from "../model/create-task-model";
import type { TaskRow, TaskUpdateFields } from "../model/dashboard-types";

export function useTaskActions(
  setTasks: React.Dispatch<React.SetStateAction<TaskRow[]>>,
) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mutationCount, setMutationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function updateURL(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
      router.refresh();
    });
  }

  async function apiRequest<T>(
    url: string,
    body: unknown,
    fallbackMessage: string,
  ): Promise<T | null> {
    setError(null);
    setMutationCount((count) => count + 1);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: T; error?: string; details?: unknown }
        | null;

      if (!res.ok || payload?.ok === false) {
        const message = payload?.error ?? fallbackMessage;
        setError(message);

        if (res.status === 401) {
          const next = encodeURIComponent(pathname || "/");
          startTransition(() => router.push(`/login?next=${next}`));
        }

        return null;
      }

      return payload?.data ?? null;
    } catch {
      setError(fallbackMessage);
      return null;
    } finally {
      setMutationCount((count) => Math.max(0, count - 1));
    }
  }

  async function createTask(newTask: CreateTaskInput): Promise<boolean> {
    if (!newTask.title.trim()) return false;
    const parsedTags = newTask.tags
      ? newTask.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];
    const input = {
      title: newTask.title.trim(),
      priority: newTask.priority,
      ...(newTask.status ? { status: newTask.status } : {}),
      ...(newTask.description.trim() ? { description: newTask.description.trim() } : {}),
      ...(newTask.category_id ? { category_id: newTask.category_id } : {}),
      ...(newTask.project_id ? { project_id: newTask.project_id } : {}),
      ...(newTask.due_at ? { due_at: newTask.due_at } : {}),
      ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
    };

    const created = await apiRequest<TaskRow>(
      "/api/llm/createTask",
      { input },
      "Could not create task",
    );

    if (!created) return false;
    startTransition(() => router.refresh());
    return true;
  }

  async function complete(id: string) {
    const updated = await apiRequest<TaskRow>(
      "/api/llm/completeTask",
      { id, reason: "Completed from dashboard" },
      "Could not complete task",
    );

    if (!updated) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    startTransition(() => router.refresh());
  }

  async function setStatus(id: string, status: string) {
    const updated = await apiRequest<TaskRow>(
      "/api/llm/updateTask",
      { id, fields: { status } },
      "Could not update task status",
    );

    if (!updated) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    startTransition(() => router.refresh());
  }

  async function setPriority(id: string, priority: string) {
    const updated = await apiRequest<TaskRow>(
      "/api/llm/updateTask",
      { id, fields: { priority } },
      "Could not update task priority",
    );

    if (!updated) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    startTransition(() => router.refresh());
  }

  async function setCategory(id: string, categoryId: string) {
    const updated = await apiRequest<TaskRow>(
      "/api/llm/updateTaskCategory",
      { taskId: id, categoryId },
      "Could not update task category",
    );

    if (!updated) return;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    startTransition(() => router.refresh());
  }

  async function updateTask(id: string, fields: TaskUpdateFields): Promise<boolean> {
    const updated = await apiRequest<TaskRow>(
      "/api/llm/updateTask",
      { id, fields, reason: "Edited from task overlay" },
      "Could not update task",
    );

    if (!updated) return false;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
    startTransition(() => router.refresh());
    return true;
  }

  async function deleteTask(id: string) {
    const result = await apiRequest<{ id: string }>(
      "/api/llm/deleteTask",
      { id },
      "Could not delete task",
    );

    if (!result) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return {
    updateURL,
    createTask,
    complete,
    setStatus,
    setPriority,
    setCategory,
    updateTask,
    deleteTask,
    error,
    clearError: () => setError(null),
    isPending: isPending || mutationCount > 0,
  };
}

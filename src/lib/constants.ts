export const TASK_STATUSES = [
  "active",
  "waiting",
  "deferred",
  "done",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const SOURCE_TYPES = [
  "manual",
  "email",
  "calendar",
  "message",
  "llm",
  "fedos",
] as const;

export const ACTOR_TYPES = ["user", "llm", "system"] as const;

export const VIEW_OPTIONS = [
  "home",
  "tasks",
  "new",
  "today",
  "waiting",
  "projects",
  "categories",
  "done",
  "search",
] as const;

export type ViewOption = (typeof VIEW_OPTIONS)[number];

export function isViewOption(value: string | null | undefined): value is ViewOption {
  return typeof value === "string" && (VIEW_OPTIONS as readonly string[]).includes(value);
}

export const DEFAULT_OWNER = "Federico";
export const TASK_DESCRIPTION_MAX_LENGTH = 10000;

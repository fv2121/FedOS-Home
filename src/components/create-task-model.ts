import { addDays, format } from "date-fns";

export const CREATE_TASK_DEFAULT_PRIORITY = "medium";

export const CREATE_TASK_DUE_PRESETS = [
  { desktopLabel: "Today", mobileLabel: "Today", dueDate: "today" },
  { desktopLabel: "Tom", mobileLabel: "Tom", dueDate: "tomorrow" },
  { desktopLabel: "Week", mobileLabel: "Week", dueDate: "this-week" },
  { desktopLabel: "No date", mobileLabel: "None", dueDate: "none" },
] as const;

export type CreateTaskDuePreset = (typeof CREATE_TASK_DUE_PRESETS)[number]["dueDate"];

export type CreateTaskInput = {
  title: string;
  description: string;
  category_id?: string;
  project_id?: string;
  priority: string;
  due_at: string;
};

export type CreateTaskDraft = {
  title: string;
  description: string;
  category_id: string;
  project_id: string;
  priority: string;
  due_at: string;
};

export function presetDueDate(dueDate: CreateTaskDuePreset) {
  const today = new Date();

  if (dueDate === "none") {
    return "";
  }

  if (dueDate === "tomorrow") {
    return format(addDays(today, 1), "yyyy-MM-dd");
  }

  if (dueDate === "this-week") {
    const daysUntilFriday = (5 - today.getDay() + 7) % 7;
    return format(addDays(today, daysUntilFriday), "yyyy-MM-dd");
  }

  return format(today, "yyyy-MM-dd");
}

export function createDefaultTaskDraft(): CreateTaskDraft {
  return {
    title: "",
    description: "",
    category_id: "",
    project_id: "",
    priority: CREATE_TASK_DEFAULT_PRIORITY,
    due_at: presetDueDate("today"),
  };
}

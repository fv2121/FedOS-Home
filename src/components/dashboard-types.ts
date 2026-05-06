import { SOURCE_TYPES, TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];
export type TagRel = { tag: { id: string; name: string; slug: string } };

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus | "dropped";
  priority: TaskPriority;
  owner: string;
  due_at: string | Date | null;
  created_at: string | Date;
  completed_at: string | Date | null;
  updated_at: string | Date;
  source_type: SourceType;
  source_ref: string | null;
  category_id: string;
  project_id: string | null;
  category: { id: string; name: string; color: string };
  project: { id: string; name: string } | null;
  tags: TagRel[];
};

export type VisibleTaskRow = Omit<TaskRow, "status"> & { status: TaskStatus };
export type TaskUpdateFields = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  category_id: string;
  project_id: string | null;
  owner: string;
  due_at: string | null;
  source_type: SourceType;
  source_ref: string | null;
  tags: string[];
}>;
export type Category = { id: string; name: string; color: string; slug: string };
export type Project = { id: string; name: string; color: string; status: string };
export type PriorityConfig = { priority: string; color: string };
export type StatusConfig = { status: string; color: string };
export type Tag = { id: string; name: string; slug: string };

export function isVisibleTaskRow(task: TaskRow): task is VisibleTaskRow {
  return task.status !== "dropped";
}

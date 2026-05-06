import { z } from "zod";
import {
  ACTOR_TYPES,
  SOURCE_TYPES,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/constants";

const optionalDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
  .optional()
  .nullable();

export const taskFilterSchema = z.object({
  q: z.string().optional(),
  view: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  categoryId: z.string().optional(),
  projectId: z.string().optional(),
  owner: z.string().optional(),
  tag: z.string().optional(),
  due: z.enum(["today", "overdue", "none"]).optional(),
});

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(TASK_DESCRIPTION_MAX_LENGTH).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category_id: z.string().optional(),
  project_id: z.string().optional().nullable(),
  owner: z.string().max(120).optional(),
  due_at: optionalDate,
  source_type: z.enum(SOURCE_TYPES).optional(),
  source_ref: z.string().max(300).optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export const completeTaskSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export const addTaskNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  color: z.string().trim().max(20).optional(),
  icon: z.string().trim().max(40).optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateTaskCategorySchema = z.object({
  taskId: z.string().min(1),
  categoryId: z.string().min(1),
});

export const eventActorSchema = z.enum(ACTOR_TYPES).optional();

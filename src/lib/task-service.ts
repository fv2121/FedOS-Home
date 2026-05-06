import { Prisma, type ActorType, type SourceType, type TaskPriority, type TaskStatus } from "@prisma/client";
import { addDays, endOfDay, startOfDay } from "date-fns";
import { DEFAULT_OWNER } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

type TaskInclude = {
  category: true;
  project: true;
  tags: { include: { tag: true } };
};

const TASK_INCLUDE: TaskInclude = {
  category: true,
  project: true,
  tags: { include: { tag: true } },
};

const CLOSED_TASK_STATUSES = new Set<TaskStatus>(["done"]);

export type TaskFilters = {
  q?: string;
  view?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  categoryId?: string;
  projectId?: string;
  owner?: string;
  tag?: string;
  due?: "today" | "overdue" | "none";
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  category_id?: string;
  project_id?: string | null;
  owner?: string;
  due_at?: string | null;
  source_type?: SourceType;
  source_ref?: string | null;
  tags?: string[];
};

function toDate(input?: string | null): Date | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function statusTransitionData(
  status: TaskStatus,
  existing?: { completed_at: Date | null },
): Pick<Prisma.TaskUncheckedUpdateInput, "status" | "completed_at"> {
  return {
    status,
    completed_at: CLOSED_TASK_STATUSES.has(status) ? (existing?.completed_at ?? new Date()) : null,
  };
}

function statusTransitionEventType(status: TaskStatus): string {
  if (status === "done") return "task_completed";
  return "task_status_changed";
}

async function ensureUncategorizedCategoryId(): Promise<string> {
  const existing = await prisma.category.findUnique({ where: { slug: "uncategorized" } });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: {
      name: "Uncategorized",
      slug: "uncategorized",
      color: "#64748b",
      icon: "circle",
      sort_order: 99,
    },
  });

  return created.id;
}

function buildWhere(filters: TaskFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  if (filters.q) {
    where.OR = [
      { title: { contains: filters.q, mode: "insensitive" } },
      { description: { contains: filters.q, mode: "insensitive" } },
      { owner: { contains: filters.q, mode: "insensitive" } },
      { source_ref: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.categoryId) where.category_id = filters.categoryId;
  if (filters.projectId) where.project_id = filters.projectId;
  if (filters.owner) where.owner = { contains: filters.owner, mode: "insensitive" };
  if (filters.tag) where.tags = { some: { tag: { slug: filters.tag } } };

  if (filters.due === "today") {
    where.due_at = { gte: startOfDay(new Date()), lte: endOfDay(new Date()) };
  }

  if (filters.due === "overdue") {
    where.due_at = { lt: startOfDay(new Date()) };
    where.status = { not: "done" };
  }

  if (filters.due === "none") {
    where.due_at = null;
  }

  switch (filters.view) {
    case "home":
      break;
    case "today":
      {
        const existingAnd = where.AND
          ? Array.isArray(where.AND)
            ? where.AND
            : [where.AND]
          : [];
      where.AND = [
        ...existingAnd,
        { status: { in: ["active", "waiting"] } },
        { due_at: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
      ];
      break;
      }
    case "waiting":
      where.status = "waiting";
      break;
    case "done":
      where.status = "done";
      break;
    default:
      break;
  }

  return where;
}

export async function searchTasks(filters: TaskFilters = {}) {
  return prisma.task.findMany({
    where: buildWhere(filters),
    include: TASK_INCLUDE,
    orderBy: [
      { due_at: "asc" },
      { priority: "desc" },
      { updated_at: "desc" },
    ],
    take: 250,
  });
}

export async function getTask(id: string) {
  return prisma.task.findUnique({
    where: { id },
    include: {
      ...TASK_INCLUDE,
      events: { orderBy: { created_at: "desc" }, take: 50 },
      sources: { orderBy: { captured_at: "desc" }, take: 20 },
    },
  });
}

async function createEvent(
  tx: Prisma.TransactionClient,
  input: {
    task_id: string;
    event_type: string;
    old_value?: Prisma.InputJsonValue;
    new_value?: Prisma.InputJsonValue;
    reason?: string;
    actor?: ActorType;
  },
) {
  await tx.taskEvent.create({
    data: {
      task_id: input.task_id,
      event_type: input.event_type,
      old_value: input.old_value,
      new_value: input.new_value,
      reason: input.reason,
      actor: input.actor ?? "user",
    },
  });
}

async function connectTagsByName(tx: Prisma.TransactionClient, taskId: string, tags?: string[]) {
  if (!tags || tags.length === 0) return;

  for (const raw of tags) {
    const name = raw.trim();
    if (!name) continue;

    const slug = slugify(name);
    const tag = await tx.tag.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });

    await tx.taskTag.upsert({
      where: { task_id_tag_id: { task_id: taskId, tag_id: tag.id } },
      update: {},
      create: { task_id: taskId, tag_id: tag.id },
    });
  }
}

export async function createTask(input: TaskCreateInput, actor: ActorType = "user") {
  const categoryId = input.category_id ?? (await ensureUncategorizedCategoryId());

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: input.status ?? "active",
        priority: input.priority ?? "medium",
        category_id: categoryId,
        project_id: input.project_id ?? null,
        owner: input.owner ?? DEFAULT_OWNER,
        due_at: toDate(input.due_at),
        source_type: input.source_type ?? "manual",
        source_ref: input.source_ref ?? null,
      },
      include: TASK_INCLUDE,
    });

    await connectTagsByName(tx, task.id, input.tags);

    await tx.taskSource.create({
      data: {
        task_id: task.id,
        source_type: input.source_type ?? "manual",
        source_ref: input.source_ref,
        summary: "Task created",
      },
    });

    await createEvent(tx, {
      task_id: task.id,
      event_type: "task_created",
      new_value: task as unknown as Prisma.InputJsonValue,
      actor,
    });

    return task;
  });
}

export async function updateTask(
  id: string,
  fields: Partial<TaskCreateInput>,
  actor: ActorType = "user",
  reason?: string,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!existing) {
      throw new Error("Task not found");
    }

    const data: Prisma.TaskUncheckedUpdateInput = {
      title: fields.title ?? undefined,
      description: fields.description !== undefined ? fields.description : undefined,
      priority: fields.priority ?? undefined,
      category_id: fields.category_id ?? undefined,
      project_id: fields.project_id !== undefined ? fields.project_id : undefined,
      owner: fields.owner ?? undefined,
      due_at: fields.due_at !== undefined ? toDate(fields.due_at) : undefined,
      source_type: fields.source_type ?? undefined,
      source_ref: fields.source_ref !== undefined ? fields.source_ref : undefined,
      ...(fields.status !== undefined ? statusTransitionData(fields.status, existing) : {}),
    };

    const updated = await tx.task.update({
      where: { id },
      data,
      include: TASK_INCLUDE,
    });

    if (fields.tags) {
      await tx.taskTag.deleteMany({ where: { task_id: id } });
      await connectTagsByName(tx, id, fields.tags);
    }

    const taskWithTags =
      fields.tags !== undefined
        ? await tx.task.findUniqueOrThrow({ where: { id }, include: TASK_INCLUDE })
        : updated;

    await createEvent(tx, {
      task_id: id,
      event_type:
        fields.status !== undefined && fields.status !== existing.status
          ? statusTransitionEventType(fields.status)
          : "task_updated",
      old_value: existing as unknown as Prisma.InputJsonValue,
      new_value: taskWithTags as unknown as Prisma.InputJsonValue,
      actor,
      reason,
    });

    return taskWithTags;
  });
}

async function transitionTaskStatus(
  id: string,
  status: TaskStatus,
  reason?: string,
  actor: ActorType = "user",
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id }, include: TASK_INCLUDE });
    if (!existing) throw new Error("Task not found");

    const updated = await tx.task.update({
      where: { id },
      data: statusTransitionData(status, existing),
      include: TASK_INCLUDE,
    });

    await createEvent(tx, {
      task_id: id,
      event_type: statusTransitionEventType(status),
      old_value: existing as unknown as Prisma.InputJsonValue,
      new_value: updated as unknown as Prisma.InputJsonValue,
      actor,
      reason,
    });

    return updated;
  });
}

export async function completeTask(id: string, reason?: string, actor: ActorType = "user") {
  return transitionTaskStatus(id, "done", reason, actor);
}

export async function deleteTask(id: string) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");
  await prisma.task.delete({ where: { id } });
  return { id };
}

export async function addTaskNote(id: string, note: string, actor: ActorType = "user") {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) throw new Error("Task not found");

  await prisma.taskEvent.create({
    data: {
      task_id: id,
      event_type: "note_added",
      new_value: { note },
      actor,
    },
  });

  await prisma.task.update({ where: { id }, data: { updated_at: new Date() } });

  return { id, note };
}

export async function getTaskHistory(id: string) {
  return prisma.taskEvent.findMany({
    where: { task_id: id },
    orderBy: { created_at: "desc" },
    take: 100,
  });
}

export async function summarizeTasks(scope?: string) {
  const where: Prisma.TaskWhereInput = {};
  const todayStart = startOfDay(new Date());

  if (scope === "today") {
    where.due_at = { gte: todayStart, lte: endOfDay(new Date()) };
  }

  if (scope === "week") {
    where.due_at = { gte: todayStart, lte: endOfDay(addDays(new Date(), 7)) };
  }

  const [countsByStatus, overdue, dueToday, recentlyChanged] = await Promise.all([
    prisma.task.groupBy({ by: ["status"], _count: true, where }),
    prisma.task.count({ where: { due_at: { lt: todayStart }, status: { not: "done" } } }),
    prisma.task.count({
      where: {
        due_at: { gte: todayStart, lte: endOfDay(new Date()) },
        status: { not: "done" },
      },
    }),
    prisma.task.count({ where: { updated_at: { gte: addDays(new Date(), -1) } } }),
  ]);

  return {
    scope: scope ?? "all",
    countsByStatus,
    overdue,
    dueToday,
    recentlyChanged,
  };
}

export async function listCategories() {
  return prisma.category.findMany({
    where: { archived_at: null },
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(input: {
  name: string;
  slug?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
}) {
  const slug = input.slug?.trim() || slugify(input.name);
  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      color: input.color ?? "#64748b",
      icon: input.icon ?? "tag",
      sort_order: input.sort_order ?? 0,
    },
  });
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; slug: string; color: string; icon: string; sort_order: number }>,
) {
  return prisma.category.update({
    where: { id },
    data: {
      name: input.name,
      slug: input.slug,
      color: input.color,
      icon: input.icon,
      sort_order: input.sort_order,
    },
  });
}

export async function updateTaskCategory(
  taskId: string,
  categoryId: string,
  actor: ActorType = "user",
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({ where: { id: taskId } });
    if (!existing) throw new Error("Task not found");

    const updated = await tx.task.update({
      where: { id: taskId },
      data: { category_id: categoryId },
    });

    await createEvent(tx, {
      task_id: taskId,
      event_type: "category_changed",
      old_value: { category_id: existing.category_id },
      new_value: { category_id: categoryId },
      actor,
    });

    return updated;
  });
}

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function listPriorityConfigs() {
  return prisma.priorityConfig.findMany();
}

export async function listStatusConfigs() {
  return prisma.statusConfig.findMany();
}

export async function listTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

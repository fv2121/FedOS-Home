import { PrismaClient, SourceType } from "@prisma/client";
import { slugify } from "../src/lib/slugify";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: "Work", color: "#0ea5e9", icon: "briefcase", sort_order: 1 },
    { name: "Personal", color: "#22c55e", icon: "home", sort_order: 2 },
    { name: "Admin", color: "#f59e0b", icon: "folder", sort_order: 3 },
    { name: "FedOS", color: "#6366f1", icon: "brain", sort_order: 4 },
    { name: "Learning", color: "#06b6d4", icon: "book", sort_order: 5 },
    { name: "Health", color: "#ef4444", icon: "heart", sort_order: 6 },
    { name: "Uncategorized", color: "#64748b", icon: "circle", sort_order: 99 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: slugify(category.name) },
      update: category,
      create: {
        ...category,
        slug: slugify(category.name),
      },
    });
  }

  const work = await prisma.category.findUniqueOrThrow({ where: { slug: "work" } });
  const fedos = await prisma.category.findUniqueOrThrow({ where: { slug: "fedos" } });
  const project = await prisma.project.findUnique({ where: { id: "fedos-default-project" } });

  const tasks = [
    {
      title: "Review overdue commitments",
      description: "Sweep overdue tasks and re-prioritize with FedOS context",
      status: "active",
      priority: "high",
      category_id: fedos.id,
      project_id: project?.id ?? null,
      owner: "Federico",
      source_type: SourceType.fedos,
    },
    {
      title: "Prepare weekly stakeholder sync notes",
      description: "Collect blockers and decisions before the meeting",
      status: "active",
      priority: "critical",
      category_id: work.id,
      owner: "Federico",
      source_type: SourceType.manual,
    },
    {
      title: "Triage new tasks",
      description: "Convert new items into concrete next actions",
      status: "active",
      priority: "medium",
      category_id: work.id,
      owner: "Federico",
      source_type: SourceType.manual,
    },
  ] as const;

  for (const taskInput of tasks) {
    const task = await prisma.task.create({
      data: {
        ...taskInput,
      },
    });

    await prisma.taskSource.create({
      data: {
        task_id: task.id,
        source_type: taskInput.source_type,
        summary: "Seeded task",
      },
    });

    await prisma.taskEvent.create({
      data: {
        task_id: task.id,
        event_type: "task_created",
        new_value: task,
        actor: "system",
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

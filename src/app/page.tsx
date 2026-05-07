import { TaskDashboard } from "@/components/task-dashboard";
import { ErrorBoundary } from "@/components/error-boundary";
import { listCategories, listProjects, listPriorityConfigs, listStatusConfigs, searchTasks } from "@/lib/task-service";

export const dynamic = "force-dynamic";

type SearchParamMap = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<SearchParamMap>;
}) {
  const params = (await searchParams) ?? {};
  const get = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const requestedView = get("view");

  const filters = {
    view: requestedView === "done" ? "done" : "home",
  };

  const [tasks, categories, projects, priorityConfigs, statusConfigs] = await Promise.all([
    searchTasks(filters),
    listCategories(),
    listProjects(),
    listPriorityConfigs(),
    listStatusConfigs(),
  ]);

  return (
    <ErrorBoundary>
      <TaskDashboard
        initialTasks={tasks}
        categories={categories}
        projects={projects}
        priorityConfigs={priorityConfigs}
        statusConfigs={statusConfigs}
      />
    </ErrorBoundary>
  );
}

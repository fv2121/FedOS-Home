import { TaskDashboard } from "@/features/tasks/components/task-dashboard";
import { BriefingHome } from "@/features/briefings/components/briefing-home";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  listCategories,
  listProjects,
  listPriorityConfigs,
  listStatusConfigs,
  searchTasks,
} from "@/server/tasks";
import { getBriefingPackage, listBriefingPackages } from "@/server/briefings";
import type { BriefingPackageDetail } from "@/features/briefings/model/briefing-types";

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
  const isTasksView =
    requestedView === "tasks" ||
    requestedView === "new" ||
    requestedView === "done";

  if (isTasksView) {
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

  const recent = await listBriefingPackages({ limit: 1 });
  const latest = recent[0] ? await getBriefingPackage(recent[0].id) : null;

  const serialized: BriefingPackageDetail | null = latest
    ? {
        id: latest.id,
        status: latest.status,
        context_mode: latest.context_mode,
        created_at: latest.created_at.toISOString(),
        updated_at: latest.updated_at.toISOString(),
        model: latest.model,
        prompt_version: latest.prompt_version,
        memory_digest_hash: latest.memory_digest_hash,
        memory_digest_stale: latest.memory_digest_stale,
        memory_digest_approved_at:
          latest.memory_digest_approved_at?.toISOString() ?? null,
        payload: latest.payload as BriefingPackageDetail["payload"],
        proposed_actions: latest.proposed_actions.map((action) => ({
          id: action.id,
          briefing_package_id: action.briefing_package_id,
          title: action.title,
          description: action.description,
          suggested_status: action.suggested_status,
          suggested_priority: action.suggested_priority,
          suggested_category_id: action.suggested_category_id,
          suggested_project_id: action.suggested_project_id,
          suggested_owner: action.suggested_owner,
          suggested_due_at: action.suggested_due_at?.toISOString() ?? null,
          suggested_source_type: action.suggested_source_type,
          suggested_source_ref: action.suggested_source_ref,
          suggested_tags: action.suggested_tags,
          rationale: action.rationale,
          uncertainty: action.uncertainty,
          status: action.status,
          decision_reason: action.decision_reason,
          decided_at: action.decided_at?.toISOString() ?? null,
          created_at: action.created_at.toISOString(),
          approved_task: action.approved_task
            ? { id: action.approved_task.id, title: action.approved_task.title }
            : null,
        })),
      }
    : null;

  return (
    <ErrorBoundary>
      <BriefingHome briefing={serialized} />
    </ErrorBoundary>
  );
}

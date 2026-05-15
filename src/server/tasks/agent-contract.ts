/**
 * POC-01: Provider-agnostic task operation contract.
 *
 * These types are intentionally thin — no business logic. They define the
 * stable interface that CLI, MCP, and HTTP adapters should all target so the
 * contract stays consistent across surfaces.
 */

/** Approved LLM client identifiers for write operations. */
export type AgentClient =
  | "claude-desktop"
  | "claude-code"
  | "claude-cowork"
  | "codex"
  | "chatgpt-desktop"
  | "chatgpt-mobile"
  | "local-agent"
  | "other";

/**
 * Optional metadata attached to write operations from LLM clients.
 * Stored in task event reason or source_ref for audit trail.
 */
export interface AgentMeta {
  client?: AgentClient;
  session_ref?: string;
  approval_ref?: string;
}

/**
 * Canonical operation names used across all adapters.
 * The CLI command `today` maps to `list_tasks`, `search` maps to
 * `search_tasks`, etc. MCP tools and HTTP endpoints should use these
 * same identifiers rather than inventing new names.
 */
export type TaskOperation =
  | "list_tasks"
  | "search_tasks"
  | "get_task"
  | "create_task"
  | "update_task"
  | "complete_task"
  | "add_task_note"
  | "delete_task"
  | "summarize_tasks"
  | "list_categories";

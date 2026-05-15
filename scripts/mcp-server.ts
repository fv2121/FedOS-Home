#!/usr/bin/env node
/**
 * POC-06: MCP adapter for FedOS Home durable tasks.
 *
 * Exposes the task contract from `docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md`
 * to MCP-capable desktop LLM clients (Claude Desktop first).
 *
 * Architecture:
 *   Claude Desktop (MCP client)
 *      -> stdio
 *           -> this script (MCP server)
 *                -> HTTP fetch (Authorization: Bearer $FEDOS_AGENT_TOKEN)
 *                     -> http://<FEDOS_AGENT_API_BASE>/api/agent/tasks/*
 *                          -> src/server/tasks (single source of truth)
 *
 * Per POC-06 rules: this server MUST NOT import Prisma or `src/server/tasks`
 * directly, and MUST NOT contain task business logic. It is a thin tool layer
 * over the already-validated authenticated HTTP adapter built in POC-07.
 *
 * Env:
 *   FEDOS_AGENT_TOKEN      (required) bearer token for /api/agent/tasks
 *   FEDOS_AGENT_API_BASE   (optional) default http://localhost:3000
 *
 * Run:
 *   npm run agent:mcp
 *
 * Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "fedos-home": {
 *         "command": "npx",
 *         "args": ["-y", "tsx", "/abs/path/to/FedOS-Home/scripts/mcp-server.ts"],
 *         "env": {
 *           "FEDOS_AGENT_TOKEN": "...",
 *           "FEDOS_AGENT_API_BASE": "http://localhost:3000"
 *         }
 *       }
 *     }
 *   }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = (process.env.FEDOS_AGENT_API_BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN = process.env.FEDOS_AGENT_TOKEN;

if (!TOKEN || TOKEN.trim().length === 0) {
  // Use stderr so MCP stdio transport (stdout) stays clean.
  process.stderr.write(
    "[fedos-mcp] FEDOS_AGENT_TOKEN is not set. Refusing to start.\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

type AgentResponse<T> = { ok: true; data: T } | { ok: false; error: string; details?: unknown };

type ToolText = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

function textResult(text: string, isError = false): ToolText {
  return { content: [{ type: "text", text }], isError };
}

function jsonResult(value: unknown): ToolText {
  return textResult(JSON.stringify(value, null, 2));
}

async function agentFetch<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<AgentResponse<T>> {
  const url = `${API_BASE}${path}`;
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${TOKEN}`,
  };
  let body: string | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (error) {
    return {
      ok: false,
      error: `Network error calling ${method} ${path}: ${String(error)}`,
    };
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON body — fall through with status
  }

  if (payload && typeof payload === "object" && "ok" in payload) {
    return payload as AgentResponse<T>;
  }

  return {
    ok: false,
    error: `HTTP ${res.status} from ${method} ${path}`,
    details: payload,
  };
}

async function callRead<T>(path: string): Promise<ToolText> {
  const result = await agentFetch<T>(path);
  if (!result.ok) {
    return textResult(`Error: ${result.error}`, true);
  }
  return jsonResult(result.data);
}

async function callWrite<T>(path: string, body: unknown): Promise<ToolText> {
  const result = await agentFetch<T>(path, { method: "POST", body });
  if (!result.ok) {
    // Surface delete-confirmation refusal explicitly so the LLM can decide
    // whether to ask the user before retrying with confirm:true.
    const details = result.details ? `\nDetails: ${JSON.stringify(result.details)}` : "";
    return textResult(`Error: ${result.error}${details}`, true);
  }
  return jsonResult(result.data);
}

// ---------------------------------------------------------------------------
// Server + tools
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "fedos-home-tasks", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

// --- Read tools ------------------------------------------------------------

server.registerTool(
  "fedos_today_tasks",
  {
    title: "Today's tasks",
    description:
      "List FedOS Home durable tasks scheduled for today (active or waiting, due today).",
    inputSchema: {},
  },
  async () => callRead("/api/agent/tasks/today"),
);

server.registerTool(
  "fedos_overdue_tasks",
  {
    title: "Overdue tasks",
    description: "List FedOS Home tasks past their due date that are not done or dropped.",
    inputSchema: {},
  },
  async () => callRead("/api/agent/tasks/overdue"),
);

server.registerTool(
  "fedos_waiting_tasks",
  {
    title: "Waiting tasks",
    description: "List FedOS Home tasks currently in 'waiting' status.",
    inputSchema: {},
  },
  async () => callRead("/api/agent/tasks/waiting"),
);

server.registerTool(
  "fedos_search_tasks",
  {
    title: "Search tasks",
    description:
      "Search FedOS Home tasks by free-text query across title, description, owner, and source_ref.",
    inputSchema: {
      q: z.string().min(1).describe("Search query"),
    },
  },
  async ({ q }) => callRead(`/api/agent/tasks/search?q=${encodeURIComponent(q)}`),
);

server.registerTool(
  "fedos_get_task",
  {
    title: "Get task",
    description: "Fetch a single FedOS Home task by id, including recent events and sources.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
    },
  },
  async ({ id }) => callRead(`/api/agent/tasks/${encodeURIComponent(id)}`),
);

server.registerTool(
  "fedos_task_summary",
  {
    title: "Task summary",
    description:
      "Counts of FedOS Home tasks by status, plus overdue, due today, and recently changed counts.",
    inputSchema: {
      scope: z
        .enum(["today", "week", "all"])
        .optional()
        .describe("Optional scope filter (default: all)"),
    },
  },
  async ({ scope }) => {
    const qs = scope ? `?scope=${scope}` : "";
    return callRead(`/api/agent/tasks/summary${qs}`);
  },
);

server.registerTool(
  "fedos_list_categories",
  {
    title: "List categories",
    description: "List FedOS Home task categories (id, name, slug, color, icon).",
    inputSchema: {},
  },
  async () => callRead("/api/agent/tasks/categories"),
);

// --- Write tools -----------------------------------------------------------

const taskStatusEnum = z.enum(["active", "waiting", "deferred", "done", "dropped"]);
const taskPriorityEnum = z.enum(["low", "medium", "high", "critical"]);
const sourceTypeEnum = z.enum(["manual", "email", "calendar", "message", "llm", "fedos"]);

const createTaskShape = {
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  category_id: z.string().optional(),
  project_id: z.string().optional().nullable(),
  owner: z.string().max(120).optional(),
  due_at: z.string().optional().nullable().describe("ISO datetime or YYYY-MM-DD"),
  source_type: sourceTypeEnum.optional(),
  source_ref: z.string().max(300).optional().nullable(),
  tags: z.array(z.string()).optional(),
};

server.registerTool(
  "fedos_create_task",
  {
    title: "Create task",
    description:
      "Create a new FedOS Home durable task. Only act after Federico explicitly asks for it.",
    inputSchema: createTaskShape,
  },
  async (input) => callWrite("/api/agent/tasks", input),
);

server.registerTool(
  "fedos_update_task",
  {
    title: "Update task",
    description:
      "Update fields on an existing FedOS Home task. Pass only the fields that should change.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
      reason: z.string().max(1000).optional().describe("Optional reason recorded in task event"),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).optional().nullable(),
      status: taskStatusEnum.optional(),
      priority: taskPriorityEnum.optional(),
      category_id: z.string().optional(),
      project_id: z.string().optional().nullable(),
      owner: z.string().max(120).optional(),
      due_at: z.string().optional().nullable().describe("ISO datetime or YYYY-MM-DD"),
      source_type: sourceTypeEnum.optional(),
      source_ref: z.string().max(300).optional().nullable(),
      tags: z.array(z.string()).optional(),
    },
  },
  async ({ id, ...body }) => callWrite(`/api/agent/tasks/${encodeURIComponent(id)}/update`, body),
);

server.registerTool(
  "fedos_complete_task",
  {
    title: "Complete task",
    description: "Mark a FedOS Home task as done.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
      reason: z.string().max(1000).optional(),
    },
  },
  async ({ id, reason }) =>
    callWrite(`/api/agent/tasks/${encodeURIComponent(id)}/complete`, reason ? { reason } : {}),
);

server.registerTool(
  "fedos_add_task_note",
  {
    title: "Add task note",
    description: "Append a note (recorded as a task event) to a FedOS Home task.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
      note: z.string().min(1).max(2000),
    },
  },
  async ({ id, note }) =>
    callWrite(`/api/agent/tasks/${encodeURIComponent(id)}/note`, { note }),
);

server.registerTool(
  "fedos_delete_task",
  {
    title: "Delete task",
    description:
      "Permanently delete a FedOS Home task. Requires confirm=true. Prefer fedos_complete_task or status='dropped' when intent is unclear; ask Federico to confirm before retrying with confirm=true.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
      confirm: z
        .boolean()
        .optional()
        .describe("Must be true. Without it, the server refuses with a confirmation_required signal."),
    },
  },
  async ({ id, confirm }) =>
    callWrite(`/api/agent/tasks/${encodeURIComponent(id)}/delete`, { confirm: confirm === true }),
);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[fedos-mcp] connected. API base: ${API_BASE}. Tools: 12 (7 read, 5 write).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[fedos-mcp] fatal: ${String(error)}\n`);
  process.exit(1);
});

/**
 * POC-02/03/04/05: Local CLI adapter for FedOS Home durable tasks.
 *
 * Gives shell-capable LLM clients (Claude Code, Codex) a safe, typed interface
 * to list, search, create, update, complete, note, and delete tasks — all
 * delegating to existing Home services with no duplicate business logic.
 *
 * Usage:
 *   npm run agent:tasks -- today
 *   npm run agent:tasks -- search "passport"
 *   npm run agent:tasks -- create --json /tmp/task.json
 *   npm run agent:tasks -- complete <id> --reason "done"
 *   npm run agent:tasks -- delete <id> --confirm
 *   npm run agent:tasks -- today --format json
 *
 * See: docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import { format, isToday, isPast } from "date-fns";
import {
  addTaskNote,
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listCategories,
  searchTasks,
  summarizeTasks,
  updateTask,
} from "@/server/tasks";
import { prisma } from "@/lib/prisma";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OutputFormat = "markdown" | "json";

interface CliArgs {
  command: string;
  /** First positional arg after the command — task ID or search query. */
  firstArg?: string;
  jsonPath?: string;
  text?: string;
  reason?: string;
  scope?: string;
  format: OutputFormat;
  confirm: boolean;
}

type TaskRow = Awaited<ReturnType<typeof searchTasks>>[number];
type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTask>>>;

// ---------------------------------------------------------------------------
// Arg parser
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const raw = process.argv.slice(2);
  const args: CliArgs = {
    command: raw[0] ?? "help",
    format: "markdown",
    confirm: false,
  };

  for (let i = 1; i < raw.length; i++) {
    const a = raw[i];
    if (a === "--format" && raw[i + 1]) {
      args.format = raw[++i] as OutputFormat;
    } else if (a === "--json" && raw[i + 1]) {
      args.jsonPath = raw[++i];
    } else if (a === "--text" && raw[i + 1]) {
      args.text = raw[++i];
    } else if (a === "--reason" && raw[i + 1]) {
      args.reason = raw[++i];
    } else if (a === "--scope" && raw[i + 1]) {
      args.scope = raw[++i];
    } else if (a === "--confirm") {
      args.confirm = true;
    } else if (!a.startsWith("--") && args.firstArg === undefined) {
      args.firstArg = a;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "no due date";
  if (isToday(d)) return "due today";
  if (isPast(d)) return `overdue (${format(d, "MMM d")})`;
  return `due ${format(d, "MMM d")}`;
}

function fmtTaskLine(t: TaskRow, i: number): string {
  const tags = t.tags.map((tt) => tt.tag.name).join(", ");
  return (
    `${i + 1}. **[${t.priority}]** ${t.title}` +
    ` — ${t.status}` +
    ` — ${fmtDate(t.due_at)}` +
    (tags ? ` — #${tags}` : "") +
    ` — \`${t.id}\``
  );
}

function fmtTaskDetail(t: TaskDetail): string {
  const tags = t.tags.map((tt) => tt.tag.name).join(", ") || "—";
  const lines = [
    `### ${t.title}`,
    `- **ID**: \`${t.id}\``,
    `- **Status**: ${t.status}`,
    `- **Priority**: ${t.priority}`,
    `- **Due**: ${t.due_at ? format(t.due_at, "yyyy-MM-dd") : "—"}`,
    `- **Category**: ${t.category.name}`,
    `- **Project**: ${t.project?.name ?? "—"}`,
    `- **Owner**: ${t.owner}`,
    `- **Source**: ${t.source_type}${t.source_ref ? ` (${t.source_ref})` : ""}`,
    `- **Tags**: ${tags}`,
  ];
  if (t.description) {
    lines.push("", `> ${t.description.replace(/\n/g, "\n> ")}`);
  }
  return lines.join("\n");
}

function fmtList(tasks: TaskRow[], heading: string): string {
  if (tasks.length === 0) return `No tasks — ${heading.toLowerCase()}.`;
  return `## ${heading} (${tasks.length})\n\n${tasks.map(fmtTaskLine).join("\n")}`;
}

function out(data: unknown, fmt: OutputFormat): string {
  return fmt === "json" ? JSON.stringify(data, null, 2) : String(data);
}

// ---------------------------------------------------------------------------
// POC-02: Read handlers
// ---------------------------------------------------------------------------

async function handleToday(args: CliArgs): Promise<string> {
  const tasks = await searchTasks({ view: "today" });
  if (args.format === "json") return out(tasks, "json");
  return fmtList(tasks, "Today's Tasks");
}

async function handleOverdue(args: CliArgs): Promise<string> {
  const tasks = (await searchTasks({ due: "overdue" })).filter(
    (task) => task.status !== "dropped",
  );
  if (args.format === "json") return out(tasks, "json");
  return fmtList(tasks, "Overdue Tasks");
}

async function handleWaiting(args: CliArgs): Promise<string> {
  const tasks = await searchTasks({ status: "waiting" });
  if (args.format === "json") return out(tasks, "json");
  return fmtList(tasks, "Waiting Tasks");
}

async function handleSearch(args: CliArgs): Promise<string> {
  const q = args.firstArg;
  if (!q) return "Error: provide a search query.\n  Usage: search <query>";
  const tasks = await searchTasks({ q });
  if (args.format === "json") return out(tasks, "json");
  return fmtList(tasks, `Search: "${q}"`);
}

async function handleGet(args: CliArgs): Promise<string> {
  if (!args.firstArg) return "Error: provide a task ID.\n  Usage: get <id>";
  const task = await getTask(args.firstArg);
  if (!task) return `Task not found: ${args.firstArg}`;
  if (args.format === "json") return out(task, "json");
  return fmtTaskDetail(task);
}

async function handleSummary(args: CliArgs): Promise<string> {
  const scope = args.scope ?? "all";
  const summary = await summarizeTasks(scope);
  if (args.format === "json") return out(summary, "json");
  const statusLines = summary.countsByStatus
    .map((s) => `  - ${s.status}: ${s._count}`)
    .join("\n");
  return [
    `## Task Summary (scope: ${scope})`,
    "",
    statusLines || "  - (no tasks)",
    `  - overdue: ${summary.overdue}`,
    `  - due today: ${summary.dueToday}`,
    `  - changed in last 24h: ${summary.recentlyChanged}`,
  ].join("\n");
}

async function handleCategories(args: CliArgs): Promise<string> {
  const cats = await listCategories();
  if (args.format === "json") return out(cats, "json");
  if (cats.length === 0) return "No categories found.";
  return `## Categories\n\n${cats.map((c) => `- **${c.name}** — \`${c.id}\``).join("\n")}`;
}

// ---------------------------------------------------------------------------
// POC-03: Write handlers
// ---------------------------------------------------------------------------

async function handleCreate(args: CliArgs): Promise<string> {
  if (!args.jsonPath) {
    return "Error: --json <path> is required.\n  Usage: create --json <path>";
  }
  const raw = fs.readFileSync(path.resolve(args.jsonPath), "utf-8");
  const input = JSON.parse(raw) as Record<string, unknown>;
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid task JSON: ${JSON.stringify(parsed.error.flatten())}`);
  }
  const task = await createTask(parsed.data, "llm");
  const refreshed = await getTask(task.id);
  const result = refreshed ?? task;
  if (args.format === "json") return out(result, "json");
  return `Created: **${result.title}** — \`${result.id}\``;
}

async function handleUpdate(args: CliArgs): Promise<string> {
  if (!args.firstArg) {
    return "Error: provide a task ID.\n  Usage: update <id> --json <path>";
  }
  if (!args.jsonPath) {
    return "Error: --json <path> is required.\n  Usage: update <id> --json <path>";
  }
  const raw = fs.readFileSync(path.resolve(args.jsonPath), "utf-8");
  const fields = JSON.parse(raw) as Record<string, unknown>;
  const parsed = updateTaskSchema.safeParse(fields);
  if (!parsed.success) {
    throw new Error(`Invalid update JSON: ${JSON.stringify(parsed.error.flatten())}`);
  }
  const task = await updateTask(args.firstArg, parsed.data, "llm", args.reason);
  if (args.format === "json") return out(task, "json");
  return `Updated: **${task.title}** — \`${task.id}\``;
}

async function handleComplete(args: CliArgs): Promise<string> {
  if (!args.firstArg) {
    return "Error: provide a task ID.\n  Usage: complete <id> [--reason <text>]";
  }
  const task = await completeTask(args.firstArg, args.reason, "llm");
  if (args.format === "json") return out(task, "json");
  return `Completed: **${task.title}** — \`${task.id}\``;
}

async function handleNote(args: CliArgs): Promise<string> {
  if (!args.firstArg) {
    return "Error: provide a task ID.\n  Usage: note <id> --text <text>";
  }
  if (!args.text) {
    return "Error: --text <text> is required.\n  Usage: note <id> --text <text>";
  }
  await addTaskNote(args.firstArg, args.text, "llm");
  return `Note added to \`${args.firstArg}\`: "${args.text}"`;
}

// ---------------------------------------------------------------------------
// POC-04: Safe delete with explicit confirmation (disambiguation guardrail)
// ---------------------------------------------------------------------------

async function handleDelete(args: CliArgs): Promise<RunResult> {
  if (!args.firstArg) {
    return { output: "Error: provide a task ID.\n  Usage: delete <id> --confirm", exitCode: 1 };
  }

  // POC-04 safety rule: permanent delete requires explicit --confirm flag.
  // Exit non-zero so automation can detect the refusal. Prefer reversible
  // alternatives and name the task so the user can verify before confirming.
  if (!args.confirm) {
    const task = await getTask(args.firstArg);
    const name = task ? `"${task.title}"` : `task \`${args.firstArg}\``;
    return {
      output: [
        `Refused: permanent delete requires --confirm.`,
        ``,
        `Task: ${name}`,
        ``,
        `Prefer a reversible alternative:`,
        `  npm run agent:tasks -- complete ${args.firstArg} --reason "no longer needed"`,
        ``,
        `To permanently delete (irreversible):`,
        `  npm run agent:tasks -- delete ${args.firstArg} --confirm`,
      ].join("\n"),
      exitCode: 1,
    };
  }

  const task = await getTask(args.firstArg);
  const name = task?.title ?? args.firstArg;
  await deleteTask(args.firstArg);
  return { output: `Deleted: "${name}" (\`${args.firstArg}\`)`, exitCode: 0 };
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function handleHelp(): string {
  return `
FedOS Home — Agent Task CLI
Usage: npm run agent:tasks -- <command> [options]

Read commands:
  today                         Tasks due today
  overdue                       Overdue tasks
  waiting                       Tasks in waiting status
  search <query>                Full-text search
  get <id>                      Task detail
  summary [--scope today|week|all]  Task counts and overview
  categories                    List all categories

Write commands:
  create --json <path>          Create task from JSON file
  update <id> --json <path>     Update task fields from JSON file
  complete <id> [--reason <x>]  Mark task done
  note <id> --text <text>       Add a note
  delete <id> --confirm         Permanently delete (requires --confirm)

Options:
  --format json    Output raw JSON (read commands)
  --confirm        Required for delete
  --reason <text>  Reason string for complete or update
  --scope <s>      Scope for summary: today | week | all
`.trim();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

interface RunResult {
  output: string;
  /** Exit code. Non-zero means the command was intentionally refused or failed. */
  exitCode: number;
}

async function run(): Promise<RunResult> {
  const args = parseArgs();
  switch (args.command) {
    case "today":      return { output: await handleToday(args), exitCode: 0 };
    case "overdue":    return { output: await handleOverdue(args), exitCode: 0 };
    case "waiting":    return { output: await handleWaiting(args), exitCode: 0 };
    case "search":     return { output: await handleSearch(args), exitCode: 0 };
    case "get":        return { output: await handleGet(args), exitCode: 0 };
    case "summary":    return { output: await handleSummary(args), exitCode: 0 };
    case "categories": return { output: await handleCategories(args), exitCode: 0 };
    case "create":     return { output: await handleCreate(args), exitCode: 0 };
    case "update":     return { output: await handleUpdate(args), exitCode: 0 };
    case "complete":   return { output: await handleComplete(args), exitCode: 0 };
    case "note":       return { output: await handleNote(args), exitCode: 0 };
    case "delete":     return handleDelete(args);
    default:           return { output: handleHelp(), exitCode: 0 };
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

run()
  .then(({ output, exitCode }) => {
    console.log(output);
    if (exitCode !== 0) process.exit(exitCode);
  })
  .catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

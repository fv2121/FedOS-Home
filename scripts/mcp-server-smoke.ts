#!/usr/bin/env node
/**
 * POC-06 smoke test for the FedOS Home MCP adapter.
 *
 * Spawns `scripts/mcp-server.ts` over stdio, exchanges JSON-RPC messages,
 * exercises read + write tools end-to-end, and prints PASS/FAIL per step.
 *
 * Not part of the runtime adapter. Lives under `scripts/` purely so the
 * existing tsx tooling can run it without extra config:
 *
 *   FEDOS_AGENT_TOKEN=... FEDOS_AGENT_API_BASE=http://localhost:3030 \
 *     npx tsx scripts/mcp-server-smoke.ts
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

type RpcMessage = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

const TOKEN = process.env.FEDOS_AGENT_TOKEN ?? "poc07-local-dev-token-please-rotate";
const API_BASE = process.env.FEDOS_AGENT_API_BASE ?? "http://localhost:3030";

const child = spawn("npx", ["-y", "tsx", path.resolve("scripts/mcp-server.ts")], {
  env: { ...process.env, FEDOS_AGENT_TOKEN: TOKEN, FEDOS_AGENT_API_BASE: API_BASE },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = "";
const pending = new Map<number, (msg: RpcMessage) => void>();
let nextId = 1;

child.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf8");
  let idx: number;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line) as RpcMessage;
      if (typeof msg.id === "number" && pending.has(msg.id)) {
        pending.get(msg.id)!(msg);
        pending.delete(msg.id);
      }
    } catch {
      // ignore non-JSON output
    }
  }
});

function send(method: string, params?: unknown): Promise<RpcMessage> {
  const id = nextId++;
  const payload: RpcMessage = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify(payload) + "\n", (err) => {
      if (err) reject(err);
    });
    // 10s timeout per call
    delay(10_000).then(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }
    });
  });
}

function notify(method: string, params?: unknown): void {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await send("tools/call", { name, arguments: args });
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  return res.result as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
}

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: string) {
  const tag = cond ? "PASS" : "FAIL";
  if (cond) passed++;
  else failed++;
  console.log(`  ${tag} — ${label}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  // give server a moment to spin up tsx
  await delay(800);

  // 1. initialize
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "poc06-smoke", version: "0.1.0" },
  });
  check("initialize", !init.error);
  notify("notifications/initialized");

  // 2. tools/list
  const listed = await send("tools/list");
  const tools = (listed.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
  const expected = [
    "fedos_today_tasks",
    "fedos_overdue_tasks",
    "fedos_waiting_tasks",
    "fedos_search_tasks",
    "fedos_get_task",
    "fedos_task_summary",
    "fedos_list_categories",
    "fedos_create_task",
    "fedos_update_task",
    "fedos_complete_task",
    "fedos_add_task_note",
    "fedos_delete_task",
  ];
  check("tools/list returns 12 tools", tools.length === 12, `got ${tools.length}`);
  for (const name of expected) check(`tool registered: ${name}`, tools.includes(name));

  // 3. read tools
  const today = await callTool("fedos_today_tasks");
  check("fedos_today_tasks", today.isError !== true);

  const summary = await callTool("fedos_task_summary", { scope: "today" });
  check("fedos_task_summary scope=today", summary.isError !== true);

  const cats = await callTool("fedos_list_categories");
  check("fedos_list_categories", cats.isError !== true);

  // 4. create -> update -> note -> complete -> delete (refused) -> delete (confirmed)
  const created = await callTool("fedos_create_task", {
    title: "POC-06 MCP smoke test",
    priority: "medium",
    tags: ["poc06-mcp-smoke"],
    source_ref: "poc06-mcp-smoke",
  });
  check("fedos_create_task", created.isError !== true);
  const createdData = JSON.parse(created.content[0].text) as { id: string };
  console.log(`  id = ${createdData.id}`);

  const updated = await callTool("fedos_update_task", {
    id: createdData.id,
    priority: "high",
    reason: "poc06 mcp smoke",
  });
  check("fedos_update_task", updated.isError !== true);

  const noted = await callTool("fedos_add_task_note", {
    id: createdData.id,
    note: "poc06 mcp smoke note",
  });
  check("fedos_add_task_note", noted.isError !== true);

  const got = await callTool("fedos_get_task", { id: createdData.id });
  check("fedos_get_task", got.isError !== true);

  const completed = await callTool("fedos_complete_task", {
    id: createdData.id,
    reason: "poc06 mcp smoke done",
  });
  check("fedos_complete_task", completed.isError !== true);

  const refused = await callTool("fedos_delete_task", { id: createdData.id });
  check(
    "fedos_delete_task without confirm refuses (isError + confirmation_required)",
    refused.isError === true && refused.content[0].text.includes("confirmation_required"),
  );

  const deleted = await callTool("fedos_delete_task", {
    id: createdData.id,
    confirm: true,
  });
  check("fedos_delete_task with confirm=true", deleted.isError !== true);

  const afterDelete = await callTool("fedos_get_task", { id: createdData.id });
  check(
    "fedos_get_task after delete is not found",
    afterDelete.isError === true && /not found/i.test(afterDelete.content[0].text),
    afterDelete.content[0]?.text?.slice(0, 80),
  );

  console.log(`\n  Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
  child.kill();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("fatal:", err);
  child.kill();
  process.exit(1);
});

# LLM Agent Durable Task Access PoC

## Status

Standalone technical spike.

Created: 2026-05-13

This document scopes a proof of concept for viewing and managing FedOS Home
durable tasks from LLM-powered desktop or mobile apps. It is intentionally
decoupled from morning briefings, Memory, briefing packages, and proposed
actions.

The immediate question is simple:

> Can Federico open an LLM app, ask "what tasks do I have to do today?", then
> add, edit, complete, or remove tasks by voice or chat, with FedOS Home still
> remaining the canonical durable task database?

## Implementation Tracker

Use this table as the working tracker while implementing the PoC. Build order
is intentionally CLI-first so the task contract is proven before desktop MCP,
remote access, or mobile voice work.

| Order | Item | Status | Build target | Depends on | Outcome |
|---:|---|---|---|---|---|
| 1 | POC-01: Define task access contract | **Done** | Shared contract | Existing task services | Provider-agnostic operation names and request/response shapes |
| 2 | POC-02: Implement read operations | **Done** | Local CLI | POC-01 | `today`, `overdue`, `waiting`, `search`, `get`, and `summary` work |
| 3 | POC-03: Implement write operations | **Done** | Local CLI | POC-01 | `create`, `update`, `complete`, `note`, and guarded `delete` work |
| 4 | POC-04: Add safe disambiguation and confirmation rules | **Done** | Local CLI behavior | POC-02, POC-03 | Ambiguous edits ask for clarification; delete requires confirmation |
| 5 | POC-05: Build first adapter | **Done** | `scripts/agent-tasks.ts` and `npm run agent:tasks` | POC-02, POC-03, POC-04 | Codex/Claude Code can operate tasks through shell commands |
| 6 | POC-08: Chat dry run and voice-readiness review | **Done** | Manual test | POC-05 | One shell-capable chat agent can list, add, edit, complete, and safely handle delete; voice suitability reviewed |
| 7 | POC-07: Add authenticated HTTP adapter for remote clients | **Done** | `/api/agent/tasks/*` (Bearer `$FEDOS_AGENT_TOKEN`) | Validated task contract | Remote clients and future connectors have a viable access path |
| 8 | POC-06: Add MCP adapter for desktop LLM apps | **Done** | `scripts/mcp-server.ts` and `npm run agent:mcp` (calls `/api/agent/tasks/*`) | POC-07 | Claude Desktop-style chat can use native task tools |
| 9 | POC-09: Prepare production-safe remote access | **Done** | Deployment/config/security | POC-07 | Hosted task API is reachable outside the laptop with rotated secrets and explicit exposure rules |
| 10 | POC-10: Add remote MCP connector | Pending | Remote MCP server over HTTP | POC-09 | Claude account-level connector can expose durable-task tools beyond local desktop |
| 11 | POC-11: Validate Claude mobile text chat | Pending | Claude mobile app text chat | POC-10 | Federico can read and mutate tasks from mobile chat |
| 12 | POC-12: Validate Claude mobile voice | Pending | Claude mobile app voice mode | POC-11 | Voice loop is tested live: read, create, edit, complete, guarded delete |
| 13 | POC-13: Decide whether to graduate | Pending | Planning/docs | POC-11 + POC-12 results | Go/no-go decision and migration into main backlog if useful |

## Goal

Give approved LLM clients a safe, model-agnostic way to operate on FedOS Home
tasks.

Target client surfaces:

- Claude Desktop
- Claude Code / Claude Cowork
- Codex
- ChatGPT desktop
- Claude mobile chat and voice
- ChatGPT mobile voice
- future LLM clients that can call a local tool, MCP server, connector, or
  authenticated API

The PoC should prove the task interaction loop first. Morning briefings and
task-aware intelligence can be layered in later.

## Non-Goals

This PoC does not cover:

- morning briefing generation;
- FedOS Memory reads or writes;
- briefing packages;
- proposed actions;
- Outlook, Teams, email, or calendar ingestion;
- autonomous unattended task mutation;
- a second task database.

## Product Boundary

FedOS Home remains the canonical task system.

LLM clients may:
- list and summarize existing tasks;
- search tasks;
- inspect task details and history;
- create tasks after Federico asks for it;
- edit task fields after Federico asks for it;
- mark tasks done;
- add task notes;
- drop or delete tasks with explicit confirmation.

LLM clients must not:
- write directly to Postgres with ad hoc SQL;
- maintain a separate task list outside FedOS Home;
- silently change tasks without an explicit user instruction;
- silently update FedOS Memory;
- perform destructive delete when a safer status change is sufficient.

## Existing Home Capabilities

The PoC should reuse current Home services and avoid duplicating task logic.

- Durable tasks live in `prisma/schema.prisma`.
- Task reads and mutations live in `src/server/tasks/service.ts`.
- Current task API routes exist under `src/app/api/llm/*`.
- Task events already preserve an audit trail for creates, updates,
  completions, and notes.

The gap is a client-agnostic tool contract that works cleanly from LLM desktop
and mobile surfaces.

## Interaction Examples

Voice or chat should support natural requests like:

```text
Tell me the tasks I have to do today.
What is overdue?
Add a task to call Marco tomorrow morning.
Move the passport renewal task to Friday.
Mark the Claude task bridge doc as done.
Change the FedOS deployment task to high priority.
Add a note to the insurance task: waiting for broker reply.
Delete the duplicate task about invoices.
```

The LLM should translate these into narrow task operations, then report the
result in plain language.

## Safety Model

Reads can happen immediately.

Low-risk writes can happen after a clear user instruction:

- create task;
- edit title, description, due date, priority, category, owner, status;
- add note;
- mark done.

Destructive or ambiguous writes require confirmation:

- delete task;
- drop task;
- bulk update;
- changing several fields at once if the target task is unclear;
- acting when multiple matching tasks are found.

For delete-like requests, prefer a reversible task state where possible:

```text
"I found two matching invoice tasks. Which one should I remove?"
"Do you want me to mark it dropped instead of permanently deleting it?"
```

## Provider-Agnostic Task Contract

The bridge should expose intent-level operations, not raw database access.

Required operations:

```text
list_tasks
search_tasks
get_task
create_task
update_task
complete_task
add_task_note
delete_task
summarize_tasks
list_categories
```

Nice-to-have operations:

```text
list_projects
list_tags
set_task_category
bulk_update_tasks
drop_task
restore_recently_deleted_task
```

Avoid exposing:

```text
run arbitrary SQL
update arbitrary table
patch raw Prisma model
write memory files
```

## Access Strategy

Use one shared task capability contract, then expose it through thin adapters.

This is an ordered experiment path, not a recommendation to build all adapters
up front.

Recommended order to try:

1. **Local CLI adapter** for Codex, Claude Code, and other shell-capable agents.
2. **Local MCP adapter** for Claude Desktop and other desktop clients that
   support local tools.
3. **Authenticated HTTP adapter** for remote-safe access beyond the laptop.
4. **Remote MCP connector** for account-level use in clients such as Claude
   mobile, Claude web, and Cowork.

The adapters should delegate to the same Home task services. The CLI, local MCP
server, remote MCP server, and HTTP routes should not each contain separate
business logic.

### Adapter Comparison

| Adapter | Engagement model | Best for | Cost | Strengths | Limits | PoC role |
|---|---|---|---:|---|---|---|
| Local CLI | Federico or a shell-capable agent runs commands in the FedOS Home workspace, for example `npm run agent:tasks -- today`. In Codex or Claude Code, Federico can ask the agent in chat and the agent runs the command behind the scenes. | Codex, Claude Code, local shell agents | Lowest | Fastest to build; no new server surface; direct access to local env and Prisma; easy to debug | Not natural for Claude Desktop or mobile voice; depends on local machine and shell access | Prove task contract and service behavior first |
| Local MCP | Federico chats with a desktop LLM app. The app sees FedOS task tools and asks to use them when needed, for example after "What tasks do I have today?" or "Move this task to Friday." | Claude Desktop, Claude Code, desktop agent clients | Low to medium | Native tool UX in supporting desktop clients; reusable across MCP-capable apps; good bridge from chat to local tools | Local-only; does not make tools available to Claude mobile, Cowork, or claude.ai; write-tool safety must be designed carefully | Prove chat-native desktop task control |
| Authenticated HTTP | Federico uses a client or connector that cannot run local shell tools. The client calls FedOS task endpoints through authenticated API requests after Federico asks in chat or voice. | Remote clients, custom connectors, future mobile adapters | Medium to high | Works beyond local shell; strongest separation from database; reusable by multiple remote adapters | Requires auth, deployment, network reachability, rate limits, and stronger security posture; a plain HTTP API is not by itself a native LLM tool interface | Prove remote-safe task access |
| Remote MCP | Federico connects an account-level remote MCP connector once, then uses the exposed FedOS tools from supported remote LLM surfaces. | Claude web, Claude mobile, Cowork, remote connector clients | Highest | Native tool UX beyond one local machine; strongest path toward mobile chat and voice testing; can wrap the same HTTP contract | Requires public reachability, hosted auth, connector setup, and client-specific validation; voice support must be tested live | Prove cross-device LLM access |

### Decision Rule

Build the smallest adapter that answers the next question:

- Start with CLI to prove the task operations are correct.
- Move to local MCP if the main question is "Can I use this naturally from a
  desktop LLM app?"
- Move to HTTP if the main question is "Can this be reached safely beyond the
  local machine?"
- Move to remote MCP if the main question is "Can I use this from mobile,
  Cowork, or another non-local LLM surface?"

The shared task contract should stay stable across all four. If the CLI command
is `today`, the local MCP tool, remote MCP tool, and HTTP endpoint should
represent the same operation rather than inventing a new behavior.

## Local Versus Production

The current CLI adapter writes to whichever database is configured by
`DATABASE_URL` in the environment where the command runs.

Current state:

- Local CLI on Federico's Mac updates the local database configured in local
  `.env`.
- It does not automatically update the Railway/production database.
- The same service-layer code can operate on production if the command runs
  with the production `DATABASE_URL`, but that should be treated as a separate
  access mode with stronger safeguards.

Production options:

| Option | How it works | Best for | Risk / tradeoff |
|---|---|---|---|
| Run CLI against production DB | Run `npm run agent:tasks` with production `DATABASE_URL` loaded locally or in a one-off Railway shell/job | Admin-only maintenance and quick validation | Easy to make real production mutations from a terminal; requires careful env handling |
| Deploy HTTP agent API | Add authenticated `/api/agent/tasks/*` endpoints to the production Home app | ChatGPT mobile, remote clients, future voice flow | Requires bearer token/OAuth, rate limiting, audit posture, and deployment hardening |
| MCP backed by production API | Desktop MCP tools call the authenticated production API instead of direct DB | Claude Desktop with production tasks | More moving pieces than CLI, but safer than giving desktop tools direct DB credentials |

Recommended production path:

1. Keep the CLI as the local/dev proof and admin tool.
2. Do not give general LLM clients direct production DB credentials.
3. For production task access from desktop/mobile apps, build the authenticated
   HTTP adapter and have MCP/connectors call that API.
4. Reserve "CLI against production DB" for explicit admin runs, with clear
   confirmation and ideally read-only testing first.

## Local Command Contract

Recommended command:

```bash
npm run agent:tasks -- today
npm run agent:tasks -- overdue
npm run agent:tasks -- search "passport"
npm run agent:tasks -- create --json ./task.json
npm run agent:tasks -- update <taskId> --json ./task-update.json
npm run agent:tasks -- complete <taskId> --reason "Finished from voice session"
npm run agent:tasks -- note <taskId> --text "Waiting for broker reply"
npm run agent:tasks -- delete <taskId> --confirm
```

Default output should be concise markdown for chat readability. JSON should be
available for automation:

```bash
npm run agent:tasks -- today --format json
```

### Can Mobile Apps Run The CLI?

Not directly.

A normal mobile LLM app does not have shell access to Federico's Mac, so it
cannot simply run `npm run agent:tasks -- today` against the local FedOS Home
workspace.

Mobile access needs an intermediary:

- a desktop companion agent that is online and allowed to run the CLI;
- a remote MCP connector exposed through a client that supports cross-device
  tools;
- an authenticated HTTP/API adapter that the mobile app can call;
- a custom connector/action that talks to that authenticated API.

For this reason, CLI is best treated as the fastest desktop-local proof of the
task contract. It proves the operation shape, but it is not by itself the final
mobile voice solution.

## HTTP/Mobile Contract

Mobile clients cannot reliably run a local shell command. To support mobile
chat or voice, the same task operations eventually need an authenticated HTTP
layer plus a connector-facing wrapper.

Recommended PoC endpoint shape:

```text
GET  /api/agent/tasks/today
GET  /api/agent/tasks/search?q=passport
GET  /api/agent/tasks/:id
POST /api/agent/tasks
POST /api/agent/tasks/:id/update
POST /api/agent/tasks/:id/complete
POST /api/agent/tasks/:id/note
POST /api/agent/tasks/:id/delete
```

Authentication should be separate from browser cookies, for example:

```text
Authorization: Bearer $FEDOS_AGENT_TOKEN
```

For the PoC, limit token scope to task operations only.

## Voice UX Rules

The ideal voice loop should feel like this:

```text
Federico: What tasks do I have today?
Agent: You have three. First, finish the task access PoC doc. Second...

Federico: Move the PoC doc task to tomorrow and make it high priority.
Agent: Done. I moved "LLM agent durable task access PoC" to tomorrow and set
priority to high.

Federico: Delete the duplicate insurance one.
Agent: I found two insurance tasks. Do you mean "Renew insurance paperwork" or
"Send broker missing documents"?
```

Rules:

- keep readouts short by default;
- ask if the user wants more detail;
- name the task being changed before or after the update;
- disambiguate when more than one task matches;
- confirm before destructive delete;
- prefer "done" or "dropped" over permanent delete when intent is unclear.

## Data Shape

Create task input should match the existing Home task schema:

```json
{
  "title": "Call Marco",
  "description": "Follow up on the contract timeline.",
  "priority": "medium",
  "status": "active",
  "due_at": "2026-05-14",
  "source_type": "llm",
  "source_ref": "chatgpt-mobile-voice",
  "tags": ["voice"]
}
```

Update input should accept partial task fields:

```json
{
  "due_at": "2026-05-15",
  "priority": "high"
}
```

Client metadata should be optional:

```json
{
  "client": "chatgpt-mobile",
  "session_ref": "voice-task-update-2026-05-13",
  "approval_ref": "Federico requested this by voice"
}
```

Initial allowed client labels:

- `claude-desktop`
- `claude-code`
- `claude-cowork`
- `codex`
- `chatgpt-desktop`
- `chatgpt-mobile`
- `local-agent`
- `other`

## Backlog

### Claude Code Build Handoff

This backlog is ready to hand to Claude Code if the first implementation slice
is constrained to the local CLI adapter.

Build now:

- `POC-01`: define the task access contract in code.
- `POC-02`: implement read operations.
- `POC-03`: implement write operations.
- `POC-04`: add disambiguation and confirmation rules where they affect CLI
  behavior.
- `POC-05`: build the first adapter as a local CLI.
- `POC-08`: run the chat dry-run and voice-readiness review manually through
  the CLI.

Defer beyond the first CLI slice:

- `POC-07`: authenticated HTTP adapter.
- `POC-06`: local MCP adapter.
- `POC-09` through `POC-13`: production remote access, remote MCP, mobile
  validation, and graduation decision.

Suggested implementation prompt:

```md
Implement the first slice of `docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md`.

Scope this build to the local CLI adapter only. Do not build MCP or HTTP yet.

Create `scripts/agent-tasks.ts` and add `npm run agent:tasks`.

The CLI should support:
- `today`
- `overdue`
- `waiting`
- `search <query>`
- `summary [--scope today|week|all]`
- `get <taskId>`
- `create --json <path>`
- `update <taskId> --json <path>`
- `complete <taskId> [--reason <text>]`
- `note <taskId> --text <text>`
- `delete <taskId> --confirm`

Default output should be concise markdown. Add `--format json` for read
commands where practical.

Use existing server services from `src/server/tasks`. Do not write raw SQL. Do
not add new database tables. Preserve task event history by using existing
mutation services.

After implementation, verify:
- today's tasks can be listed;
- overdue tasks can be listed;
- a task can be created from JSON;
- that task can be updated;
- a note can be added;
- the task can be completed;
- delete refuses to run unless `--confirm` is passed.
```

Definition of done for the first slice:

- `npm run agent:tasks -- today` returns a readable task list.
- `npm run agent:tasks -- search "some query"` finds matching tasks.
- `npm run agent:tasks -- create --json ./tmp-task.json` creates a Home task.
- `npm run agent:tasks -- update <taskId> --json ./tmp-update.json` updates the
  task through the service layer.
- `npm run agent:tasks -- complete <taskId> --reason "testing"` marks it done.
- `npm run agent:tasks -- delete <taskId>` refuses without `--confirm`.
- The Home UI reflects the changes.
- No MCP, HTTP, schema, or Memory changes are included in this slice.

### POC-01: Define task access contract

Status: Done

Scope:
- Define provider-agnostic operations for read, create, update, complete, note,
  and delete.
- Map each operation to existing Home task service functions.
- Define common request and response shapes.

Acceptance criteria:
- The contract does not mention morning briefings.
- The contract is usable from CLI, MCP, or HTTP adapters.
- The contract exposes task intent operations, not database primitives.

### POC-02: Implement read operations

Status: Done

Scope:
- Support today, overdue, waiting, search, task detail, and task summary.
- Return compact markdown by default.
- Return JSON when requested.

Acceptance criteria:
- "What tasks do I have today?" can be answered from durable Home tasks.
- Search can find likely matches for natural voice references.
- Results include enough identifiers for follow-up edits without exposing
  unnecessary database detail.

### POC-03: Implement write operations

Status: Done

Scope:
- Support create, update, complete, add note, and delete.
- Validate with existing schemas where possible.
- Write through existing Home services so task events are preserved.
- Include actor and optional client metadata.

Acceptance criteria:
- An LLM client can add a task.
- An LLM client can edit due date, title, description, priority, status, owner,
  category, and project where supported.
- An LLM client can mark a task done.
- An LLM client can add a note.
- A task event is created for every mutation.

### POC-04: Add safe disambiguation and confirmation rules

Status: Done

Scope:
- Document how agents should handle multiple task matches.
- Require confirmation for destructive delete and bulk edits.
- Prefer reversible status changes when intent is unclear.

Acceptance criteria:
- The runbook tells agents when to ask a follow-up question.
- Delete is not performed from a vague voice command.
- The user can still move quickly for clear low-risk edits.

### POC-05: Build first adapter

Status: Done

Scope:
- Implement the quickest useful adapter, likely local CLI for Codex and Claude
  Code.
- Keep the adapter thin and service-backed.
- Use the same contract names intended for MCP and HTTP.

Acceptance criteria:
- A shell-capable LLM client can list today's tasks and create/update/complete
  a task.
- The adapter produces voice/chat-friendly summaries.
- No business logic is duplicated outside the task service layer.

### POC-07: Add authenticated HTTP adapter for remote clients

Status: Done

Scope:
- Expose selected task operations through agent-safe HTTP endpoints.
- Authenticate with a bearer token or equivalent connector-safe mechanism.
- Keep token scope limited to task operations.
- Reuse existing `src/server/tasks` services and existing validators.
- Keep browser cookie auth unchanged.
- Treat this as the production-safe access layer that future MCP/connectors can
  call.

First HTTP milestone:

Read endpoints:

```text
GET /api/agent/tasks/today
GET /api/agent/tasks/overdue
GET /api/agent/tasks/waiting
GET /api/agent/tasks/search?q=<query>
GET /api/agent/tasks/:id
GET /api/agent/tasks/summary?scope=today|week|all
GET /api/agent/tasks/categories
```

Write endpoints:

```text
POST /api/agent/tasks
POST /api/agent/tasks/:id/update
POST /api/agent/tasks/:id/complete
POST /api/agent/tasks/:id/note
POST /api/agent/tasks/:id/delete
```

Authentication:

```text
Authorization: Bearer $FEDOS_AGENT_TOKEN
```

Safety rules:

- Missing or invalid token returns `401`.
- Write endpoints require JSON bodies.
- Delete requires an explicit confirmation field, for example
  `{ "confirm": true }`; otherwise it returns a refusal with a non-2xx status.
- Mutations use actor `llm`.
- The API returns concise JSON suitable for connectors and mobile clients.

Suggested implementation prompt:

```md
Implement POC-07 from `docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md`.

Build only the authenticated HTTP adapter. Do not build MCP yet.

Add a small agent auth helper that checks:
`Authorization: Bearer $FEDOS_AGENT_TOKEN`

Add `/api/agent/tasks/*` routes for today, overdue, waiting, search, get,
summary, categories, create, update, complete, note, and delete.

Reuse `src/server/tasks` service functions and existing validators. Do not
write raw SQL. Do not add new database tables. Keep existing browser cookie
auth unchanged.

Delete must refuse unless the request body includes `{ "confirm": true }`.

After implementation, verify authorized and unauthorized reads, authorized
create/update/note/complete/delete, and delete refusal without confirmation.
```

Acceptance criteria:
- A non-shell client can read and mutate tasks.
- ChatGPT desktop/mobile has a plausible integration path.
- Existing browser cookie auth remains unchanged.
- Unauthorized requests are rejected.
- Delete refusal is machine-detectable.
- HTTP results match the already-validated CLI contract.

#### POC-07 Results

Executed: 2026-05-14
Adapter: Authenticated HTTP (`/api/agent/tasks/*`)
Auth: `Authorization: Bearer $FEDOS_AGENT_TOKEN`

**Implementation**

- `src/lib/agent-auth.ts` — bearer-token check using `timingSafeEqual`.
- `src/lib/agent-route-helpers.ts` — `requireAgentAuth` / `requireAgentJson`
  mirroring the existing `route-helpers` shape.
- `src/proxy.ts` — `/api/agent` added to `PUBLIC_PATHS` so the bearer check in
  the route handlers is the sole gate; browser cookie auth on `/api/llm/*` and
  the rest of the app is unchanged.
- Routes under `src/app/api/agent/tasks/` cover today, overdue, waiting,
  search, summary, categories, get, list, create, update, complete, note, and
  delete. All handlers delegate to `src/server/tasks` services with no
  duplicated business logic.
- Delete refuses without `{ "confirm": true }` and returns HTTP 409 with
  `details.refusal = "confirmation_required"` so non-shell clients can
  detect the guardrail.
- Local config: `FEDOS_AGENT_TOKEN` added to `.env`. Production deployments
  must set this via Railway secrets and rotate before exposing publicly.

**Step results**

| Step | Request | Result |
|---:|---|---|
| 0 | `GET /today` no token | PASS — 401 |
| 0 | `GET /today` bad token | PASS — 401 |
| 1 | `GET /today` | PASS — 200 |
| 2 | `GET /overdue` | PASS — 200 |
| 3 | `GET /waiting` | PASS — 200 |
| 4 | `GET /search` no `q` | PASS — 400 |
| 5 | `GET /search?q=a` | PASS — 200 |
| 6 | `GET /summary?scope=today` | PASS — 200 |
| 7 | `GET /categories` | PASS — 200 |
| 8 | `POST /` (create) | PASS — 201, id returned |
| 9 | `POST /:id/update` | PASS — 200, priority + reason recorded |
| 10 | `POST /:id/note` | PASS — 200, note event written |
| 11 | `GET /:id` | PASS — 200 |
| 12 | `POST /:id/complete` | PASS — 200, task closed |
| 13 | `POST /:id/delete` no `confirm` | PASS — 409 with refusal payload |
| 14 | `POST /:id/delete` `{confirm:true}` | PASS — 200 |
| 15 | `GET /:id` after delete | PASS — 404 |

**All 16 checks passed. No persistent test task left behind.**

**Verdict**

The HTTP adapter is a working proof of mobile/remote task access. ChatGPT
mobile, ChatGPT desktop, and any custom-connector client can now read and
mutate FedOS Home tasks behind a single bearer token without going through the
browser session. The same task contract continues to back the CLI adapter, so
behavior is consistent across surfaces.

Recommended next step: POC-06 (MCP adapter) wired to call this HTTP API rather
than accessing the database directly.

### POC-06: Add MCP adapter for desktop LLM apps

Status: Done

Scope:
- Expose the same operations as MCP tools.
- Target Claude Desktop first if practical.
- Prefer MCP tools that call the authenticated HTTP API instead of direct DB
  credentials.
- Keep MCP as a thin wrapper over the shared task contract.

First MCP milestone:

Read tools:

```text
fedos_today_tasks
fedos_overdue_tasks
fedos_waiting_tasks
fedos_search_tasks
fedos_get_task
fedos_task_summary
fedos_list_categories
```

Write tools:

```text
fedos_create_task
fedos_update_task
fedos_complete_task
fedos_add_task_note
fedos_delete_task
```

Implementation rules:

- MCP tools call `/api/agent/tasks/*`; they do not import Prisma or
  `src/server/tasks` directly.
- MCP reads and writes use `FEDOS_AGENT_TOKEN` through the HTTP bearer auth
  layer.
- Tool input schemas should be short and LLM-friendly.
- Delete requires `confirm: true`, mirroring the HTTP API.
- Tool outputs should be concise enough for Claude Desktop chat.

Suggested implementation prompt:

```md
Implement POC-06 from `docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md`.

Build an MCP adapter for desktop LLM apps, targeting Claude Desktop first.

The MCP tools must call the authenticated HTTP API under `/api/agent/tasks/*`.
Do not import Prisma. Do not import `src/server/tasks`. Do not write raw SQL.
Do not create a separate task implementation.

Use `FEDOS_AGENT_TOKEN` for bearer auth when calling the local Home API.

Start with read tools:
- `fedos_today_tasks`
- `fedos_overdue_tasks`
- `fedos_waiting_tasks`
- `fedos_search_tasks`
- `fedos_get_task`
- `fedos_task_summary`
- `fedos_list_categories`

Then add write tools:
- `fedos_create_task`
- `fedos_update_task`
- `fedos_complete_task`
- `fedos_add_task_note`
- `fedos_delete_task`

Delete must require `confirm: true`.

After implementation, verify Claude Desktop or a local MCP inspector can:
- list today's tasks;
- search tasks;
- get one task;
- create a temporary task;
- update it;
- add a note;
- complete it;
- refuse delete without confirmation;
- delete with confirmation;
- confirm cleanup.
```

Acceptance criteria:
- Claude Desktop can read and mutate FedOS Home tasks through tools.
- Tool results match HTTP/CLI behavior.
- MCP does not become a separate task implementation.
- MCP can be pointed at local Home first, then production Home later by changing
  the API base URL and token.

#### POC-06 Results

Executed: 2026-05-14
Adapter: MCP stdio server (`scripts/mcp-server.ts`, `npm run agent:mcp`)
Transport: `@modelcontextprotocol/sdk` `StdioServerTransport`
Backend: HTTP fetch to `/api/agent/tasks/*` with `Authorization: Bearer $FEDOS_AGENT_TOKEN`

**Implementation**

- `scripts/mcp-server.ts` — `McpServer` registering 12 tools (7 read, 5 write).
  Tools call the authenticated HTTP adapter from POC-07. The script does **not**
  import Prisma or `src/server/tasks` and contains no task business logic.
- Errors from the HTTP layer (including the delete `confirmation_required`
  refusal) are surfaced as `isError: true` tool results so the LLM client can
  reason about them.
- `scripts/mcp-server-smoke.ts` — local stdio JSON-RPC harness that drives
  `initialize`, `tools/list`, and a full create→update→note→get→complete→
  delete-refusal→delete-confirm→404 round trip.
- `package.json` — added `npm run agent:mcp`.
- Env contract: `FEDOS_AGENT_TOKEN` (required), `FEDOS_AGENT_API_BASE`
  (optional, default `http://localhost:3000`). Pointing at production is a one
  variable change.

**Tool surface**

Read: `fedos_today_tasks`, `fedos_overdue_tasks`, `fedos_waiting_tasks`,
`fedos_search_tasks`, `fedos_get_task`, `fedos_task_summary`,
`fedos_list_categories`.

Write: `fedos_create_task`, `fedos_update_task`, `fedos_complete_task`,
`fedos_add_task_note`, `fedos_delete_task` (requires `confirm: true`).

**Step results** (smoke harness, 25 checks)

| Step | Check | Result |
|---:|---|---|
| 0 | `initialize` | PASS |
| 1 | `tools/list` returns 12 tools | PASS |
| 2 | All 12 expected tool names registered | PASS (×12) |
| 3 | `fedos_today_tasks` | PASS |
| 4 | `fedos_task_summary` `scope=today` | PASS |
| 5 | `fedos_list_categories` | PASS |
| 6 | `fedos_create_task` | PASS — id returned |
| 7 | `fedos_update_task` `priority=high`, reason | PASS |
| 8 | `fedos_add_task_note` | PASS |
| 9 | `fedos_get_task` | PASS |
| 10 | `fedos_complete_task` | PASS |
| 11 | `fedos_delete_task` no `confirm` | PASS — `isError`, `confirmation_required` in payload |
| 12 | `fedos_delete_task` `confirm=true` | PASS |
| 13 | `fedos_get_task` after delete | PASS — Task not found |

**All 25 checks passed. No persistent test task left behind.**

**Claude Desktop wiring**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "fedos-home": {
      "command": "npx",
      "args": ["-y", "tsx", "/Users/federico_valori/Documents/FedOS-Home/scripts/mcp-server.ts"],
      "env": {
        "FEDOS_AGENT_TOKEN": "<your token>",
        "FEDOS_AGENT_API_BASE": "http://localhost:3000"
      }
    }
  }
}
```

The Home dev/prod server at `FEDOS_AGENT_API_BASE` must be running. To point
at production, change the URL and use the production token.

**Verdict**

MCP adapter is a working proof of native desktop tool UX. Claude Desktop (or
any MCP-capable local desktop client) can now operate FedOS Home tasks through
12 typed tools backed by the same authenticated HTTP contract validated in
POC-07. The shared task contract is now exercised across three surfaces (CLI,
HTTP, local MCP).

Recommended next step: POC-09 production-safe remote access, followed by
POC-10 remote MCP connector work for mobile-capable Claude surfaces.

### POC-08: Chat dry run and voice-readiness review

Status: Done

Scope:
- Use one shell-capable LLM chat client to ask for today's tasks.
- Add one task.
- Edit one task.
- Mark one task done.
- Attempt one ambiguous delete and verify the agent asks for clarification.
- Review whether the resulting chat output is short and clear enough for a
  future voice interface.

Acceptance criteria:
- The full task loop works without opening the Home UI.
- The Home UI reflects the changes.
- The chat interaction works end-to-end.
- Voice suitability is reviewed, but true mobile voice execution is not part of
  this PoC.
- Any awkward phrasing or confirmation friction is recorded.

#### POC-08 Dry-Run Brief

Purpose:

Validate that a shell-capable LLM client can use the FedOS Home task CLI as a
chat-like task assistant. This does not prove ChatGPT mobile voice or Claude
mobile access; those need remote-safe API access and a mobile-capable connector
in later slices.

Current readiness:

- Ready for Codex, Claude Code, Claude Cowork, or a terminal session.
- Not yet ready for ChatGPT mobile voice or Claude mobile, because those need
  remote-safe API access and a mobile-capable connector.

Recommended test prompt for Codex or Claude Code:

```md
Use the FedOS Home agent task CLI to run POC-08 from
`docs/LLM_AGENT_DURABLE_TASK_ACCESS_POC.md`.

Stay inside `/Users/federico_valori/Documents/FedOS-Home`.

First, answer: "What tasks do I have today?" by running:

`npm run agent:tasks -- today`

Then perform a temporary end-to-end task test:

1. Create a clearly marked temporary task.
2. Verify it appears in today's tasks or search results.
3. Update the task priority or description.
4. Add a note.
5. Mark it complete.
6. Try deleting it without `--confirm` and confirm the CLI refuses.
7. Delete it with `--confirm` to clean up.
8. Confirm it no longer appears.

Use only `npm run agent:tasks`. Do not write raw SQL. Do not create MCP or HTTP
work in this test.

After the run, summarize:
- commands used;
- whether each step passed;
- any friction in the chat/voice experience;
- whether the CLI output is concise enough for voice.
```

Manual command checklist:

```bash
npm run agent:tasks -- today
npm run agent:tasks -- create --json /private/tmp/fedos-agent-task-create.json
npm run agent:tasks -- search "Agent CLI acceptance"
npm run agent:tasks -- update <taskId> --json /private/tmp/fedos-agent-task-update.json --reason "POC-08 dry run"
npm run agent:tasks -- note <taskId> --text "POC-08 dry-run note."
npm run agent:tasks -- complete <taskId> --reason "POC-08 dry run complete"
npm run agent:tasks -- delete <taskId>
npm run agent:tasks -- delete <taskId> --confirm
npm run agent:tasks -- get <taskId>
```

Pass criteria:

- The LLM client can answer today's tasks without opening the Home UI.
- The LLM client can create, update, note, complete, and clean up a test task.
- Delete refuses without `--confirm`.
- The final response is understandable as a voice/chat summary.
- No persistent test task is left behind.

#### POC-08 Results

Executed: 2026-05-13  
Client: Claude Code (claude-sonnet-4-6)  
Adapter: Local CLI (`npm run agent:tasks`)

**Step results**

| Step | Command | Result |
|---:|---|---|
| 0 | `today` | PASS — 1 task listed ("speak to Anastasia re presale in WCA") |
| 1 | `create --json` | PASS — task created, ID returned immediately |
| 2 | `search "Agent CLI acceptance"` | PASS — 1 result, correct task |
| 3 | `update <id> --json --reason` | PASS — priority updated to high, reason recorded in event |
| 4 | `note <id> --text` | PASS — note written to task_events |
| 5 | `complete <id> --reason` | PASS — task marked done, event trail preserved |
| 6 | `delete <id>` (no --confirm) | PASS — refused with advisory, exit code 1 |
| 7 | `delete <id> --confirm` | PASS — task permanently removed |
| 8 | `get <id>` | PASS — "Task not found" confirms clean removal |

**All 9 steps passed. No persistent test task left behind.**

**Output quality and voice-readiness observations**

- Task lines (`[priority] title — status — due — #tags — id`) are readable as
  a voice/chat summary at typical list lengths (< 10 items).
- For longer lists the priority bracket and trailing ID would need to be
  suppressed for voice. At < 5 tasks the format works well spoken aloud.
- The delete refusal message is too long for voice (7 lines). Fine for chat;
  for voice a single sentence ("I need you to confirm before deleting") would
  be better. Not blocking — voice clients can paraphrase.
- `--reason` text is passed verbatim on command line, which means multi-word
  reasons need quoting. If the shell splits an unquoted reason into several
  args, only the first word is captured. A future adapter (MCP/HTTP) passes
  structured JSON and avoids this entirely.

**Fixes applied during this run**

- `delete` without `--confirm` now exits with code 1 (was 0). Automation and
  pipelines can reliably detect the refusal via exit code.

**Verdict**

The CLI adapter is a working proof of the task contract. Claude Code can
operate FedOS Home tasks end-to-end from chat without opening the UI.
POC-08 validated chat-driven task control and reviewed voice suitability; it
did not validate true mobile voice execution.
POC-06 has since validated Claude Desktop-style native tool UX over the
authenticated HTTP API. Recommended next step: POC-09 production-safe remote
access, then POC-10 remote MCP connector work.

### POC-09: Prepare production-safe remote access

Status: Done

Scope:
- Point the authenticated task API at the real production task database.
- Rotate the local development bearer token before any external exposure.
- Decide the deployment shape for the remote entrypoint and document the
  minimum network/security posture.
- Verify the production API from outside the laptop using the same read/write
  smoke contract already proven locally.

Acceptance criteria:
- Production-backed task reads and writes succeed through the authenticated API.
- Local-only assumptions are removed from the deployment path.
- Secret handling, URL base, and exposure boundaries are documented.
- The next adapter can target a stable production API without code changes.

#### POC-09 Results

Executed: 2026-05-15
Target: Railway production deployment

**Implementation**

- `src/proxy.ts` — Confirmed as the active middleware in Next.js 16. The build
  output lists it as `ƒ Proxy (Middleware)`. No `src/middleware.ts` is needed
  or permitted; the P2 backlog item noting "proxy.ts is never wired as
  middleware" was based on an older Next.js convention and is superseded.
- `src/lib/rate-limit.ts` — Added `createRateLimiter(maxAttempts, windowMs)`
  factory so non-login surfaces can have independent rate-limit configs without
  changing the existing login limiter.
- `src/lib/agent-route-helpers.ts` — `requireAgentAuth` (read routes) and
  `requireAgentJson` (write routes) now enforce per-IP rate limits: 200 reads
  per 5 minutes, 60 writes per 5 minutes. No individual route files changed.

**Production deployment checklist**

1. Generate a strong bearer token for production (never reuse the local dev
   token):
   ```bash
   node -e "console.log(require('crypto').randomBytes(40).toString('hex'))"
   ```

2. Set `FEDOS_AGENT_TOKEN` in Railway environment variables with the generated
   value. Rotate the local `.env` token to a different value so local and
   production tokens are distinct.

3. The Railway app already has `DATABASE_URL` pointing to the production
   Postgres instance. No code change is needed — the same agent routes work
   against the production database automatically.

4. The Railway deployment URL (e.g. `https://your-app.up.railway.app`) is the
   production `FEDOS_AGENT_API_BASE`. Update this in the Claude Desktop MCP
   config:
   ```json
   {
     "mcpServers": {
       "fedos-home": {
         "command": "npx",
         "args": ["-y", "tsx", "/Users/federico_valori/Documents/FedOS-Home/scripts/mcp-server.ts"],
         "env": {
           "FEDOS_AGENT_TOKEN": "<production token>",
           "FEDOS_AGENT_API_BASE": "https://your-app.up.railway.app"
         }
       }
     }
   }
   ```

5. Smoke-test from outside the laptop before handing the URL to any connector:
   ```bash
   PROD=https://your-app.up.railway.app
   TOKEN=<production token>
   # Read smoke
   curl -sf -H "Authorization: Bearer $TOKEN" "$PROD/api/agent/tasks/today" | jq .ok
   # Auth guard
   curl -o /dev/null -sw "%{http_code}\n" "$PROD/api/agent/tasks/today"
   # Session-protected page guard (should redirect to /login, not return HTML)
   curl -o /dev/null -sw "%{http_code}\n" "$PROD/"
   ```

**Exposure boundary**

- `/api/agent/tasks/*` — bearer-token gated, rate-limited, intentionally
  public at the network level. Any client that has `FEDOS_AGENT_TOKEN` can
  reach these endpoints.
- All other pages and routes — session-cookie gated by the now-wired middleware.
  Unauthenticated requests redirect to `/login` (pages) or return 401 (API).
- No route exposes raw SQL, Prisma internals, or Memory files.
- Write operations still require `{ "confirm": true }` for delete.

**Verdict**

The production deployment is ready for remote agent access. The auth boundary
is now enforced at both the session (middleware) and bearer-token (route
handler) layers. Token rotation and the production URL swap in the MCP config
are the only manual steps before POC-10 remote MCP connector work.

Recommended next step: POC-10 remote MCP connector over HTTP, pointing at the
production Railway URL.

### POC-10: Add remote MCP connector

Status: Pending

Scope:
- Build a remote MCP server that exposes the same durable-task tool contract
  over a network transport suitable for remote connectors.
- Keep the remote MCP layer thin: it should call the authenticated HTTP adapter
  rather than reimplement task logic or touch Prisma directly.
- Add the connector to the Claude account through the remote connector flow.

Acceptance criteria:
- Remote MCP exposes the same core task tools as local MCP.
- The connector can be enabled in a Claude conversation outside local desktop.
- Read/write behavior matches CLI, HTTP, and local MCP.
- Delete still requires explicit confirmation.

### POC-11: Validate Claude mobile text chat

Status: Pending

Scope:
- Use the Claude mobile app in a normal text conversation with the remote
  connector enabled.
- Ask for today's tasks.
- Create, update, complete, and safely delete one temporary task.

Acceptance criteria:
- Mobile text chat can complete the full task loop without the Home UI.
- Task changes are reflected in the canonical durable task database.
- Any mobile-specific friction is recorded.

### POC-12: Validate Claude mobile voice

Status: Pending

Scope:
- Repeat the durable-task loop from Claude mobile voice mode.
- Measure whether spoken prompts and responses remain short, clear, and safe.
- Record where the voice flow differs from text chat, especially around task
  disambiguation and delete confirmation.

Acceptance criteria:
- Voice can read today's tasks.
- Voice can create, update, complete, and delete a temporary task with explicit
  confirmation.
- The spoken interaction is understandable without looking at the screen for
  the core loop.
- Any tool-availability or UX limitation is documented as a live finding rather
  than assumed away.

### POC-13: Decide whether to graduate

Status: Pending

Scope:
- Decide whether the remote path is useful enough to keep.
- Decide whether mobile text is sufficient if voice has product limitations.
- Decide whether this belongs in the main FedOS Home backlog.

Acceptance criteria:
- Clear go/no-go decision.
- If go, migrate successful items into `docs/BACKLOG.md`.
- If no-go, archive this PoC with learnings.

## Implementation Notes

Recommended script location for the first adapter:

```text
scripts/agent-tasks.ts
```

Recommended package script:

```json
{
  "agent:tasks": "tsx scripts/agent-tasks.ts"
}
```

The script should load the same environment used by the app, especially
`DATABASE_URL`. It should rely on the generated Prisma client and existing
server services.

Avoid adding new database tables for the PoC. Client metadata can initially
live in `source_ref`, `TaskSource.summary`, or task event reason text.

## Agent Runbook Draft

This is the short instruction block that can be given to an LLM client:

```md
You may use FedOS Home as Federico's canonical durable task system.

You can help Federico view, add, edit, complete, note, and remove tasks.

For reads, answer directly and keep summaries concise unless Federico asks for
detail.

For writes, only act when Federico clearly asks you to change a task. If more
than one task matches, ask which one. Confirm before permanent delete or bulk
changes. Prefer marking a task done or dropped when delete intent is unclear.

Never write directly to the database and never maintain a separate task list.
Use only the FedOS Home task tools.
```

## Risks And Guardrails

Risk: An LLM client changes the wrong task from a vague voice request.

Guardrail: Require disambiguation when multiple tasks match or the requested
target is unclear.

Risk: An LLM client deletes too aggressively.

Guardrail: Require explicit confirmation for permanent delete. Prefer
reversible status changes where possible.

Risk: Each client grows a different integration path.

Guardrail: Keep one provider-agnostic task contract and expose it through thin
adapters.

Risk: The adapter becomes a second business logic layer.

Guardrail: Adapters validate input, call existing Home services, and format
output. They do not implement task rules independently.

Risk: Mobile voice cannot access local-only tools.

Guardrail: Treat CLI/local MCP as desktop-local adapters and HTTP plus remote
connector access as the mobile path.

## Open Questions

- Is local desktop access already useful enough to keep even if mobile voice is
  slower to validate?
- Should permanent delete be exposed at all, or should agents only mark tasks
  `dropped`?
- How should natural-language task references map to task IDs safely?
- How much task detail is useful in a voice response before it becomes too
  long?
- Should client metadata become structured schema later?
- What is the safest deployment shape for the production authenticated API?
- Does Claude mobile voice expose custom remote MCP tools in practice, and if
  so, is the interaction good enough to use daily?

## Exit Criteria

The PoC is successful when at least one LLM client can complete this loop:

1. Answer "what tasks do I have today?" from FedOS Home durable tasks.
2. Add a new task.
3. Edit an existing task.
4. Mark a task done.
5. Safely handle a delete or remove request.
6. Show that all changes appear in FedOS Home.

The PoC is stronger if the same task contract can be reused from at least two
client surfaces, for example Codex plus Claude Desktop or ChatGPT.

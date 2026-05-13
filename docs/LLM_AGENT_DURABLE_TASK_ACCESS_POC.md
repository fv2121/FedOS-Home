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
is intentionally CLI-first so the task contract is proven before MCP or mobile
HTTP access.

| Order | Item | Status | Build target | Depends on | Outcome |
|---:|---|---|---|---|---|
| 1 | POC-01: Define task access contract | Ready | Shared contract | Existing task services | Provider-agnostic operation names and request/response shapes |
| 2 | POC-02: Implement read operations | Ready | Local CLI | POC-01 | `today`, `overdue`, `waiting`, `search`, `get`, and `summary` work |
| 3 | POC-03: Implement write operations | Ready | Local CLI | POC-01 | `create`, `update`, `complete`, `note`, and guarded `delete` work |
| 4 | POC-04: Add safe disambiguation and confirmation rules | Ready | Local CLI behavior | POC-02, POC-03 | Ambiguous edits ask for clarification; delete requires confirmation |
| 5 | POC-05: Build first adapter | Ready | `scripts/agent-tasks.ts` and `npm run agent:tasks` | POC-02, POC-03, POC-04 | Codex/Claude Code can operate tasks through shell commands |
| 6 | POC-08: Voice/chat dry run | Ready after first adapter | Manual test | POC-05 | One agent can list, add, edit, complete, and safely handle delete |
| 7 | POC-06: Add MCP adapter for desktop LLM apps | Future | MCP server/tools | Validated CLI contract | Claude Desktop-style chat can use native task tools |
| 8 | POC-07: Add authenticated HTTP adapter for mobile voice | Future | HTTP/API or connector | Validated task contract | ChatGPT mobile/remote clients have a viable access path |
| 9 | POC-09: Decide whether to graduate | Pending PoC results | Planning/docs | POC-08 plus optional adapter results | Go/no-go decision and migration into main backlog if useful |

## Goal

Give approved LLM clients a safe, model-agnostic way to operate on FedOS Home
tasks.

Target client surfaces:

- Claude Desktop
- Claude Code / Claude Cowork
- Codex
- ChatGPT desktop
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
2. **MCP adapter** for Claude Desktop and other desktop clients that support
   local tools.
3. **Authenticated HTTP adapter** for ChatGPT desktop/mobile or other clients
   that cannot run local commands directly.

The adapters should delegate to the same Home task services. The CLI, MCP
server, and HTTP routes should not each contain separate business logic.

### Adapter Comparison

| Adapter | Engagement model | Best for | Cost | Strengths | Limits | PoC role |
|---|---|---|---:|---|---|---|
| Local CLI | Federico or a shell-capable agent runs commands in the FedOS Home workspace, for example `npm run agent:tasks -- today`. In Codex or Claude Code, Federico can ask the agent in chat and the agent runs the command behind the scenes. | Codex, Claude Code, local shell agents | Lowest | Fastest to build; no new server surface; direct access to local env and Prisma; easy to debug | Not natural for Claude Desktop or ChatGPT mobile voice; depends on local machine and shell access | Prove task contract and service behavior first |
| MCP | Federico chats with a desktop LLM app. The app sees FedOS task tools and asks to use them when needed, for example after "What tasks do I have today?" or "Move this task to Friday." | Claude Desktop, Claude Code, desktop agent clients | Low to medium | Native tool UX in supporting desktop clients; reusable across MCP-capable apps; good bridge from chat to local tools | Client support varies; local MCP works best on desktop, not mobile; write-tool safety must be designed carefully | Prove chat-native desktop task control |
| Authenticated HTTP | Federico uses an app that cannot run local shell tools, especially mobile voice. The app calls FedOS task endpoints through an authenticated connector/API after Federico asks in chat or voice. | ChatGPT desktop/mobile, custom connectors, remote clients | Highest | Works beyond local shell; best path for mobile voice; easy to expose through API/actions/connectors | Requires auth, deployment, network reachability, rate limits, and stronger security posture | Prove mobile/voice access after contract is stable |

### Decision Rule

Build the smallest adapter that answers the next question:

- Start with CLI to prove the task operations are correct.
- Move to MCP if the main question is "Can I use this naturally from a desktop
  LLM app?"
- Move to HTTP if the main question is "Can I use this from ChatGPT mobile
  voice or another non-local client?"

The shared task contract should stay stable across all three. If the CLI
command is `today`, the MCP tool and HTTP endpoint should represent the same
operation rather than inventing a new behavior.

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
- an MCP server exposed through a client that supports the needed bridge;
- an authenticated HTTP/API adapter that the mobile app can call;
- a custom connector/action that talks to that authenticated API.

For this reason, CLI is best treated as the fastest desktop-local proof of the
task contract. It proves the operation shape, but it is not by itself the final
mobile voice solution.

## HTTP/Mobile Contract

ChatGPT mobile voice cannot reliably run a local shell command. To support
mobile voice, the same task operations eventually need an authenticated HTTP or
connector-facing wrapper.

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
- `POC-08`: run the voice/chat dry-run manually through the CLI.

Defer:

- `POC-06`: MCP adapter.
- `POC-07`: authenticated HTTP/mobile adapter.
- `POC-09`: graduation decision.

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

Status: Ready

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

Status: Ready

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

Status: Ready

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

Status: Ready

Scope:
- Document how agents should handle multiple task matches.
- Require confirmation for destructive delete and bulk edits.
- Prefer reversible status changes when intent is unclear.

Acceptance criteria:
- The runbook tells agents when to ask a follow-up question.
- Delete is not performed from a vague voice command.
- The user can still move quickly for clear low-risk edits.

### POC-05: Build first adapter

Status: Ready

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

### POC-06: Add MCP adapter for desktop LLM apps

Status: Future

Scope:
- Expose the same operations as MCP tools.
- Target Claude Desktop first if practical.
- Keep MCP as a thin wrapper over the shared task contract.

Acceptance criteria:
- Claude Desktop can read and mutate FedOS Home tasks through tools.
- Tool results match CLI behavior.
- MCP does not become a separate task implementation.

### POC-07: Add authenticated HTTP adapter for mobile voice

Status: Future

Scope:
- Expose selected task operations through agent-safe HTTP endpoints.
- Authenticate with a bearer token or equivalent connector-safe mechanism.
- Keep token scope limited to task operations.

Acceptance criteria:
- A non-shell client can read and mutate tasks.
- ChatGPT desktop/mobile has a plausible integration path.
- Existing browser cookie auth remains unchanged.

### POC-08: Voice/chat dry run

Status: Ready after first adapter

Scope:
- Use one LLM client to ask for today's tasks.
- Add one task.
- Edit one task.
- Mark one task done.
- Attempt one ambiguous delete and verify the agent asks for clarification.

Acceptance criteria:
- The full task loop works without opening the Home UI.
- The Home UI reflects the changes.
- The interaction feels short enough for voice.
- Any awkward phrasing or confirmation friction is recorded.

### POC-09: Decide whether to graduate

Status: Pending PoC results

Scope:
- Decide whether the CLI alone is useful.
- Decide whether MCP or HTTP should be the next interface.
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

Guardrail: Treat CLI/MCP as desktop-local adapters and HTTP/connector access as
the mobile path.

## Open Questions

- Is the first useful adapter CLI, MCP, or HTTP?
- Should permanent delete be exposed at all, or should agents only mark tasks
  `dropped`?
- How should natural-language task references map to task IDs safely?
- How much task detail is useful in a voice response before it becomes too
  long?
- Should client metadata become structured schema later?
- What is the safest access pattern for ChatGPT mobile voice?

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

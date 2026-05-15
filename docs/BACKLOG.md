# Backlog

This is the active work tracker for FedOS Home. The Home-centered intelligence architecture decision is recorded in [HOME_CENTERED_INTELLIGENCE_INTEGRATION.md](HOME_CENTERED_INTELLIGENCE_INTEGRATION.md), and the target/current architecture is maintained in [ARCHITECTURE.md](ARCHITECTURE.md).

Current focus:
- Immediate migration gaps: HCI-08A, Memory Digest management in Home; HCI-08B, Home navigation index.
- Next product capability after HCI-08A/HCI-08B: HCI-09, chat feedback and briefing revisions.
- Production gates before unattended use: Microsoft 365 token storage, scheduling, token budget guardrails, and outcome feedback modeling.
- Later product layer: HCI-10 voice input and HCI-11 Intelligence repo repositioning.

## P0 — Home-Centered Intelligence Migration

Canonical tracker: this section. Completed implementation briefs below are retained for traceability, but new active scope should be added as explicit backlog items rather than duplicated in the decision record.

| Status | ID | Work Item | Notes |
|---|---|---|---|
| Done | HCI-00 | Deployment and workspace readiness | GitHub renamed, Railway confirmed, VS Code workspace created, build/Prisma checks passed. |
| Done | HCI-01 | Home domain model for briefings | Added `BriefingPackage` and `ProposedAction` Prisma models plus `Task.approved_from_proposed_action_id` unique FK. Migration `0006_home_briefing_domain` created (not yet applied — local DB has unrelated drift). |
| Done | HCI-02 | Home server module structure | Added `src/server/` boundary, moved task service to `src/server/tasks/service.ts` with `index.ts` public export, kept `src/lib/task-service.ts` as a compatibility re-export, updated all `src/app` imports to `@/server/tasks`, documented future server domains in `src/server/README.md` and refreshed CLAUDE.md. No behavior change. |
| Done | HCI-03 | Memory Digest consumption in Home | Added read-only `src/server/memory` module (`context.ts`, `digest.ts`, `index.ts`) loading FedOS Memory via `FEDOS_MEMORY_ROOT` and approved digest via `FEDOS_DIGEST_ROOT`, with SHA-256 source hash, stale detection, and graceful degradation. Smoke-tested: live Memory + digest match, no warnings; missing env vars degrade with warnings instead of crashing. |
| Done | HCI-04 | Briefing package generation service | Ported LLM-first generation into Home: `src/server/sources/llm-first-signals.ts` (hygiene, dedup, compaction, prompt formatting), `src/server/llm/client.ts` (lazy Anthropic + injectable interface), `src/server/intelligence/{prompt,briefing-generation}.ts` (system prompt, Zod-validated output, orchestration), `src/server/briefings/generation.ts` (transactional `BriefingPackage` + `ProposedAction` persistence with HCI-03 digest provenance). Smoke-tested with fixture pack + fake LLM in dry-run and `--persist` modes; lint and build clean. |
| Done | HCI-05 | Briefing API routes | Added `src/server/briefings/service.ts` (list/get/run) and `src/server/proposals/service.ts` (decide with transactional approval that creates a `Task` via new `createTaskInTx` and links it back through `Task.approved_from_proposed_action_id`). Exposed authenticated routes `GET /api/briefings`, `GET /api/briefings/[id]`, `POST /api/briefings/run` (503 on missing Anthropic key/SDK), and `POST /api/proposals/[id]/decision` (404 not found / 409 already decided). Lint and build clean; routes return 401 without auth cookie as expected. |
| Done | HCI-06 | Mobile-first, desktop-continuous briefing UI | Routed `/` to a new briefing Home surface and made `/?view=tasks` the durable task list. Added `src/features/briefings/` (`briefing-home.tsx`, `briefing-section.tsx`, `proposed-action-card.tsx`, `use-briefing-actions.ts`, `briefing-types.ts`) rendering narrative, top priorities, recommendations, uncertainty, and a proposed-actions review queue with approve/reject/defer wired to `POST /api/proposals/[id]/decision`. Shared `src/components/primary-nav.tsx` provides matching desktop top bar and mobile bottom tabs (`Home | Tasks | New task`); replaces the old `bottom-nav.tsx`. Server fetches the latest persisted briefing via `listBriefingPackages({limit:1})` + `getBriefingPackage`; renders an empty state when none exists. Lint and build clean. |
| Done | HCI-07 | Home-owned Outlook signal ingestion | Added `src/server/sources/outlook/` (`config.ts`, `fernet.ts`, `token-store.ts`, `graph-client.ts`, `normalizer.ts`, `service.ts`, `index.ts`). `fetchOutlookSignalPack` returns `{signals, rawCounts, warnings, tokenStatus}`, mapping Graph mail/calendar onto the HCI-04 `BriefingSignal` shape (including conversation_id, body preview ≤300 chars, attendee emails). Minimal Fernet implementation in `node:crypto` reads/writes the legacy `m365_poc` encrypted token file with HMAC verification and 0o600 writes. Missing/expired/refresh-failed token state is reported instead of crashing; no Outlook bodies, full addresses, or tokens are logged in the smoke script. Added `scripts/test-outlook-normalizer.ts` (7 passing fixture assertions) and `scripts/smoke-outlook-signals.ts` (`--feed` pipes signals into HCI-04 with a fake LLM). Lint and build clean; missing-config smoke run fails gracefully with a clear message. |
| Done | HCI-08 | Home Debug Console | Added a desktop debug console at `/debug` (auth-protected by the existing proxy). New `src/features/debug-console/` (`components/debug-console.tsx`, `hooks/use-debug-console-run.ts`, `model/debug-console-types.ts`) drives the run-control panel, source-count metrics, 7-step pipeline strip, and inspection tabs from the approved spike. Backend orchestration lives under `src/server/debug/` (`intelligence.ts`, `redact.ts`) and reuses a new shared `prepareBriefingForLLM` helper extracted from `briefing-generation.ts` so the preflight and generation paths run the same hygiene/dedup/compaction/Memory/prompt pipeline. Two thin routes: `POST /api/debug/intelligence/preflight` (no LLM, no DB) and `POST /api/debug/intelligence/run` (full pipeline, `persist:false` is dry run, `persist:true` writes one `BriefingPackage` + proposed-action rows). Redaction caps body previews, masks email addresses and Graph IDs, and never emits tokens, secrets, or raw bodies. UI clarity follow-up implemented: `Raw JSON` is now labelled as redacted `Debug JSON`, prompt blocks are labelled as preview-truncated, and Signals is labelled as a sampled view. Lint and build clean. |
| Next | HCI-08A | Memory Digest management in Home | Recreate the legacy `#memory-digest` operator workflow as a Home-owned, authenticated surface for digest status, draft generation, manual review/editing, feedback, and explicit approval. Home already consumes approved digests read-only, but it currently cannot author or approve them without the legacy Intelligence layer. |
| Next | HCI-08B | Home navigation index | Recreate the useful part of legacy `#nav` as a Home-owned launchpad for current and planned Home surfaces. Include Home, Tasks, New task, Debug Console, Memory Digest, and lightweight system/API status links. Do not include the legacy scored debug page. |
| Queued | HCI-09 | Chat feedback and briefing revisions | Challenge/correct briefings and preserve revised versions after the real signal/debug loop, Memory Digest management, and Home navigation index are working. |
| Later | HCI-10 | Voice input layer | Add voice over the same command and feedback contracts. |
| Later | HCI-11 | Intelligence repo repositioning | Retire, archive, or keep FedOS Intelligence as lab-only after Home reaches parity. |

---

## Historical HCI Implementation Briefs

The briefs below describe the implementation slices used to migrate the intelligence runtime into Home. HCI-01 through HCI-08 are complete; keep these briefs as traceability/reference material rather than as the current plan of record.

## HCI-01 Implementation Brief — Lean Briefing Domain Model

Goal:
Create the minimal Home-owned database structure needed to persist generated briefings, review proposed actions, and turn approved proposals into durable Home tasks.

Design principle:
Keep the briefing flexible and the action approval path structured. The LLM can return one JSON object, but Home should split it into display content and reviewable action rows.

### LLM Output Contract

Use the current legacy Intelligence prompt shape as the MVP output contract:

```json
{
  "narrative": "...",
  "top_priorities": [],
  "recommendations": [],
  "proposed_actions": [],
  "uncertainty": []
}
```

Storage split:
- Store `narrative`, `top_priorities`, `recommendations`, and `uncertainty` in `BriefingPackage.payload`.
- Extract each item in `proposed_actions` into a structured `ProposedAction` row.
- Do not store proposed actions only inside the JSON payload, because the app needs to approve, reject, defer, edit, and convert them into tasks.

### New Concept: `BriefingPackage`

Purpose:
Store one generated briefing so Home can reload it after the app is closed and reopened, even before a new briefing run happens.

Suggested Prisma fields:
- `id`
- `status`
- `context_mode`
- `payload Json`
- `source_refs Json?`
- `memory_digest_hash String?`
- `memory_digest_stale Boolean?`
- `memory_digest_approved_at DateTime?`
- `model String?`
- `prompt_version String?`
- `created_at DateTime`
- `updated_at DateTime`

MVP payload shape:

```json
{
  "narrative": "...",
  "top_priorities": [],
  "recommendations": [],
  "uncertainty": []
}
```

Suggested package statuses:
- `active`
- `archived`
- `failed`

Recommended indexes:
- `status`
- `context_mode`
- `created_at`

### New Concept: `ProposedAction`

Purpose:
Store each concrete next-step suggestion generated from a briefing. A proposed action is not a task until Federico approves it.

The proposed action fields should intentionally mirror the existing `TaskCreateInput` and `Task` model so approval can become a simple task creation operation.

Suggested Prisma fields:
- `id`
- `briefing_package_id`
- `title`
- `description String?`
- `suggested_status TaskStatus?`
- `suggested_priority TaskPriority?`
- `suggested_category_id String?`
- `suggested_project_id String?`
- `suggested_owner String?`
- `suggested_due_at DateTime?`
- `suggested_source_type SourceType?`
- `suggested_source_ref String?`
- `suggested_tags Json?`
- `rationale String?`
- `uncertainty String?`
- `source_refs Json?`
- `status`
- `decision_reason String?`
- `decided_at DateTime?`
- `created_at DateTime`
- `updated_at DateTime`

Suggested proposal statuses:
- `pending`
- `approved`
- `rejected`
- `deferred`

Recommended indexes:
- `briefing_package_id`
- `status`
- `suggested_due_at`
- `created_at`

### Task Compatibility And Approval Mapping

Current durable task creation accepts:

```text
title
description
status
priority
category_id
project_id
owner
due_at
source_type
source_ref
tags
```

Approval mapping:

```text
ProposedAction.title                 -> Task.title
ProposedAction.description           -> Task.description
ProposedAction.suggested_status      -> Task.status
ProposedAction.suggested_priority    -> Task.priority
ProposedAction.suggested_category_id -> Task.category_id
ProposedAction.suggested_project_id  -> Task.project_id
ProposedAction.suggested_owner       -> Task.owner
ProposedAction.suggested_due_at      -> Task.due_at
ProposedAction.suggested_source_type -> Task.source_type
ProposedAction.suggested_source_ref  -> Task.source_ref
ProposedAction.suggested_tags        -> Task.tags
```

Add one origin link from `Task` back to `ProposedAction`.

Preferred implementation:
- Add `Task.approved_from_proposed_action_id String? @unique`.
- Add a relation from `Task` to `ProposedAction`.
- Add the Prisma back-relation from `ProposedAction` to the approved `Task`.
- Avoid storing both `Task.approved_from_proposed_action_id` and a separate scalar `ProposedAction.approved_task_id`; one database foreign key is enough.

On approval:
- Create the durable `Task`.
- Set `Task.approved_from_proposed_action_id`.
- Mark `ProposedAction.status = approved`.
- Set `ProposedAction.decided_at`.
- Optionally store `decision_reason`.

### Out Of Scope For HCI-01

Do not add these yet:
- `BriefingRevision`
- `ReviewDecision`
- `BriefingFeedback`
- historical briefing browser
- deep relational tables for priorities, recommendations, risks, or opportunities
- full LLM runtime migration
- briefing UI

These can be added later if the product proves they are useful.

### Verification

After implementing HCI-01:
- Run `npm run db:generate`.
- Create a migration, likely `0006_home_briefing_domain`.
- Run `npm run lint`.
- Run `npm run build`.
- Do not change app behavior or UI in this step.

---

## HCI-02 Implementation Brief — Home Server Module Boundary

Goal:
Create the first Home backend/domain boundary so future intelligence-layer work has a clear place to live without scattering business logic across `app`, `features`, and `lib`.

Design principle:
Make the smallest useful structural move. Do not create an architecture project, copy legacy Intelligence runtime code, or add empty folders that do not yet own real behavior.

### Target Boundary

Use this mental model going forward:

```text
src/app       thin Next.js routes, pages, route handlers, and server component composition
src/features  product UI and client-facing feature composition
src/server    server-side domain and business logic
src/lib       shared infrastructure and low-level utilities
```

`src/server` should become the canonical place for Home-owned backend logic. `src/lib` should stay for cross-cutting infrastructure such as Prisma access, auth/session helpers, validation helpers, rate limiting, and generic utilities.

### Scope

Implement the boundary with one real behavior-preserving refactor:

- Add `src/server/`.
- Move existing task domain service logic from `src/lib/task-service.ts` to `src/server/tasks/service.ts`.
- Add `src/server/tasks/index.ts` as the public export for the task server module.
- Keep `src/lib/task-service.ts` as a compatibility re-export so existing imports do not break immediately.
- Update internal imports to prefer `@/server/tasks` or `@/server/tasks/service` where practical.
- Add `src/server/README.md` documenting intended future server domains and ownership rules.
- Update relevant project documentation or agent guidance that still describes `src/lib/task-service.ts` as the canonical task service location.

Suggested future server domains to document, but not necessarily create yet:

```text
src/server/tasks         existing durable task domain
src/server/briefings     briefing package persistence and retrieval
src/server/proposals     proposed action approval/rejection/defer logic
src/server/memory        approved Memory Digest consumption
src/server/sources       email/calendar/source normalization for Home
src/server/llm           LLM provider wrappers and structured-output helpers
src/server/intelligence  orchestration that combines memory, sources, LLM, briefings, and proposals
```

### Import Rules

Use these rules as the intended direction:

- `src/app` may import from `src/server` for server components and route handlers.
- `src/features` should not directly import server modules from client components.
- UI should call server-backed routes/actions instead of reaching into domain services directly.
- New backend business logic should not be added to `src/lib` unless it is genuinely shared infrastructure.
- New task-domain logic should go through `src/server/tasks`.

### Out Of Scope For HCI-02

Do not add these yet:

- briefing generation
- LLM calls
- Memory Digest loading
- source ingestion or normalization
- proposed-action approval APIs
- new API routes
- new UI
- schedulers or background jobs
- generic service registries, dependency injection containers, or agent frameworks
- copied debug UI or lab-only code from the legacy Intelligence project
- database schema changes

### Verification

After implementing HCI-02:

- Run `npm run lint`.
- Run `npm run build`.
- Open the local homepage and confirm the existing task list still works.
- Confirm existing task create/update/delete flows still work.
- Confirm there are no intended behavior or UI changes.

---

## HCI-03 Implementation Brief — Memory Digest Consumption In Home

Goal:
Allow FedOS Home to consume the approved Memory Digest as read-only context for future briefing generation, while keeping FedOS Memory separate and canonical.

Design principle:
Port only the read/consume path. Do not move Memory into Home, do not build the digest authoring workflow, and do not create new persistence until briefing generation needs to stamp digest provenance onto `BriefingPackage`.

### Current Artifact Location

FedOS Memory source files currently live here:

```text
/Users/federico_valori/Documents/FedOS-Memory
```

The approved digest artifact currently lives in the legacy Intelligence repo:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/data/memory_digest/
  approved.md
  metadata.json
```

For the migration MVP, Home should consume those paths through environment variables rather than hard-coded local paths:

```text
FEDOS_MEMORY_ROOT=/Users/federico_valori/Documents/FedOS-Memory
FEDOS_DIGEST_ROOT=/Users/federico_valori/Documents/FedOS-Intelligence/data/memory_digest
```

Longer term, the approved digest artifact can move to Home-owned storage or a shared derived-artifact path, but HCI-03 should not solve that ownership move.

### Legacy Reference Files

Use the existing Intelligence implementation as a reference, not as a direct runtime dependency:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/app/reasoning/llm_first_memory.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/reasoning/memory_digest.py
/Users/federico_valori/Documents/FedOS-Intelligence/tests/test_memory_digest.py
```

Important legacy behavior to preserve:

- Memory files are read-only.
- The source hash is a stable SHA-256 over sorted `(relative path, content)` pairs.
- `metadata.json.approved_hash` is compared with the current live Memory source hash.
- A hash mismatch marks the digest as stale.
- Staleness is a warning, not a failure.
- Missing digest files degrade gracefully.

### Scope

Add a new server module:

```text
src/server/memory/
  context.ts
  digest.ts
  index.ts
```

`context.ts` should own read-only Memory context loading:

- define the approved Memory file list from the legacy loader
- read files from `process.env.FEDOS_MEMORY_ROOT`
- return `available`, `root`, `filesLoaded`, `filesMissing`, `sections`, and `error`
- never write to FedOS Memory

`digest.ts` should own approved digest consumption:

- read `approved.md` from `process.env.FEDOS_DIGEST_ROOT`
- read `metadata.json` from `process.env.FEDOS_DIGEST_ROOT`
- compute the live Memory source hash from loaded Memory sections
- compare live `sourceHash` with `metadata.approved_hash`
- expose `stale`, `approvedHash`, `sourceHash`, `approvedAt`, `sourceFiles`, `metadata`, and `warnings`
- format the approved digest as a prompt-ready block for HCI-04

`index.ts` should export the public memory module functions and types.

Suggested public API:

```ts
loadMemoryContext(): Promise<MemoryContext>
computeMemorySourceHash(memory: MemoryContext): string
loadApprovedMemoryDigest(): Promise<ApprovedMemoryDigest>
formatApprovedMemoryDigestForPrompt(content: string, options: { stale: boolean }): string
```

Suggested digest result shape:

```ts
type ApprovedMemoryDigest = {
  available: boolean;
  content: string | null;
  promptBlock: string;
  stale: boolean;
  approvedAt: string | null;
  approvedHash: string | null;
  sourceHash: string;
  sourceFiles: string[];
  filesLoaded: string[];
  filesMissing: string[];
  metadata: Record<string, unknown>;
  warnings: string[];
};
```

The prompt block should follow the legacy shape:

```text
=== FEDOS MEMORY DIGEST (approved, read-only) ===

...digest content...

=== END OF MEMORY DIGEST ===
```

If the digest is stale, include a clear stale note in the prompt block.

### Out Of Scope For HCI-03

Do not add these yet:

- Memory writes
- Memory Digest generation
- draft digest editing
- digest approval workflow
- digest feedback UI
- Home UI
- Home API routes
- database schema changes
- a new `MemoryDigest` table
- LLM calls
- briefing package generation
- automatic copying or syncing of Memory into Home

### Verification

After implementing HCI-03:

- Run `npm run lint`.
- Run `npm run build`.
- With local env vars configured, run a small `npx tsx` smoke check that imports `loadApprovedMemoryDigest()` and prints:
  - `available`
  - `stale`
  - `approvedAt`
  - `approvedHash`
  - `sourceHash`
  - loaded/missing file counts
- Confirm missing env vars or missing digest files return warnings rather than crashing normal app startup.

---

## HCI-04 Implementation Brief — Briefing Package Generation Service

Goal:
Port the proven LLM-first briefing generation behavior from FedOS Intelligence into the Home backend so Home can generate and persist its own `BriefingPackage` and attached `ProposedAction` rows.

Design principle:
Port, do not reinvent. FedOS Intelligence remains the reference implementation for the prompt, output shape, signal formatting, hygiene filtering, and compaction behavior. Translate that behavior into Home-native TypeScript and Prisma persistence.

This is the backend generation engine, not the full `debug#llm-first` operator console.

### Legacy Reference Files

Use these Intelligence files as the source of truth:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/app/prompts/llm_first_brief.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/orchestration/llm_first_funnel.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/reasoning/llm_first_hygiene.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/reasoning/llm_first_compaction.py
/Users/federico_valori/Documents/FedOS-Intelligence/tests/test_llm_first_funnel.py
```

Preserve these behaviors closely:

- LLM-first design: no numeric scoring or shortlist ranking before the LLM.
- Hygiene removes obvious machine noise only.
- Deduplication keeps the first occurrence by source ID.
- Thread/source compaction preserves traceability through source IDs.
- The approved Memory Digest is used as stable read-only context through `src/server/memory`.
- Prompt blocks separate stable context from dynamic signals.
- Proposed actions are suggestions only, never canonical tasks.
- The output shape remains `narrative`, `top_priorities`, `recommendations`, `proposed_actions`, and `uncertainty`.

### MVP Scope

Create only the Home backend modules needed for real behavior:

```text
src/server/sources/
  llm-first-signals.ts      signal type, hygiene, dedup, compaction, prompt formatting

src/server/llm/
  client.ts                 minimal provider wrapper for structured JSON generation

src/server/briefings/
  generation.ts             maps LLM output into BriefingPackage + ProposedAction rows
  index.ts

src/server/intelligence/
  briefing-generation.ts    orchestration: sources -> memory -> prompt -> LLM -> persistence
  prompt.ts                 ported system prompt, output schema, prompt block builder
  index.ts
```

If Claude Code finds a cleaner naming split while implementing, keep the same ownership:

- `sources` owns signal shaping.
- `memory` already owns Memory Digest consumption.
- `llm` owns provider calls.
- `briefings` owns persistence.
- `intelligence` owns orchestration.

Do not create placeholder folders that own no behavior.

### Service Contract

Home does not yet own the full Outlook ingestion/auth/token stack. For HCI-04, the generation service should accept a prepared normalized signal pack rather than fetch Outlook directly.

Suggested public API:

```ts
generateBriefingPackage(input: {
  contextMode?: string;
  signals: BriefingSignal[];
  model?: string;
  maxTokens?: number;
  useFullMemory?: boolean;
}): Promise<GeneratedBriefingPackage>
```

Suggested normalized signal shape should follow the legacy signal shape:

```ts
type BriefingSignal = {
  source_type: string;
  source_id: string;
  source_link?: string | null;
  title: string;
  summary?: string | null;
  timestamp?: string | Date | null;
  participants?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
};
```

The orchestration should:

1. Apply hygiene filters.
2. Deduplicate signals.
3. Compact repeated mail/calendar groups.
4. Load approved Memory Digest through `loadApprovedMemoryDigest()`.
5. Build cache-ready prompt blocks from stable context and dynamic signals.
6. Call the LLM for the structured briefing JSON.
7. Validate the LLM output with a Home-native schema.
8. Persist one `BriefingPackage`.
9. Extract `proposed_actions` into `ProposedAction` rows.
10. Return the created package, proposed actions, warnings, and lightweight run metadata.

### LLM Output Contract

Do not design a new briefing shape. Use the current legacy MVP shape:

```json
{
  "narrative": "...",
  "top_priorities": [
    { "rank": 1, "title": "...", "why": "...", "signal_id": "..." }
  ],
  "recommendations": ["..."],
  "proposed_actions": [
    { "action": "...", "context": "...", "signal_id": "..." }
  ],
  "uncertainty": "..."
}
```

Store in Home as:

- `BriefingPackage.payload.narrative`
- `BriefingPackage.payload.top_priorities`
- `BriefingPackage.payload.recommendations`
- `BriefingPackage.payload.uncertainty`
- one `ProposedAction` row per `proposed_actions[]` item

Suggested proposed-action mapping:

```text
action      -> ProposedAction.title
context     -> ProposedAction.description
signal_id   -> ProposedAction.suggested_source_ref
signal_id   -> ProposedAction.source_refs, if useful
status      -> pending
```

Set only task-compatible fields that are actually known. Do not invent due dates, priorities, projects, categories, owners, or tags unless the LLM output contract explicitly provides them later.

### Persistence Requirements

Create the `BriefingPackage` and `ProposedAction` rows in a single Prisma transaction.

Populate briefing package fields:

- `status = active`
- `context_mode`, defaulting to `business`
- `payload`
- `source_refs`
- `memory_digest_hash`
- `memory_digest_stale`
- `memory_digest_approved_at`
- `model`
- `prompt_version`

Use the HCI-03 digest result for Memory provenance:

```text
digest.approvedHash -> memory_digest_hash
digest.stale        -> memory_digest_stale
digest.approvedAt   -> memory_digest_approved_at
```

Do not add a new Prisma schema in HCI-04 unless a compile-time incompatibility is discovered with the already-added HCI-01 models.

### Out Of Scope For HCI-04

Do not add these yet:

- full `debug#llm-first` UI recreation
- Home Debug Console
- Home briefing UI
- product API routes
- Outlook/Microsoft Graph ingestion
- Microsoft token storage changes
- scheduled runs
- Memory writes
- Memory Digest generation or approval
- proposed-action approval into durable tasks
- chat feedback or briefing revisions
- provider prompt caching
- full cost/preflight UI

The legacy `debug#llm-first` page remains reference material only. The Home-owned replacement is tracked as HCI-08: Home Debug Console.

### Verification

After implementing HCI-04:

- Run `npm run lint`.
- Run `npm run build`.
- Add or run a small smoke script using a fixture normalized signal pack.
- Prefer a mocked/fake LLM response for the smoke path so verification does not require paid provider access.
- If a real provider key is configured, optionally run one real LLM generation against a tiny fixture pack.
- If the local DB does not yet have the HCI-01 migration applied, verify compile/build and document that persistence smoke is blocked by local DB migration state rather than changing the schema in HCI-04.

---

## HCI-05 Implementation Brief - Briefing API Routes

Goal:
Expose Home-owned API routes for briefing packages and proposed-action decisions so HCI-06 can build the user-facing briefing UI on stable product contracts.

Design principle:
Keep routes thin. Route handlers should handle auth, validation, and response formatting. Server-domain modules should own briefing lookup, generation orchestration, proposal decisions, and task creation handoff.

### MVP Scope

Implement these routes:

- `GET /api/briefings`
  - Authenticated.
  - Returns the latest/recent briefing packages, defaulting to a small limit such as 10.
  - Include enough metadata for a list view: `id`, `status`, `context_mode`, `created_at`, `updated_at`, `model`, `prompt_version`, Memory Digest provenance, and proposed-action counts by status.
  - This is not a full historical archive feature yet. Keep filtering minimal.
- `GET /api/briefings/[id]`
  - Authenticated.
  - Returns one briefing package plus its proposed actions.
  - Include the stored briefing `payload`, `source_refs`, model/prompt metadata, Memory Digest provenance, and proposed actions ordered consistently.
- `POST /api/briefings/run`
  - Authenticated.
  - Accepts a prepared normalized signal pack in the request body.
  - Calls the HCI-04 generation/persistence service.
  - For this MVP, do not ingest Outlook or Microsoft Graph directly in this route.
  - If real LLM provider config is missing, return a clean provider-configuration error rather than crashing.
- `POST /api/proposals/[id]/decision`
  - Authenticated.
  - Accepts `decision: "approved" | "rejected" | "deferred"`, optional `decision_reason`, and optional task field overrides when approving.
  - `rejected` and `deferred` only update the proposed action.
  - `approved` creates a durable `Task`, links it through `Task.approved_from_proposed_action_id`, and marks the proposed action as approved in one transaction.

### Approval Semantics

Approval is the important durable path. Proposed actions are temporary suggestions; approved actions become normal Home tasks.

When approving:

- Map task defaults from the proposed action's suggested fields.
- Allow request-body overrides for fields the user has edited before approval.
- Create the `Task`.
- Set `Task.approved_from_proposed_action_id` to the proposal id.
- Set `ProposedAction.status = "approved"`.
- Set `ProposedAction.decided_at`.
- Preserve an optional `decision_reason` if provided.

If the existing task service cannot be reused inside the same transaction, extract a small transaction-aware helper rather than duplicating task creation logic in the proposal service.

### Suggested Files

- `src/server/briefings/service.ts`
  - `listBriefingPackages`
  - `getBriefingPackage`
  - `runBriefingGeneration`
- `src/server/proposals/service.ts`
  - `decideProposedAction`
  - `approveProposedAction`
- `src/app/api/briefings/route.ts`
- `src/app/api/briefings/[id]/route.ts`
- `src/app/api/briefings/run/route.ts`
- `src/app/api/proposals/[id]/decision/route.ts`

Use route-local Zod schemas or shared validators if a local pattern already exists. Follow existing API helper conventions such as `requireAuth`, `requireJson`, `ok`, `fail`, and `failFromError`.

### Provider Setup Note

HCI-04 added a lazy Anthropic client path. Before wiring `POST /api/briefings/run` to the real provider, confirm whether `@anthropic-ai/sdk` is present in `package.json`.

If the route uses the real provider now:

- Add the missing dependency if needed.
- Require `ANTHROPIC_API_KEY` through environment configuration.
- Return a clear 4xx/5xx API error when provider configuration is missing.
- Do not embed secrets or test keys.

### Out Of Scope For HCI-05

Do not add these yet:

- briefing UI
- Home Debug Console
- legacy `debug#llm-first` page recreation
- `POST /api/briefings/[id]/feedback`
- briefing revision tables or revision APIs
- chat feedback loop
- prompt preview UI
- token/cost preflight UI
- Outlook/Microsoft Graph ingestion
- Microsoft token storage changes
- scheduled or unattended runs
- Memory writes
- Memory Digest generation or approval
- voice/chat interfaces
- new database entities unless an implementation-level compatibility issue is discovered

### Verification

After implementing HCI-05:

- Run `npm run lint`.
- Run `npm run build`.
- Smoke-test `GET /api/briefings`.
- Smoke-test `GET /api/briefings/[id]` against a known briefing package.
- Smoke-test proposal `rejected` or `deferred` decisions with a test proposal row.
- Smoke-test proposal `approved` creates exactly one durable task and links it back to the proposed action.
- Smoke-test `POST /api/briefings/run` with a tiny prepared signal pack when provider config is available; otherwise verify the route returns a clean provider-configuration error.
- Clean up exact smoke-test rows if they were created only for verification.

---

## HCI-06 Implementation Brief - Mobile-First, Desktop-Continuous Briefing UI

Goal:
Make FedOS Home the place where Federico reviews the latest persisted briefing and decides which proposed actions should become durable Home tasks.

Design principle:
Keep this as a product UI over the HCI-05 APIs, not a new reasoning/debug surface. The briefing is an intake/review surface. Durable tasks live in the Tasks view.

Reference spike:

```text
design-explorations/hci-06-briefing-ui-spike.html
```

Use the spike as directional reference only. Do not copy it wholesale, and do not treat it as production code.

### Navigation Model

Adopt the same primary navigation on mobile and desktop:

```text
Home | Tasks | New task
```

Meaning:

- `Home` = latest briefing / morning review surface.
- `Tasks` = durable task list. Approved proposals appear here after acceptance.
- `New task` = existing manual task creation flow, kept as a primary nav item for MVP.

Implementation notes:

- The default `/` view should become the Home briefing surface.
- Add a `Tasks` view for the existing durable task dashboard/list.
- Keep `New task` for now; longer term it may move to a CTA inside Tasks, but do not do that in HCI-06.
- Keep mobile and desktop navigation labels consistent. Do not use `Briefing` on one surface and `Home` on another.
- If the code uses `view=home` internally for task filtering, do not force a risky service rename in this item. It is fine for the UI route/view name `Tasks` to map internally to the existing task-list filter semantics.

### MVP Scope

Build the UI against already-persisted briefing packages:

- Load the latest briefing package.
- Render the briefing payload:
  - narrative
  - top priorities
  - recommendations
  - uncertainty
- Render proposed actions as a separate review queue.
- For each pending proposed action, support:
  - approve
  - reject
  - defer
- On approve, call `POST /api/proposals/[id]/decision` and create the durable task through the HCI-05 API.
- After approval, update the proposal state and refresh the task data so the approved task is visible in `Tasks`.
- Show already-decided proposed actions with their status, but keep pending actions visually primary.
- Show a useful empty state when no briefing exists yet.

### Explicit Product Boundary

Do not show a durable task mini-list or "task follow-through" box inside the briefing surface.

Reason:

- Proposed actions are not tasks yet.
- Durable tasks belong in `Tasks`.
- The briefing screen should stay focused on interpretation and decisions.

It is okay to show a small confirmation such as "Approved into Tasks" after approval, but the actual task list should remain in the `Tasks` view.

### Suggested Files

Add a briefing feature folder:

```text
src/features/briefings/
  components/
    briefing-home.tsx
    briefing-section.tsx
    proposed-action-card.tsx
  hooks/
    use-briefing-actions.ts
  model/
    briefing-types.ts
```

Update existing app shell/task files as needed:

```text
src/app/page.tsx
src/features/tasks/components/task-dashboard.tsx
src/features/tasks/components/bottom-nav.tsx
src/lib/constants.ts
```

If a shared navigation component is cleaner, add one in the relevant feature/component boundary, but keep the change small.

### Data Loading Shape

Preferred MVP loading path:

- Server-side in `src/app/page.tsx`, fetch the latest briefing via `src/server/briefings` rather than client-fetching on first paint.
- Fetch full details for the latest package so the Home briefing surface has proposed actions immediately.
- Continue loading task data for the Tasks view.

Reasonable implementation:

```text
listBriefingPackages({ limit: 1 }) -> latest package id
getBriefingPackage(id) -> full briefing + proposed actions
```

If no briefing exists:

- Show "No briefing yet" style empty state.
- Do not automatically call `POST /api/briefings/run`.
- Do not require real Anthropic configuration for HCI-06 UI testing.

### Proposal Actions

Use the existing HCI-05 decision API:

```text
POST /api/proposals/[id]/decision
```

Request examples:

```json
{ "decision": "approved" }
```

```json
{ "decision": "rejected", "decision_reason": "Not useful" }
```

```json
{ "decision": "deferred" }
```

For MVP, approving without editing is enough. If edit-and-approve is cheap to add using existing task edit fields, include it; otherwise defer edit-and-approve to a later proposal-editing or revision follow-up.

### Out Of Scope For HCI-06

Do not add these yet:

- chat feedback
- briefing revisions
- legacy `debug#llm-first` recreation
- Home Debug Console
- prompt/source inspection UI
- cost/token UI
- briefing history/archive browser
- automatic Outlook/Microsoft Graph ingestion
- automatic scheduled briefing runs
- Memory writes
- Memory Digest generation or approval
- new database tables
- durable task preview/list inside the briefing surface
- removing `New task` from primary navigation

### Verification

After implementing HCI-06:

- Run `npm run lint`.
- Run `npm run build`.
- Create or keep a persisted test briefing using `npx tsx scripts/smoke-briefing-generation.ts --persist`.
- Open `/` and confirm it shows the briefing Home surface.
- Confirm `Tasks` shows the existing durable task list.
- Confirm `New task` still opens the existing manual create flow.
- Approve a pending proposed action from Home and confirm:
  - the proposal status changes to approved
  - a durable task is created
  - the task appears in `Tasks`
  - the approved task remains linked to the proposal through `approved_from_proposed_action_id`
- Reject and defer pending proposed actions and confirm they do not create tasks.
- Test mobile and desktop viewport widths.
- Do not leave throwaway smoke data unless intentionally kept for manual testing.

---

## HCI-07 Implementation Brief - Home-Owned Outlook Signal Ingestion

Goal:
Move the Outlook mail/calendar ingestion capability into FedOS Home so Home can produce real normalized source signals for the briefing pipeline.

Design principle:
FedOS Home should own the runtime path. Use the current FedOS Intelligence implementation as reference material, but do not call the old Intelligence FastAPI app, old Intelligence database, or old Intelligence frontend from Home.

This item is intentionally backend-only. It prepares the real signal pack that HCI-08 can inspect through a debug console and that later product UI can run from Home.

### Legacy Reference Code

Use these files as the starting reference, not as a runtime dependency:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/app/connectors/outlook_connector.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/connectors/ms_graph.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/connectors/token_store.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/normalization/outlook_normalizer.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/orchestration/llm_first_funnel.py
/Users/federico_valori/Documents/FedOS-Intelligence/tests/test_llm_first_funnel.py
```

Known useful legacy behavior:

- Fetch recent Outlook mail metadata using a configurable lookback window.
- Fetch upcoming Outlook calendar metadata using a configurable lookahead window.
- Refresh or load Microsoft Graph tokens through the existing PoC token flow.
- Normalize mail and calendar records into a common signal shape.
- Optionally enrich selected mail candidates with short body previews.
- Cap body previews to roughly 300 characters to avoid prompt bloat.
- Filter obvious machine noise before prompt construction.

### Target Home Shape

Add a Home-owned source module under `src/server/sources`.

Suggested structure:

```text
src/server/sources/outlook/
  graph-client.ts
  token-store.ts
  normalizer.ts
  service.ts
  index.ts
```

If a flatter structure is simpler, this is also acceptable:

```text
src/server/sources/outlook-graph-client.ts
src/server/sources/outlook-token-store.ts
src/server/sources/outlook-normalizer.ts
src/server/sources/outlook-service.ts
```

Keep the ownership clear:

- `graph-client` owns Microsoft Graph HTTP calls.
- `token-store` owns the current token-file behavior and refresh handling.
- `normalizer` maps raw Graph payloads into Home `BriefingSignal` objects.
- `service` provides the public Home ingestion function.

### Service Contract

Expose one small public function for the rest of Home:

```ts
fetchOutlookSignalPack(input?: {
  mailLookbackDays?: number;
  mailMaxResults?: number;
  calendarLookaheadDays?: number;
  calendarMaxResults?: number;
  includeBodyPreviews?: boolean;
}): Promise<{
  signals: BriefingSignal[];
  rawCounts: {
    mail: number;
    calendar: number;
  };
  warnings: string[];
  tokenStatus: "ok" | "missing" | "expired" | "refresh_failed";
}>;
```

The returned `signals` must be directly usable by the existing HCI-04 generation path:

```ts
generateBriefingPackage({
  contextMode: "business",
  signals,
});
```

Do not add new database tables for this item. Outlook source records can stay transient until the briefing package is generated and persisted.

### Normalized Signal Contract

Reuse the HCI-04 `BriefingSignal` shape:

```ts
type BriefingSignal = {
  source_type: string;
  source_id: string;
  source_link?: string | null;
  title: string;
  summary?: string | null;
  timestamp?: string | Date | null;
  participants?: string[];
  topics?: string[];
  metadata?: Record<string, unknown>;
};
```

Mail mapping should preserve the important task/intelligence clues:

```text
source_type  -> "outlook_mail"
source_id    -> Graph message id
source_link  -> Graph webLink
title        -> subject
summary      -> "Email from {sender}"
timestamp    -> receivedDateTime
participants -> sender/display participants
topics       -> lightweight extracted terms, if already available from the legacy normalizer
metadata     -> is_read, sender_name, sender_email, to_recipients, conversation_id, body_preview
```

Calendar mapping should preserve meeting context:

```text
source_type  -> "outlook_calendar"
source_id    -> Graph event id
source_link  -> Graph webLink
title        -> subject
summary      -> "Meeting organised by {organizer}"
timestamp    -> start date/time
participants -> organizer and attendee names
topics       -> lightweight extracted terms, if already available from the legacy normalizer
metadata     -> event_start, event_end, organizer_email, attendee_emails
```

Set only fields that are genuinely present in Graph data. Do not invent owners, due dates, priorities, projects, or categories at ingestion time.

### Token And Auth Boundary

MVP is allowed to keep the existing PoC token-file approach if that is what the legacy project already uses, but it must be encapsulated inside Home.

Requirements:

- Do not commit tokens or secrets.
- Do not silently depend on files inside the old Intelligence repo at runtime.
- Document the Home env vars and token path needed for local testing.
- If the token is missing, expired, or cannot refresh, return a clear error/warning instead of crashing.
- Do not change the Microsoft app registration unless strictly required.
- Do not build the final production secret store in this item. Keep that tracked under `MIG-SEC-01`.

### Integration Point

After this item, Home should be able to run this backend flow:

```text
Microsoft Graph -> Home Outlook ingestion -> BriefingSignal[] -> HCI-04 generation service
```

It should not run this flow:

```text
Home -> old FedOS Intelligence API -> old Intelligence ingestion -> Home
```

The old Intelligence project remains reference/lab material only.

### Suggested Smoke Script

Add a local smoke script:

```text
scripts/smoke-outlook-signals.ts
```

The script should:

- load Home Outlook token/env configuration
- fetch a small mail/calendar window
- print raw counts
- print a redacted sample of normalized signals
- avoid logging access tokens, refresh tokens, full email bodies, or secrets
- exit with a clear message if token configuration is missing

If feasible, add a dry-run mode that feeds the resulting `signals` into the HCI-04 generation path with a fake LLM response, so we verify the signal shape without paying for provider calls.

### Out Of Scope For HCI-07

Do not add these yet:

- Home debug console UI
- legacy `debug#llm-first` page recreation
- product "Run briefing" button in Home
- automatic scheduled runs
- new Prisma schema or new database tables
- chat feedback
- briefing revisions
- voice input
- Memory writes
- Memory Digest generation or approval
- production secret store
- full cost/token dashboard
- connecting Home to the old Intelligence runtime

### Verification

After implementing HCI-07:

- Run `npm run lint`.
- Run `npm run build`.
- Add unit or fixture tests for the mail and calendar normalizers using saved/redacted Graph-shaped payloads.
- Run the smoke script without token config and confirm it fails gracefully with a useful message.
- If local token config is available, run the smoke script live and confirm:
  - mail count is returned
  - calendar count is returned
  - normalized signals include `outlook_mail` and/or `outlook_calendar`
  - no secrets or full bodies are logged
- Confirm a small signal pack can be passed into the existing HCI-04 generation service using a fake LLM response.

---

## HCI-08 Implementation Brief - Home Debug Console

Goal:
Build a Home-owned debug console for testing and tuning the end-to-end intelligence pipeline before the polished product run experience is added.

This is the replacement for the useful diagnostic behavior of the old Intelligence `debug#llm-first` page, but it should be named and framed as `Debug Console` in Home. Do not build this as a dependency on the old Intelligence app.

Design basis:
Use the approved standalone design spike as the implementation reference:

```text
design-explorations/hci-08-debug-console-desktop.html
```

The spike is disposable HTML/CSS, but its layout and information architecture are the source of truth for HCI-08:

- full-width desktop console
- left navigation rail
- run controls sidebar
- top source/cost metrics
- pipeline status strip
- inspection panel with `Signals`, `Prompt`, `Memory`, and `Debug JSON` tabs
- result panel showing the generated briefing and proposed actions
- page title should be `Debug Console`, not `LLM-first`

### Operator Outcome

Federico can open a protected debug page in Home, run the real Home intelligence pipeline, inspect what happened at each stage, and decide whether to persist the generated briefing package.

The console should answer these questions clearly:

- Did Outlook connect?
- How many mail/calendar signals were fetched?
- What was excluded by hygiene filters?
- What signal sample reached the LLM?
- Which Memory context was used: approved digest, full Memory, or none?
- What prompt blocks were sent?
- Did the LLM return valid briefing JSON?
- What proposed actions came back?
- Did the run stay dry-run, or did it create a `BriefingPackage` and `ProposedAction` rows?

### Suggested Route And File Structure

Use a real Home route, protected by the existing session/auth boundary:

```text
src/app/debug/page.tsx
src/features/debug-console/components/debug-console.tsx
src/features/debug-console/model/debug-console-types.ts
src/features/debug-console/hooks/use-debug-console-run.ts
```

Use debug-only API routes under `/api/debug/...`:

```text
src/app/api/debug/intelligence/preflight/route.ts
src/app/api/debug/intelligence/run/route.ts
```

The exact component split can follow local Next.js/App Router conventions, but keep the feature contained under `src/features/debug-console` and server logic under `src/server`.

### Backend Contract

Preflight route:

```text
POST /api/debug/intelligence/preflight
```

Purpose:
Fetch real Outlook signals, apply the same hygiene/dedup/compaction and Memory prompt preparation as generation, but do not call the LLM and do not write to the database.

Return:

- token/auth status
- raw Outlook counts
- warnings/errors
- generation stats: input count, hygiene excluded, duplicates, collapsed, final count
- redacted signal sample
- Memory Digest status
- prompt blocks
- prompt/user-message character count and rough token estimate

Run route:

```text
POST /api/debug/intelligence/run
```

Purpose:
Run the real Home pipeline:

```text
Outlook -> BriefingSignal[] -> hygiene/dedup/compaction -> Memory -> prompt -> LLM -> validated briefing JSON -> optional persistence
```

Input should support the controls from the mockup:

- `contextMode`, default `business`
- `model`, default current Home LLM default
- `maxTokens`
- `useFullMemory`, default `false`
- `persist`, default `false`
- `mailLookbackDays`, default `1`
- `mailMaxResults`, default `50`
- `calendarLookaheadDays`, default `1`
- `calendarMaxResults`, default `50`
- `includeBodyPreviews`, default `true`
- optional sender/subject exclusion strings if easy to wire through existing hygiene options

Persistence behavior:

- `persist: false` must run as a dry run and must not create any `BriefingPackage` or `ProposedAction` rows.
- `persist: true` should call the existing HCI-04 generation path with `dryRun: false`, creating one briefing package and attached proposed-action rows.
- Do not create durable `Task` records from this console. Proposed actions still require the existing approval path.

Implementation note:
Prefer extracting or reusing a shared preflight/preparation helper from `src/server/intelligence/briefing-generation.ts` instead of copy/pasting the prompt assembly logic. The debug console and generation service must inspect the same pipeline behavior.

### UI Requirements

Build a desktop-first debug page. Mobile polish is out of scope for HCI-08.

The page should include:

- `Debug Console` title
- environment/status tags: token, digest, dry run/persist, model, prompt size
- run controls:
  - model selector
  - max output tokens
  - mode/context selector
  - `Use full Memory files` toggle with helper copy
  - `Save briefing package` toggle with helper copy
  - mail/calendar window controls
  - body preview toggle
  - sender/subject exclusions if supported
- action buttons:
  - `Estimate and preview`
  - `Run real LLM`
  - `Clear result`
- metrics:
  - mail count
  - calendar count
  - excluded count
  - final signals to LLM
  - estimated input tokens
  - estimated cost if available; otherwise show estimate unavailable
- pipeline strip:
  - Outlook fetch
  - Normalize
  - Hygiene
  - Memory digest
  - Prompt budget
  - LLM output
  - Persist off/on
- inspection tabs:
  - `Signals`: redacted source sample, explicitly labelled as a sample rather than the full signal set
  - `Prompt`: prompt budget and prompt-block preview, explicitly labelled as truncated preview while the full prompt is sent to the LLM
  - `Memory`: digest/full Memory status and scrollable memory prompt block
  - `Debug JSON` or `Run Payload`: redacted structured debug payload for the UI; do not call this `Raw JSON` unless it truly contains raw source/provider data
- result panel:
  - narrative
  - top priorities
  - recommendations if returned
  - uncertainty if returned
  - proposed actions list
  - run log
  - dry-run/persist notice

### Data Safety And Redaction

The debug console may show operational details, but it must not leak secrets.

Requirements:

- Never render access tokens, refresh tokens, encryption keys, client secrets, auth cookies, or raw token-file content.
- Do not render full email bodies.
- Prefer body preview lengths and short previews already capped by HCI-07.
- Redact or mask full email addresses in signal samples and debug payloads.
- The debug payload is not raw Microsoft Graph JSON and is not the full LLM prompt. It is a redacted UI payload.
- If signal data is capped, label it clearly, for example `Showing first 25 of 46 final signals`.
- If prompt blocks are truncated in the UI, label them clearly, for example `Preview only — full prompt sent to LLM`.
- Keep this page protected by the existing Home auth boundary.

### HCI-08 Follow-Up UI Clarity Brief

Current confusion:
`Raw JSON` sounds like it contains every raw object at full fidelity, but the current tab shows a redacted debug payload assembled for the UI. It does not include raw Microsoft Graph responses, tokens, full email bodies, or every internal runtime object. The signal data inside it is sampled and redacted.

Goal:
Make the debug console honest about what each inspection view is showing, without changing the underlying intelligence pipeline.

Implementation target:

```text
src/features/debug-console/components/debug-console.tsx
src/features/debug-console/model/debug-console-types.ts
src/server/debug/intelligence.ts
```

Expected backend behavior:

- Keep the current preflight/run pipeline unchanged.
- Do not fetch raw Microsoft Graph payloads.
- Do not send full email bodies to the UI.
- Do not persist anything new.
- Only add a small metadata field such as `signalSampleLimit` or `displayedSignalCount` if the UI cannot render the sample label cleanly from existing data.

Implement these copy/label changes:

- Rename `Raw JSON` to `Debug JSON` or `Run Payload`.
- Add helper copy under the tab title:
  `Redacted debug payload for the UI. Not the full Microsoft Graph response or full LLM prompt.`
- In the Signals tab, add:
  `Showing first {signalSample.length} of {stats.finalCount} final signals.`
- In the Prompt tab, rename `Prompt blocks` to `Prompt blocks preview`.
- Add helper copy in Prompt:
  `Preview only. Full prompt blocks are sent to the LLM.`
- Show displayed/full character counts for truncated prompt sections:
  - system prompt: 800 displayed / full count
  - stable context: 800 displayed / full count
  - dynamic signals: 1200 displayed / full count
- In the Memory tab, add:
  `Scrollable memory prompt block used for this run.`

Acceptance criteria:

- No tab or heading says `Raw JSON` unless the view contains truly raw, full-fidelity source/provider data.
- The JSON/debug tab makes clear it is a redacted UI payload, not raw Graph JSON and not the full LLM prompt.
- The Signals tab makes clear it is a sample and shows how many final signals are represented.
- The Prompt tab makes clear it is a truncated preview and that the full prompt blocks are sent to the LLM.
- The Memory tab makes clear the visible content is the prompt-ready Memory block used for the run.
- Dry-run, preflight, and persisted-run behavior remains unchanged.
- Run `npm run lint` and `npm run build` after the UI copy change.

Do not change backend behavior for this follow-up unless the UI needs an explicit `signalSampleLimit` field to render the sample label cleanly.

### Reuse Requirements

Use existing Home-owned code:

- `fetchOutlookSignalPack` from `src/server/sources/outlook`
- HCI-04 generation service from `src/server/intelligence` / `src/server/briefings`
- Memory Digest loading from `src/server/memory`
- existing route helper/auth response patterns from `src/lib/route-helpers`
- existing `ok`/`fail` HTTP response shape from `src/lib/http`

Do not call:

- old FedOS Intelligence runtime
- old `localhost:5173` APIs
- Python/FastAPI services from the former Intelligence repo

### Out Of Scope For HCI-08

Do not add these yet:

- product Home "Run briefing" button
- mobile-optimized debug UI
- scheduled runs
- chat feedback or briefing revisions
- voice input
- new database tables
- production secret store
- Memory writes or Memory Digest approval workflow
- proposed-action approval/rejection controls inside the debug console
- full historical run explorer
- provider prompt caching
- two-stage LLM pipeline

### Verification

After implementing HCI-08:

- Run `npm run lint`.
- Run `npm run build`.
- Open `/debug` locally while authenticated and confirm the page renders.
- Confirm unauthenticated access is blocked by the existing auth behavior.
- Run preflight with missing Outlook token/config and confirm it returns a clear not-connected state instead of crashing.
- Run preflight with local Outlook config and confirm:
  - mail/calendar counts appear
  - inspection tabs populate
  - prompt preview appears
  - no secrets or full bodies are visible
- Run `Run real LLM` with `Save briefing package` off and confirm:
  - valid briefing result appears
  - proposed actions appear in the result panel
  - no new briefing package is created
- Run `Run real LLM` with `Save briefing package` on and confirm:
  - a package ID is returned
  - proposed-action IDs are returned
  - `/` can show the persisted briefing afterwards
- If `ANTHROPIC_API_KEY` or SDK is missing, confirm the UI shows a clear provider-not-configured error.

---

## HCI-08A Implementation Brief — Memory Digest Management In Home

Goal:
Recreate the legacy Intelligence `#memory-digest` workflow inside FedOS Home so the approved Memory Digest can be generated, tested, reviewed, edited, and approved without depending on the legacy Intelligence UI or FastAPI service.

Discovery note:
Home currently has `src/server/memory` for read-only consumption of `approved.md` and `metadata.json`, plus digest status visibility in the Debug Console. It does not have Home routes, APIs, UI, or write workflows for draft generation, draft editing, feedback capture, or approval. HCI-03 explicitly kept those workflows out of scope.

Design principle:
FedOS Memory remains canonical and read-only from this workflow. The digest is a derived, human-approved artifact. Home may author and approve the digest artifact, but it must never silently write to FedOS Memory.

### Legacy Reference

Reference behavior from FedOS Intelligence, but do not call the legacy runtime:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/frontend/src/MemoryDigestPage.jsx
/Users/federico_valori/Documents/FedOS-Intelligence/app/api/memory_digest.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/reasoning/memory_digest.py
/Users/federico_valori/Documents/FedOS-Intelligence/app/prompts/memory_digest.py
/Users/federico_valori/Documents/FedOS-Intelligence/tests/test_memory_digest.py
```

The legacy workflow supports:

- status with loaded/missing Memory files, source hash, approved hash, stale flag, and metadata
- reading `draft.md`, `approved.md`, and `feedback.md`
- saving manual draft edits
- saving feedback for the next regeneration
- LLM draft generation from full Memory, optional feedback, and optional previous draft
- explicit promotion of draft to approved digest

### Route And Feature Shape

Add a protected Home operator page:

```text
src/app/memory-digest/page.tsx
src/features/memory-digest/components/memory-digest-console.tsx
src/features/memory-digest/hooks/use-memory-digest.ts
src/features/memory-digest/model/memory-digest-types.ts
```

Add Home API routes:

```text
GET  /api/memory-digest/status
GET  /api/memory-digest/draft
PUT  /api/memory-digest/draft
GET  /api/memory-digest/approved
GET  /api/memory-digest/feedback
PUT  /api/memory-digest/feedback
POST /api/memory-digest/draft/generate
POST /api/memory-digest/approve
```

Keep server logic under `src/server/memory`, but separate write workflows from the existing read-only loader:

```text
src/server/memory/digest.ts             read-only approved digest consumption
src/server/memory/digest-workflow.ts    draft, feedback, generate, approve workflow
src/server/memory/digest-prompt.ts      digest generation prompt and output contract
```

### Artifact Ownership

For the migration slice, continue using `FEDOS_DIGEST_ROOT` so the Home briefing pipeline immediately consumes the approved artifact it creates.

The artifact layout remains:

```text
draft.md
approved.md
feedback.md
metadata.json
```

`metadata.json` should preserve the existing fields and add Home-specific provenance only where useful:

- `draft_generated_at`
- `draft_source_hash`
- `draft_source_files`
- `draft_model`
- `draft_manually_edited`
- `digest_prompt_version`
- `approved_at`
- `approved_hash`
- `approved_source_files`
- `approved_prompt_version`
- optional `generated_by: "fedos-home"`

Longer-term storage can move to a Home-owned or shared derived-artifact location, but this slice should not require a database table unless audit/history becomes necessary.

### Backend Requirements

Status should reuse Home `loadMemoryContext()` and `computeMemorySourceHash()` so staleness is identical to briefing generation.

Draft generation should use the Home LLM provider wrapper rather than the legacy Python Anthropic client. It should:

- accept model and max-token controls
- include saved feedback when requested
- include the previous draft when requested
- format full Memory context from Home's Memory loader
- return digest Markdown plus usage/cost metadata when available
- save the generated draft and update metadata only after generation succeeds

Approval should:

- require an existing draft
- copy the draft into `approved.md`
- stamp `approved_at`, `approved_hash`, and approved source files
- make the newly approved digest visible to existing briefing generation and `/debug` preflight without extra sync work

### UI Requirements

The page should be an operator console, not a marketing or landing page.

Include:

- status strip: approved/current, approved/stale, no approved digest, Memory unavailable
- source hash and approved hash visibility with short display and full tooltip/details
- loaded and missing Memory source file list
- model and max-token controls
- toggles for using feedback and previous draft during regeneration
- `Generate draft`, `Save draft`, `Approve draft`, and `Refresh` actions
- editable draft Markdown area
- read-only approved Markdown area
- feedback panel for the next regeneration
- warnings/errors from Memory loading, digest loading, and LLM generation
- last generation usage/cost when available
- link from `/debug` to `/memory-digest`, since the Debug Console depends on digest freshness

### Safety Requirements

- Protect the page and API routes with the existing Home auth/session boundary.
- Never render API keys, auth cookies, Microsoft tokens, or raw secret values.
- Never write to FedOS Memory files.
- Never call the legacy `localhost:5173` UI or legacy FastAPI endpoints.
- Require an explicit confirmation before approval.
- If the approved digest is stale, make that visible but do not block normal briefing generation.
- If the draft source hash differs from the current live Memory hash at approval time, warn clearly and require confirmation or regeneration.

### Out Of Scope For HCI-08A

- Direct Memory editing
- automatic Memory updates
- digest history browser
- multi-user approval workflow
- scheduled digest regeneration
- replacing `FEDOS_DIGEST_ROOT` with a new storage location
- redesigning the daily briefing prompt beyond consuming the approved digest
- changing `/debug` into the primary digest editor

### Acceptance Criteria

- Home has a working `/memory-digest` page that covers the legacy `#memory-digest` workflow.
- Home can generate a draft digest from live FedOS Memory without calling FedOS Intelligence.
- Federico can edit and save the draft.
- Federico can save feedback and include it in the next generation.
- Federico can explicitly approve the draft.
- After approval, Home briefing generation uses the new approved digest through the existing HCI-03 loader.
- Staleness is computed from the same Memory source hash used by briefing generation.
- Missing Memory or digest files degrade into visible warnings rather than crashes.
- The Debug Console continues to show the approved digest status and prompt block correctly.

### Verification

After implementing HCI-08A:

- Run `npm run lint`.
- Run `npm run build`.
- Run `npx tsx scripts/smoke-memory-digest.ts`.
- Add focused tests for digest workflow file behavior: save draft, save feedback, approve draft, stale detection, missing draft approval failure.
- Open `/memory-digest` locally while authenticated and confirm the page renders.
- Confirm unauthenticated access is blocked by the existing auth behavior.
- Generate a draft with a fake/injected LLM in tests and with the real provider manually when configured.
- Save a manual draft edit, approve it, then run the Debug Console preflight and confirm it reports the new approved digest.

---

## HCI-08B Implementation Brief — Home Navigation Index

Goal:
Recreate the useful part of the legacy Intelligence `#nav` page as a Home-owned navigation index so Federico has one fast launchpad for product surfaces, operator tools, and lightweight system checks.

Discovery note:
Home currently has `PrimaryNav` for the core product loop (`Home | Tasks | New task`) and a protected `/debug` page, but it does not have a standalone `/nav` or `/tools` page equivalent to legacy `#nav`. The legacy page included the old scored debug page; Home does not have that page and should not recreate it.

Design principle:
This should be a practical internal launchpad, not a second primary navigation model. Keep the existing product navigation intact. The index should help an operator find the right Home-owned surface quickly and understand whether each surface is live, planned, or intentionally omitted.

### Legacy Reference

Reference behavior from FedOS Intelligence:

```text
/Users/federico_valori/Documents/FedOS-Intelligence/frontend/src/NavPage.jsx
/Users/federico_valori/Documents/FedOS-Intelligence/frontend/src/main.jsx
```

The legacy `#nav` page linked to:

- Morning Dashboard
- LLM-First Funnel Debug
- Memory Digest
- Legacy Scored Debug
- Swagger / OpenAPI
- ReDoc
- OpenAPI schema
- Health check

Home should translate that list into Home-owned equivalents and omit surfaces that are obsolete or not meaningful in the Next.js app.

### Route And Feature Shape

Add a protected Home route:

```text
src/app/nav/page.tsx
src/features/nav-index/components/nav-index.tsx
```

If the implementation stays small, the feature can be a single server component under `src/app/nav/page.tsx`, but prefer a feature component if styling or link metadata grows.

Add a link to `/nav` from desktop-visible Home chrome where it is useful, without overcrowding the mobile bottom nav. Reasonable places:

- desktop `PrimaryNav` utility link
- Debug Console header/sidebar
- future Memory Digest console header

### Suggested Link Set

Product surfaces:

- `Home` -> `/`
- `Tasks` -> `/?view=tasks`
- `New task` -> `/?view=new`

Operator surfaces:

- `Debug Console` -> `/debug`
- `Memory Digest` -> `/memory-digest` once HCI-08A exists; before then, show as planned or disabled rather than linking to a 404
- `Chat feedback / revisions` -> planned HCI-09; show as planned only if useful

System/API surfaces:

- `Health check` -> `/api/health`
- `Briefings API` -> `/api/briefings`, marked as API endpoint rather than page
- `Run briefing API` -> `/api/briefings/run`, marked as POST-only so it is not presented as a normal click target
- `Debug preflight API` -> `/api/debug/intelligence/preflight`, marked as POST-only
- `Debug run API` -> `/api/debug/intelligence/run`, marked as POST-only

Do not include:

- legacy scored debug page
- legacy `debug#llm-first` URL
- legacy FastAPI Swagger/ReDoc/OpenAPI links, unless Home later adds generated API docs
- links to the old `localhost:5173` Intelligence frontend or old FastAPI service

### UI Requirements

The page should use a dense, scannable internal-tool layout:

- title: `FedOS Navigation`
- short status row showing environment/runtime context if cheaply available
- grouped sections for `Product`, `Operator`, and `System`
- cards or compact rows with:
  - surface name
  - status badge (`live`, `planned`, `api`, `post-only`, `retired`)
  - destination
  - one-line purpose
- clear visual treatment for planned/disabled items
- no visible card for the legacy scored debug page; if mentioned at all, mention only in a small `Retired / intentionally omitted` note
- avoid making this a marketing page or a replacement for normal Home navigation

### Acceptance Criteria

- Home has a protected `/nav` page or equivalent route.
- The page links to current Home product surfaces: `/`, `/?view=tasks`, and `/?view=new`.
- The page links to the Home Debug Console at `/debug`.
- The page includes the Memory Digest surface after HCI-08A, or marks it as planned before implementation.
- The page includes useful Home-owned system/API references without pretending POST-only routes are clickable pages.
- The legacy scored debug page is not included as a navigable card.
- No link points to the legacy `localhost:5173` Intelligence app or legacy FastAPI runtime.

### Verification

After implementing HCI-08B:

- Run `npm run lint`.
- Run `npm run build`.
- Open `/nav` locally while authenticated and confirm the page renders.
- Confirm unauthenticated access is blocked by the existing auth behavior.
- Click live page links and confirm they reach the intended Home surfaces.
- Confirm planned/API/POST-only items are labelled accurately and do not mislead the operator.
- Confirm there is no legacy scored debug page link.

---

## P0/P1 — Migrated Intelligence Backlog Carry-Over

These items were reviewed from the former FedOS Intelligence backlog. They are no longer treated as active product backlog inside the Intelligence repo. Items that remain relevant are carried here because FedOS Home is the target product runtime.

| Status | ID | Former Intelligence Item | Decision | Priority / Timing |
|---|---|---|---|---|
| Planned | MIG-SEC-01 | Replace PoC token file storage with production-grade secret store | Move to Home. Required once Home owns Microsoft 365 ingestion and any unattended/scheduled runs. | Before production M365 integration |
| Owner confirmation | MIG-SEC-02 | Verify or complete Microsoft 365 client secret rotation | Move to Home as a manual security verification item. Close once old secret deletion is confirmed. | Now / before further M365 work |
| Partially superseded | MIG-SEC-03 | Upgrade interim Intelligence API auth | Do not port the exact shared-token model. Home already has session auth; review auth again when adding briefing/product APIs, scheduled jobs, or machine-to-machine endpoints. | Before exposed briefing APIs |
| Planned | MIG-INT-01 | Suggest stakeholder and Memory-update candidates for review | Move to Home as future Memory-update suggestion capability. Keep review-based; never silently write Memory. | After HCI-09/outcome feedback |
| Planned | MIG-INT-02 | Add free-time analysis and proactive calendar blocking suggestions | Move to Home as future time intelligence inside morning briefing/calendar reasoning. | After HCI-04/HCI-06 |
| Later | MIG-COST-01 | Investigate and optionally enable provider prompt caching | Move to Home as future optimization, mainly useful for interactive chat/revision loops rather than once-daily briefings. | After HCI-09 |
| Later | MIG-COST-02 | Add optional two-stage LLM-first pipeline | Move to Home as optional cost/quality optimization after baseline Home briefing generation is working. | After HCI-04 quality baseline |
| Production gate | MIG-COST-03 | Add hard token budget gate before production use | Move to Home as a production/unattended-run safety gate. Lower priority during manual testing. | Before scheduled unattended production |
| Reference only | MIG-COST-REF | Completed LLM-first cost-management work | Do not reopen as backlog. Port useful pieces through HCI-03/HCI-04: approved Memory Digest, compact prompts, cache-ready structure, source/thread compaction. | Covered by HCI-03/HCI-04 |

---

## P1 — Fix Soon

### N+1 database queries in `connectTagsByName`
**File:** `src/server/tasks/service.ts:194-214`
One upsert per tag inside a `for` loop. 5 tags = 10 queries. Scales badly as usage grows.
**Fix:** Batch tag upserts with `createMany({ skipDuplicates: true })`, then bulk-insert `taskTag` relations in a single transaction.

### Rate-limiter memory leak
**File:** `src/lib/rate-limit.ts`
The `attempts` Map filters old timestamps on every check but never deletes keys whose arrays become empty, so the Map grows indefinitely in a long-running process.
**Fix:** After the filter, add `if (timestamps.length === 0) attempts.delete(key); else attempts.set(key, timestamps);`

## P2 — Address Soon

### Pagination
**File:** `src/server/tasks/service.ts` — `searchTasks`, and `src/app/page.tsx`
`take: 250` is a silent ceiling. Tasks beyond 250 are never returned or shown — no error, no indication. Every page load also serializes up to 250 full task objects including all relations.
**Recommended approach:** Offset pagination (`skip`/`take`) is sufficient at personal scale and much simpler than cursor-based. Add `skip` + `limit` params to `searchTasks`, pass `page` as a URL search param, and add a "Load more" button in `TaskDashboard` that fetches the next page via a `/api/tasks` route.
**Notes:**
- Cursor pagination is the "correct" choice at scale but complex with multi-column `orderBy` (due_at + priority + updated_at)
- Offset pagination is fine for hundreds of tasks; revisit if the list grows significantly
- The UI is currently fully client-side after initial load, so "load more" can append to the existing task list without a full page reload

### Missing composite DB index `[status, due_at]`
**File:** `prisma/schema.prisma`
The most common queries (overdue, today, waiting views) filter on both `status` and `due_at`. A single `due_at` index exists; the composite would significantly cut query time.
**Fix:** Add `@@index([status, due_at])` to the Task model.

### `selectedDuePreset` is redundant state
**File:** `src/features/tasks/components/task-edit-overlay.tsx:131`
`selectedDuePreset` duplicates information already in `draft.due_at` — it can be derived via the existing `matchingDuePreset()` function, creating two sources of truth that can drift.
**Fix:** Replace `useState` with `useMemo(() => matchingDuePreset(draft.due_at), [draft.due_at])` and remove `setSelectedDuePreset` calls.

### Stringly-typed status values in `task-service.ts`
**File:** `src/server/tasks/service.ts:129-138`
Raw string literals `"active"`, `"waiting"`, `"done"` in switch/case logic despite `TASK_STATUSES` existing as a typed constant. Violates the coding standards in CLAUDE.md.
**Fix:** Reference `TASK_STATUSES` values directly.

### Auth cookie `secure` flag logic fragile
**File:** `src/app/api/auth/login/route.ts:25-30`
Trusts `x-forwarded-proto` header without a `TRUST_PROXY` guard — can be spoofed if the app is exposed directly rather than behind a reverse proxy.
**Fix:** Only trust the forwarded header when `process.env.TRUST_PROXY === "true"`.

### ~~`proxy.ts` is never wired as middleware~~
**Superseded.** Next.js 16 uses `src/proxy.ts` directly as the middleware file (confirmed by the build output: `ƒ Proxy (Middleware)`). No `src/middleware.ts` is needed; creating one causes a build conflict. The CLAUDE.md comment "Auth proxy (Next.js 16 middleware convention)" is correct. This item is closed.

### Color maps rebuilt on every render
**Files:** `src/features/tasks/components/task-card.tsx:73`, `src/features/tasks/components/task-edit-overlay.tsx:143`
`Object.fromEntries(...)` called unconditionally in the render body; creates new objects on every render even when configs haven't changed.
**Fix:** Wrap both with `useMemo`.

## P3 — Clean Up When Convenient

### `displayCode()` / `displayStatus()` capitalisation duplicated across task UI files
Same `.charAt(0).toUpperCase() + .slice(1)` pattern in `src/features/tasks/components/task-dashboard.tsx`, `src/features/tasks/components/task-edit-overlay.tsx`, `src/features/tasks/components/task-card.tsx`, and `src/features/tasks/components/new-task-view.tsx`.
**Fix:** Extract to `src/lib/format.ts` and import everywhere.

### `splitTags()` duplicated in two places
`src/features/tasks/components/task-edit-overlay.tsx` and `src/features/tasks/hooks/use-task-actions.ts` both implement `value.split(",").map(t => t.trim()).filter(Boolean)`.
**Fix:** Export from `create-task-model.ts` and import in both places.

### Three separate `SelectShell` component definitions
Near-identical implementations in `src/features/tasks/components/new-task-view.tsx`, `src/features/tasks/components/create-task-panel.tsx`, and `src/features/tasks/components/task-edit-form-fields.tsx` (the exported one that the others ignore).
**Fix:** Add an optional `icon` prop to the exported `SelectShell` in `task-edit-form-fields.tsx` and delete the local copies.

### Date range constants computed twice in `task-dashboard.tsx`
**File:** `src/features/tasks/components/task-dashboard.tsx`
`startOfDay(new Date())` and `endOfDay(new Date())` appear in both the `stats` useMemo and the `groups` useMemo.
**Fix:** Compute once and pass into both.

### Unstable React keys in `task-description-markdown.tsx`
**File:** `src/features/tasks/components/task-description-markdown.tsx`
Array indices used as keys in list rendering — causes unnecessary re-renders when description text changes.
**Fix:** Use stable content-based keys generated at parse time.

### `tags` prop passed to `task-filters.tsx` but never rendered
**File:** `src/features/tasks/components/task-filters.tsx`
The prop is typed and received but there is no tag filter UI.
**Fix:** Remove the prop or implement tag filtering.

### `PRIORITY_DISPLAY` mapping duplicated in `task-edit-overlay.tsx` and `task-card.tsx`
**Files:** `src/features/tasks/components/task-edit-overlay.tsx`, `src/features/tasks/components/task-card.tsx`
Identical constant defined in two files.
**Fix:** Move to `src/lib/constants.ts`.

# `src/server` — Home Backend Domain

This folder is the canonical location for Home-owned server-side business logic. Code here runs on the server only and should not be imported from client components.

## Boundary

```
src/app       Thin Next.js routes, pages, route handlers, and server component composition.
src/features  Product UI and client-facing feature composition.
src/server    Server-side domain and business logic (this folder).
src/lib       Shared infrastructure and low-level utilities (Prisma client, auth, validators, etc.).
```

## Import Rules

- `src/app` may import from `src/server` for server components and route handlers.
- `src/features` and other client components must not directly import server modules. They should call server-backed routes or server actions instead.
- New backend business logic should not be added to `src/lib` unless it is genuinely shared infrastructure.
- New task-domain logic should go through `src/server/tasks`.

## Current Modules

- `src/server/tasks` — Durable task domain. All task CRUD, search, events, categories, projects, and tag logic. Public exports live in `src/server/tasks/index.ts`.
- `src/server/memory` — Read-only consumer for FedOS Memory and the approved Memory Digest. Loads files from `FEDOS_MEMORY_ROOT` and `FEDOS_DIGEST_ROOT`, computes a stable source hash, and reports digest staleness. Never writes to Memory or to the digest.
- `src/server/sources` — Signal ingestion and shaping for briefing generation. `sources/outlook` owns Home-native Microsoft Graph mail/calendar ingestion, token-file loading, and normalization into `BriefingSignal[]`; `llm-first-signals.ts` owns hygiene filters, dedup, compaction, and prompt-line formatting.
- `src/server/llm` — Provider wrappers for the LLM. Defines a small `BriefingLLMClient` interface and a lazy Anthropic implementation; the SDK is loaded on demand so smoke tests can use a fake client.
- `src/server/briefings` — Persistence for `BriefingPackage` and attached `ProposedAction` rows.
- `src/server/proposals` — Proposed action approval / rejection / defer logic, including approval into durable tasks.
- `src/server/intelligence` — Briefing generation orchestrator (`generateBriefingPackage`) plus the system prompt, Zod-validated output contract, and prompt-block builder.

`src/lib/task-service.ts` is kept as a compatibility re-export of `@/server/tasks` and should not be added to. Update call sites to import from `@/server/tasks` when convenient.

## Intended Future Modules

These are documented for planning only and should not be scaffolded until a feature actually owns them:

```
src/server/debug         Home-owned intelligence/debug console helpers, if the debug UI needs server support.
src/server/revisions     Briefing challenge, feedback, and revision logic, once HCI-09 starts.
```

Add a module only when it owns real behavior. Do not create empty folders.

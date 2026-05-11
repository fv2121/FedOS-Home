# Backlog

## P0 — Home-Centered Intelligence Migration

Canonical plan: [HOME_CENTERED_INTELLIGENCE_INTEGRATION.md](HOME_CENTERED_INTELLIGENCE_INTEGRATION.md)

| Status | ID | Work Item | Notes |
|---|---|---|---|
| Done | HCI-00 | Deployment and workspace readiness | GitHub renamed, Railway confirmed, VS Code workspace created, build/Prisma checks passed. |
| Next | HCI-01 | Home domain model for briefings | Add Prisma models for briefing packages, revisions, proposed actions, review decisions, and feedback. |
| Planned | HCI-02 | Home server module structure | Add internal backend boundaries for briefing, intelligence, memory, sources, LLM, and tasks. |
| Planned | HCI-03 | Memory Digest consumption in Home | Consume approved Memory Digest while keeping FedOS Memory separate and canonical. |
| Planned | HCI-04 | Briefing package generation service | Move useful LLM-first briefing generation into the Home backend. |
| Planned | HCI-05 | Briefing API routes | Add product APIs for briefing packages, feedback, and proposal decisions. |
| Planned | HCI-06 | Mobile-first, desktop-continuous briefing UI | Review briefings and convert approved proposed actions into canonical Home tasks. |
| Planned | HCI-07 | Chat feedback and briefing revisions | Challenge/correct briefings and preserve revised versions. |
| Later | HCI-08 | Voice input layer | Add voice over the same command and feedback contracts. |
| Later | HCI-09 | Intelligence repo repositioning | Retire, archive, or keep FedOS Intelligence as lab-only after Home reaches parity. |

---

## P0/P1 — Migrated Intelligence Backlog Carry-Over

These items were reviewed from the former FedOS Intelligence backlog. They are no longer treated as active product backlog inside the Intelligence repo. Items that remain relevant are carried here because FedOS Home is the target product runtime.

| Status | ID | Former Intelligence Item | Decision | Priority / Timing |
|---|---|---|---|---|
| Planned | MIG-SEC-01 | Replace PoC token file storage with production-grade secret store | Move to Home. Required once Home owns Microsoft 365 ingestion and any unattended/scheduled runs. | Before production M365 integration |
| Owner confirmation | MIG-SEC-02 | Verify or complete Microsoft 365 client secret rotation | Move to Home as a manual security verification item. Close once old secret deletion is confirmed. | Now / before further M365 work |
| Partially superseded | MIG-SEC-03 | Upgrade interim Intelligence API auth | Do not port the exact shared-token model. Home already has session auth; review auth again when adding briefing/product APIs, scheduled jobs, or machine-to-machine endpoints. | Before exposed briefing APIs |
| Planned | MIG-INT-01 | Suggest stakeholder and Memory-update candidates for review | Move to Home as future Memory-update suggestion capability. Keep review-based; never silently write Memory. | After HCI-07/outcome feedback |
| Planned | MIG-INT-02 | Add free-time analysis and proactive calendar blocking suggestions | Move to Home as future time intelligence inside morning briefing/calendar reasoning. | After HCI-04/HCI-06 |
| Later | MIG-COST-01 | Investigate and optionally enable provider prompt caching | Move to Home as future optimization, mainly useful for interactive chat/revision loops rather than once-daily briefings. | After HCI-07 |
| Later | MIG-COST-02 | Add optional two-stage LLM-first pipeline | Move to Home as optional cost/quality optimization after baseline Home briefing generation is working. | After HCI-04 quality baseline |
| Production gate | MIG-COST-03 | Add hard token budget gate before production use | Move to Home as a production/unattended-run safety gate. Lower priority during manual testing. | Before scheduled unattended production |
| Reference only | MIG-COST-REF | Completed LLM-first cost-management work | Do not reopen as backlog. Port useful pieces through HCI-03/HCI-04: approved Memory Digest, compact prompts, cache-ready structure, source/thread compaction. | Covered by HCI-03/HCI-04 |

---

## P1 — Fix Soon

### N+1 database queries in `connectTagsByName`
**File:** `src/lib/task-service.ts:194-214`
One upsert per tag inside a `for` loop. 5 tags = 10 queries. Scales badly as usage grows.
**Fix:** Batch tag upserts with `createMany({ skipDuplicates: true })`, then bulk-insert `taskTag` relations in a single transaction.

### Rate-limiter memory leak
**File:** `src/lib/rate-limit.ts`
The `attempts` Map filters old timestamps on every check but never deletes keys whose arrays become empty, so the Map grows indefinitely in a long-running process.
**Fix:** After the filter, add `if (timestamps.length === 0) attempts.delete(key); else attempts.set(key, timestamps);`

## P2 — Address Soon

### Pagination
**File:** `src/lib/task-service.ts` — `searchTasks`, and `src/app/page.tsx`
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
**File:** `src/components/task-edit-overlay.tsx:131`
`selectedDuePreset` duplicates information already in `draft.due_at` — it can be derived via the existing `matchingDuePreset()` function, creating two sources of truth that can drift.
**Fix:** Replace `useState` with `useMemo(() => matchingDuePreset(draft.due_at), [draft.due_at])` and remove `setSelectedDuePreset` calls.

### Stringly-typed status values in `task-service.ts`
**File:** `src/lib/task-service.ts:129-138`
Raw string literals `"active"`, `"waiting"`, `"done"` in switch/case logic despite `TASK_STATUSES` existing as a typed constant. Violates the coding standards in CLAUDE.md.
**Fix:** Reference `TASK_STATUSES` values directly.

### Auth cookie `secure` flag logic fragile
**File:** `src/app/api/auth/login/route.ts:25-30`
Trusts `x-forwarded-proto` header without a `TRUST_PROXY` guard — can be spoofed if the app is exposed directly rather than behind a reverse proxy.
**Fix:** Only trust the forwarded header when `process.env.TRUST_PROXY === "true"`.

### `proxy.ts` is never wired as middleware
**File:** `src/proxy.ts`
Exports a `proxy()` function and `config` object but no `middleware.ts` imports it, so unauthenticated users are not redirected server-side.
**Fix:** Either create `src/middleware.ts` with `export { proxy as middleware, config }`, or delete the file and remove the CLAUDE.md reference.

### Color maps rebuilt on every render
**Files:** `src/components/task-card.tsx:69`, `src/components/task-edit-overlay.tsx:143`
`Object.fromEntries(...)` called unconditionally in the render body; creates new objects on every render even when configs haven't changed.
**Fix:** Wrap both with `useMemo`.

## P3 — Clean Up When Convenient

### `displayCode()` / `displayStatus()` capitalisation duplicated across 5 files
Same `.charAt(0).toUpperCase() + .slice(1)` pattern in `task-dashboard.tsx`, `task-edit-overlay.tsx`, `task-card.tsx`, `new-task-view.tsx`.
**Fix:** Extract to `src/lib/format.ts` and import everywhere.

### `splitTags()` duplicated in two places
`task-edit-overlay.tsx` and `use-task-actions.ts` both implement `value.split(",").map(t => t.trim()).filter(Boolean)`.
**Fix:** Export from `create-task-model.ts` and import in both places.

### Three separate `SelectShell` component definitions
Near-identical implementations in `new-task-view.tsx`, `create-task-panel.tsx`, and `task-edit-form-fields.tsx` (the exported one that the others ignore).
**Fix:** Add an optional `icon` prop to the exported `SelectShell` in `task-edit-form-fields.tsx` and delete the local copies.

### Date range constants computed twice in `task-dashboard.tsx`
`startOfDay(new Date())` and `endOfDay(new Date())` appear in both the `stats` useMemo and the `groups` useMemo.
**Fix:** Compute once and pass into both.

### Unstable React keys in `task-description-markdown.tsx`
Array indices used as keys in list rendering — causes unnecessary re-renders when description text changes.
**Fix:** Use stable content-based keys generated at parse time.

### `tags` prop passed to `task-filters.tsx` but never rendered
The prop is typed and received but there is no tag filter UI.
**Fix:** Remove the prop or implement tag filtering.

### `PRIORITY_DISPLAY` mapping duplicated in `task-edit-overlay.tsx` and `task-card.tsx`
Identical constant defined in two files.
**Fix:** Move to `src/lib/constants.ts`.

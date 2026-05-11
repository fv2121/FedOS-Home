# FedOS Home-Centered Intelligence Integration

## Purpose

This document is the working proposal for moving from a separate Intelligence-to-Home handoff model to a Home-centered product architecture.

The earlier handoff proposal assumed that FedOS Intelligence would remain a separate runtime that generated briefing packages and proposed actions for FedOS Home to consume. That separation is becoming less attractive as the target product becomes clearer.

At MVP level, FedOS Home is not just the final task list. It is the place where Federico should:
- open the morning briefing
- review the overall interpretation of the day
- inspect priorities, recommendations, risks, and opportunities
- accept, edit, reject, or defer proposed actions
- start lightweight review on mobile and continue deeper task work on desktop
- turn approved proposals into canonical tasks
- question the briefing through chat, and later voice
- ask the system to rethink and produce a revised briefing
- manage the resulting tasks independently of the LLM

Given that product direction, the recommended target architecture is:

```text
FedOS Memory
-> FedOS Home backend intelligence module
-> Home-owned briefing packages, recommendations, proposed actions, and tasks
-> Home mobile-first and desktop-continuous review, chat, voice, approval, and task management
-> Home outcomes and feedback
-> future intelligence runs and Memory-update suggestions
```

FedOS Memory remains outside FedOS Home. The Memory Digest is the approved bridge between Memory and the reasoning layer, not a sign that Memory itself should be merged into Home.

## Recommendation

Move the product runtime for intelligence into FedOS Home.

The FedOS Intelligence project should become one of these during the transition:
- a reference implementation while logic is migrated into Home
- an experimentation/debug harness for developing new reasoning flows
- a source module that is extracted into a shared package and imported by Home

The long-term MVP product should avoid a heavy cross-application handoff where Intelligence has to send almost the entire briefing experience to Home. Instead, Home should own the user-facing product, the persistence model, and the task lifecycle, while keeping intelligence code internally modular.

This does not mean putting LLM orchestration in the mobile client. It means the FedOS Home project owns the server-side intelligence runtime.

## Execution Summary

Status legend:
- `Done`: completed or agreed
- `Next`: recommended next implementation item
- `Planned`: agreed direction, not started
- `Later`: intentionally sequenced after MVP foundations
- `Deferred`: optional or postponed

| Priority | Status | ID | Change / Work Item | What It Means | Detailed View |
|---|---|---|---|---|---|
| P0 | Done | ARCH-01 | Home-centered target architecture | FedOS Home becomes the MVP product runtime; Intelligence becomes module/reference/lab during migration. | [Recommendation](#recommendation), [Product Boundaries](#product-boundaries) |
| P0 | Done | DB-01 | Single Home product database | FedOS Home PostgreSQL is the product database; Intelligence SQLite/SQLModel is transitional or lab-only. | [Database Architecture](#database-architecture) |
| P0 | Done | SETUP-01 | GitHub/Railway rename cleanup | GitHub repo renamed to `FedOS-Home`, local `origin` updated, fetch verified, Railway confirmed. | [GitHub And Repository Hygiene](#github-and-repository-hygiene), [Immediate Tracker](#immediate-tracker) |
| P0 | Done | SETUP-02 | VS Code workspace and readiness checks | `FedOS.code-workspace` created; Home build, Prisma generate, and migration status passed. | [VS Code Workspace](#vs-code-workspace), [HCI-00](#hci-00-deployment-and-workspace-readiness) |
| P0 | Deferred | SETUP-03 | Local Home folder rename | Home working tree is clean, but local folder rename from `fedos-tasks` to `fedos-home` is optional. | [Open Questions](#open-questions) |
| P1 | Next | HCI-01 | Home domain model for briefings | Add Home-owned Prisma records for briefing packages, revisions, proposed actions, review decisions, and feedback. | [HCI-01](#hci-01-home-domain-model-for-briefings) |
| P2 | Planned | HCI-02 | Home server module structure | Create clean internal backend boundaries for briefing, intelligence, memory, sources, LLM, and tasks. | [HCI-02](#hci-02-home-server-module-structure) |
| P3 | Planned | HCI-03 | Memory Digest consumption in Home | Home consumes approved Memory Digest while FedOS Memory remains separate and canonical. | [HCI-03](#hci-03-memory-digest-consumption-in-home) |
| P4 | Planned | HCI-04 | Briefing package generation service | Move useful LLM-first briefing generation into the Home backend. | [HCI-04](#hci-04-briefing-package-generation-service) |
| P5 | Planned | HCI-05 | Briefing API routes | Add product APIs for briefing packages, feedback, and proposal decisions. | [HCI-05](#hci-05-briefing-api-routes) |
| P6 | Planned | HCI-06 | Mobile-first, desktop-continuous briefing UI | Make Home the place where the briefing is reviewed and proposals become tasks. | [HCI-06](#hci-06-mobile-first-desktop-continuous-briefing-ui) |
| P7 | Planned | HCI-07 | Chat feedback and briefing revisions | Let Federico challenge the briefing and generate preserved revisions. | [HCI-07](#hci-07-chat-feedback-and-briefing-revisions) |
| P8 | Later | HCI-08 | Voice input layer | Add voice as an input method over the same command and feedback contracts. | [HCI-08](#hci-08-voice-input-layer) |
| P9 | Later | HCI-09 | Intelligence repo repositioning | Retire, archive, or keep FedOS Intelligence as lab-only after Home reaches runtime parity. | [HCI-09](#hci-09-intelligence-repo-repositioning) |
| P9 | Later | MEM-01 | Memory repository decision | Create a separate FedOS Memory repo when Memory needs durable versioning and review history. | [Open Questions](#open-questions) |

## Product Boundaries

### FedOS Memory

FedOS Memory remains the canonical source of long-lived user context.

It owns:
- durable personal context
- operating principles
- priorities and preferences
- stakeholder context
- stable strategy and identity context
- source Memory files

It does not become part of the Home app.

The Memory Digest remains a derived, reviewable, LLM-authored artifact. It can be consumed by the Home intelligence module once that module exists, but the digest is not the source of truth. The source Memory files remain authoritative.

Memory updates should remain review-based. Intelligence or Home may suggest Memory updates, but neither should silently rewrite FedOS Memory.

### FedOS Home

FedOS Home becomes the product shell and command center.

Home should be mobile-first, not mobile-only. The likely daily pattern is that Federico reviews and triages the briefing on mobile, possibly while commuting, then continues deeper task work on desktop once at work. The two surfaces should share the same underlying product state rather than behave like separate products.

It should own:
- mobile and desktop user experience
- morning briefing display
- briefing package persistence
- proposed action review
- chat and later voice interaction
- briefing revision history
- canonical task creation after approval
- task state, priority, due dates, projects, categories, and event history
- outcome feedback used by future reasoning

Home owns the database records that represent the product experience:
- briefing packages
- briefing revisions
- proposed actions
- review decisions
- approved tasks
- task events
- feedback events

### FedOS Intelligence

FedOS Intelligence remains valuable, but its role changes.

It currently owns useful capabilities:
- LLM-first morning briefing logic
- approved Memory Digest consumption
- cache-ready prompt structure
- compact signal formatting
- thread/source compaction
- source ingestion patterns
- debug tooling for reasoning experiments

Those capabilities should be migrated, packaged, or reimplemented inside the FedOS Home backend over time.

The Intelligence repo should not remain the long-term owner of the runtime product experience if Home is where the briefing conversation, approval loop, and task management happen.

## Database Architecture

The target architecture should use one product database: the FedOS Home PostgreSQL database.

Current state:
- FedOS Intelligence uses a local SQLModel database, defaulting to SQLite at `agent_os.db`.
- FedOS Home uses Prisma with PostgreSQL, currently configured as the `fedos_tasks` database.
- FedOS Home already owns canonical approved tasks, task events, task sources, projects, categories, and tags.

Target state:
- FedOS Home PostgreSQL becomes the single product database.
- Briefing packages, briefing revisions, proposed actions, review decisions, feedback events, task outcomes, and Memory Digest provenance should be stored in the Home database.
- FedOS Intelligence's local database becomes transitional, reference-only, or lab/debug-only.
- No long-term product sync should be required between an Intelligence database and a Home database.

The current physical database name `fedos_tasks` can remain during MVP implementation to avoid churn. Conceptually, it should be treated as the FedOS Home product database. A later tidy-up can rename the database to something like `fedos_home` if that becomes worth the migration effort.

New product data should not be added to the Intelligence database unless it is explicitly temporary lab/debug state.

FedOS Memory remains separate from this database decision:
- Memory files remain canonical outside Home.
- The approved Memory Digest remains a derived artifact.
- Home stores only the digest provenance needed for briefing traceability, such as digest hash, freshness/staleness state, approved timestamp, and source version metadata.

## Why Change The Architecture

The separate handoff model creates increasing integration cost:
- Home needs almost the entire Intelligence output, not just proposed actions.
- Chat and voice require stateful back-and-forth across the two systems.
- Briefing revisions need shared package IDs, revision IDs, feedback IDs, and status sync.
- Proposed actions need duplicate prevention and outcome sync across two stores.
- Home task creation depends on Intelligence proposal state.
- Intelligence learning depends on Home outcome state.

That means the handoff starts to look like a shadow product API between two halves of one product.

The Home-centered model removes much of that friction:
- briefing packages and tasks live in one product database
- chat/voice can operate against local Home state
- proposed actions can become tasks without cross-app state reconciliation
- outcome feedback is immediately available to future reasoning
- the mobile and desktop apps can be designed around one coherent product model
- authentication and deployment are simpler for MVP

The main risk is that Home becomes too broad. The mitigation is to keep strict internal module boundaries inside Home rather than using a separate app boundary.

## Target Product Loop

```text
1. FedOS Home backend starts a morning briefing run.
2. The Home intelligence module loads fresh source signals.
3. The module loads the approved Memory Digest, plus any required dynamic context.
4. The module generates a BriefingPackage.
5. Home stores the BriefingPackage, source refs, proposed actions, and model metadata.
6. Federico opens Home, most likely on mobile first, and reviews the briefing.
7. Federico accepts, edits, rejects, or defers proposed actions.
8. Accepted proposed actions become canonical Home tasks.
9. Federico can challenge the briefing through chat, and later voice.
10. Reasoning feedback creates a new BriefingPackage revision.
11. Federico can continue working the approved tasks on desktop from the same Home state.
12. Task outcomes and review decisions feed future briefing runs.
13. Repeated patterns can become reviewable Memory-update suggestions.
```

## Internal Contracts Still Matter

Moving intelligence into Home does not remove the need for contracts. It changes their purpose.

Previously, contracts were inter-application handoff contracts. In the Home-centered model, they become internal product contracts between:
- source ingestion
- Memory context loading
- reasoning
- briefing package storage
- Home UI
- task creation
- feedback and revision loops

The most important contracts remain:
- `BriefingPackage`
- `BriefingRevision`
- `ProposedAction`
- `BriefingFeedback`
- `ReviewDecision`
- `TaskOutcomeEvent`
- `MemoryUpdateSuggestion`

These contracts should be designed cleanly even if they live in one Home backend.

## Core Data Model Direction

### BriefingPackage

A durable Home-owned record representing one user-visible briefing.

Suggested fields:
- `package_id`
- `brief_run_id`
- `created_at`
- `context_mode`
- `status`
- `headline`
- `summary`
- `priorities`
- `recommendations`
- `risks`
- `opportunities`
- `source_refs`
- `memory_digest_hash`
- `memory_digest_stale`
- `model`
- `prompt_version`

### BriefingRevision

A durable record for a revised version of a briefing after feedback.

Suggested fields:
- `revision_id`
- `package_id`
- `parent_revision_id`
- `created_at`
- `revision_reason`
- `user_feedback_ref`
- `summary_of_changes`
- revised briefing content

The original package should not be silently overwritten. Revisions should preserve the reasoning trail.

### ProposedAction

A reviewable suggestion attached to a briefing package or revision.

Suggested fields:
- `proposal_id`
- `package_id`
- `revision_id`
- `title`
- `description`
- `rationale`
- `uncertainty`
- `suggested_priority`
- `suggested_due_at`
- `suggested_project`
- `suggested_category`
- `source_refs`
- `status`

A proposed action is not a task.

### ReviewDecision

A Home-owned record of what Federico did with a proposed action.

Suggested decisions:
- `approved`
- `approved_with_edits`
- `rejected`
- `deferred`
- `ignored`

On approval, Home creates a canonical task and links it back to the proposal.

### BriefingFeedback

A user instruction or correction given through chat or voice.

Examples:

```text
"Actually, that is not the priority."
"This one matters more."
"You forgot about this."
"Accept that action."
"Reject the second one."
"Accept that one, but change the title to ..."
```

The system should distinguish between:
- deterministic commands that change Home state
- reasoning feedback that asks Intelligence to rethink

Voice should be an input layer over the same feedback and command contracts, not a separate architecture.

## Implementation Planning Notes

This migration should start with product naming and project hygiene before moving substantial runtime code.

### Naming Tidying

Recommended naming:
- Product/app: `FedOS Home`
- Home package name: `fedos-home`
- Current Home database: keep physical `fedos_tasks` for MVP, treat conceptually as the Home product database
- Future optional database name: `fedos_home`
- Home GitHub repo: renamed from `FedOS-Tasks` to `FedOS-Home`
- Intelligence repo: keep `FedOS-Intelligence` only as the reference/lab repo during migration
- Future Memory repo: create a separate `FedOS-Memory` repo when Memory needs versioning, review history, and collaboration
- Avoid using `Action` for Intelligence-owned suggestions; use `ProposedAction`
- Reserve `Task` for approved Home-owned work items

The Home package already uses `fedos-home`, which is good. The GitHub repository has been renamed to `FedOS-Home`, and the local `origin` remote has been updated to `https://github.com/fv2121/FedOS-Home.git`.

Long term, there should not be separate Home and Intelligence runtime repos. Home should absorb the runtime Intelligence capability. The Intelligence repo can remain as a temporary reference/lab and can later be archived, retired, or kept only for experiments.

### Recommended Home Folder Structure

Keep the Home codebase modular inside one app boundary.

Suggested direction:

```text
src/app/
  page.tsx
  briefing/
    page.tsx
  tasks/
    page.tsx
  api/
    briefings/
      route.ts
    briefings/[id]/
      route.ts
    briefings/[id]/feedback/
      route.ts
    proposals/[id]/decision/
      route.ts

src/features/
  briefing/
  tasks/
  proposals/
  feedback/

src/server/
  briefing/
  intelligence/
  llm/
  memory/
  sources/
  tasks/

prisma/
  schema.prisma
  migrations/
```

Principles:
- UI lives under `src/app` and `src/features`.
- Server orchestration lives under `src/server`.
- Prisma remains the persistence boundary.
- Existing task APIs can remain while briefing/product APIs use product naming rather than only `/api/llm`.
- Debug-only Intelligence tools should not be copied into the Home user path unless they serve the product.

### VS Code Workspace

Create a parent-level workspace once the migration begins, for example `FedOS.code-workspace`.

Suggested workspace folders:
- `FedOS Home`: `/Users/federico_valori/Documents/FedOS-Home/fedos-tasks`
- `FedOS Intelligence`: `/Users/federico_valori/Documents/FedOS-Intelligence`
- `FedOS Memory`: the canonical Memory project path

Suggested workspace intent:
- make cross-project migration easier
- keep search usable across Home, Intelligence, and Memory
- exclude noisy generated folders such as `node_modules`, `.next`, `frontend/node_modules`, `__pycache__`, and local database files
- keep Home and Intelligence terminals easy to run side by side during migration

The workspace should not imply that Home and Intelligence remain separate runtime repos long term. It is a local development convenience for migration. The intended long-term runtime repo is Home, with Memory separate once it needs its own repo.

### GitHub And Repository Hygiene

Recommended sequence:

1. Do not rename or restructure while there are unrelated dirty working-tree changes in Home.
2. GitHub repository rename is complete: `FedOS-Tasks` -> `FedOS-Home`.
3. Local `origin` remote update is complete.
4. Keep FedOS Intelligence as a temporary reference/lab repo during migration, not as a long-term runtime dependency.
5. Create a separate FedOS Memory repo when Memory needs durable versioning and review history.
6. Avoid a monorepo until there is a strong reason. The preferred long-term shape is Home runtime repo plus Memory source-of-truth repo.
7. Add migration work as explicit Home backlog items rather than scattering it across both Home and Intelligence.

If a repo rename happens, GitHub should preserve redirects, but local documentation and deployment settings should still be checked afterward.

## Migration Strategy

Avoid a big-bang rewrite.

The safest path is to migrate the runtime responsibility into Home in phases while preserving the working Intelligence implementation as a reference.

### Phase 0: Architecture Decision

Goal:
Confirm that Home is the MVP product runtime and Intelligence becomes a module/reference/lab.

Work:
- record this architecture decision in documentation
- stop designing new features around cross-app handoff unless needed temporarily
- define which Intelligence capabilities must migrate into Home
- decide whether to port code directly or extract a shared package
- confirm the Home PostgreSQL database as the single product database
- decide naming cleanup order for repo, folder, database, and docs

Output:
- agreed target architecture
- migration checklist

### Phase 1: Home Domain Model

Goal:
Create the product model inside Home before moving the full reasoning engine.

Work:
- add Home models/tables for `BriefingPackage`, `BriefingRevision`, `ProposedAction`, `ReviewDecision`, and `BriefingFeedback`
- link approved tasks back to proposals
- keep Home task creation canonical and approval-based
- define status lifecycles for packages and proposals
- store Memory Digest provenance with briefing packages

Output:
- Home can store briefing packages and proposed actions as first-class product records

### Phase 2: Intelligence Runtime Migration

Goal:
Move the useful Intelligence runtime into the Home backend.

Work:
- migrate or package LLM-first briefing generation
- migrate approved Memory Digest consumption
- migrate compact source formatting and thread/source compaction
- preserve source refs, Memory Digest provenance, model metadata, and prompt version metadata
- keep expensive/debug-only tooling out of the user path

Output:
- Home can generate and store its own briefing packages without depending on a separate Intelligence service

### Phase 3: Home Morning Briefing Experience

Goal:
Make Home the place where the briefing is actually used across mobile and desktop.

Work:
- add a mobile-first, desktop-capable morning briefing UI
- show summary, priorities, recommendations, risks, opportunities, uncertainty, and source-backed rationale
- show proposed actions separately from real tasks
- support approve, edit and approve, reject, defer, and leave pending
- support continuity from mobile triage to desktop task follow-through
- create canonical tasks only after approval

Output:
- Federico can use the morning briefing on mobile or desktop and convert proposed actions into real Home tasks

### Phase 4: Chat Feedback And Revision Loop

Goal:
Let Federico challenge the briefing and request a revised version.

Work:
- add chat feedback UI
- map deterministic commands to Home state changes where possible
- send reasoning feedback to the Home intelligence module
- generate a new `BriefingRevision`
- show what changed between revisions

Output:
- Home can host the iterative reasoning loop without cross-app orchestration

### Phase 5: Voice Layer

Goal:
Add voice without changing the architecture.

Work:
- transcribe voice into the same command/feedback pathway
- support deterministic action commands by voice
- support reasoning feedback by voice
- require confirmation for consequential changes where appropriate

Output:
- voice becomes a natural input layer over the Home intelligence experience

### Phase 6: Retire Or Reposition FedOS Intelligence

Goal:
Clarify what remains in the Intelligence repo after Home owns the product runtime.

Options:
- retire it once migration is complete
- keep it as a lab for testing new reasoning flows
- keep shared logic in a package consumed by Home
- keep only standalone debug tooling that is not part of the MVP product

Output:
- no duplicate product runtime
- no long-term requirement for Home to synchronize with a separate Intelligence app

## Memory Digest Placement

The Memory Digest is already a useful bridge between FedOS Memory and Intelligence.

In the target Home-centered architecture:
- FedOS Memory remains outside Home
- source Memory files remain canonical
- the approved digest remains derived and reviewable
- Home's intelligence module consumes the approved digest
- digest provenance is stored with each briefing package
- stale digest warnings remain visible before or during briefing generation

The physical digest artifact can be handled in one of three ways:

1. Keep it where the current Intelligence implementation stores it during transition.
2. Move derived digest artifacts into Home backend storage when Home owns the runtime.
3. Use a configured shared derived-artifact path, such as an environment-controlled digest root.

Recommendation:
During migration, keep the current digest implementation working. Once Home owns briefing generation, move digest consumption and approved digest metadata into Home's backend runtime. Do not move FedOS Memory itself into Home.

## What Changes From The Earlier Handoff Proposal

The previous proposal said:

```text
Intelligence generates briefing packages.
Home pulls packages from Intelligence.
Home reviews proposals and creates tasks.
Home sends outcomes back to Intelligence.
```

The updated proposal says:

```text
Home owns briefing generation, package storage, review, conversation, task creation, and outcomes.
The intelligence capability lives inside Home's backend as a clean module.
Memory remains separate and is accessed through approved Memory context, especially the Memory Digest.
```

That means:
- no long-term Intelligence-to-Home proposal outbox
- no long-term cross-app package sync
- no long-term duplicate briefing state
- no need for Intelligence to write into Home
- no need for Home to pull the full product experience from a separate app

The `BriefingPackage` and `ProposedAction` concepts remain valuable, but they become Home-owned product records.

## Knock-On Changes

### FedOS Home

- Add server-side intelligence modules.
- Use the Home PostgreSQL database as the single product database.
- Add briefing package and revision persistence.
- Add proposed action review records.
- Add mobile-first, desktop-capable briefing UI.
- Add chat feedback and later voice input.
- Keep task creation canonical and approval-based.
- Link approved tasks back to proposals and briefing packages.
- Feed outcomes into future reasoning.

### FedOS Intelligence

- Treat as reference implementation during migration.
- Treat the local SQLModel/SQLite database as transitional or lab-only.
- Avoid expanding long-term user-facing workflows here.
- Extract or port LLM-first briefing logic into Home.
- Extract or port Memory Digest consumption into Home.
- Keep debug experiments useful but separate from the MVP product runtime.

### FedOS Memory

- Stay separate.
- Continue to provide canonical Memory files.
- Continue supporting the approved Memory Digest flow.
- Receive only reviewable Memory-update suggestions.

### Documentation

- Architecture has been updated to reflect Home-centered runtime and Home PostgreSQL as the product database.
- Project Brief has been updated to describe the intelligence capability moving into Home.
- Continue updating any remaining docs that describe the Intelligence database as a long-term product source of truth.
- Fold the final implementation plan into the main backlog once scope is agreed.

## Home Implementation Backlog Draft

This is the first implementation backlog for the Home-centered migration. It should be folded into the Home backlog once the scope is agreed.

### HCI-00: Deployment And Workspace Readiness

Status: Done

Goal:
Make sure the renamed Home repo and local workspace are ready before product code changes.

Work:
- confirm Railway is connected to `fv2121/FedOS-Home` (done)
- leave the local Home folder as `fedos-tasks` until current Home changes are committed or parked (committed; rename remains optional)
- create a VS Code workspace for Home, Intelligence, and Memory once the Memory path is confirmed (done: `FedOS.code-workspace`)
- confirm Home build, Prisma generate, and migration status still work after the repo rename (done)

Outcome:
Home is cleanly connected to GitHub and ready for migration work.

### HCI-01: Home Domain Model For Briefings

Status: Next

Goal:
Add the Home-owned product records that replace cross-app handoff state.

Work:
- add Prisma models for `BriefingPackage`, `BriefingRevision`, `ProposedAction`, `ReviewDecision`, and `BriefingFeedback`
- link approved Home tasks back to proposed actions and briefing packages
- store Memory Digest provenance on briefing packages
- define package, revision, proposal, and review-decision statuses
- add migrations and seed/demo data only where useful

Outcome:
FedOS Home can store the morning briefing product state in the Home PostgreSQL database.

### HCI-02: Home Server Module Structure

Status: Planned

Goal:
Create clean internal Home backend boundaries before porting runtime logic.

Work:
- add `src/server/briefing`
- add `src/server/intelligence`
- add `src/server/memory`
- add `src/server/sources`
- add `src/server/llm`
- keep task-specific business logic under the existing task service or a future `src/server/tasks`
- avoid copying debug UI or lab-only code from Intelligence into the product path

Outcome:
Home has a clear place for intelligence runtime code without turning the app into a tangle.

### HCI-03: Memory Digest Consumption In Home

Status: Planned

Goal:
Let Home consume the approved Memory Digest while keeping FedOS Memory separate.

Work:
- port or reimplement approved digest loading from the Intelligence project
- preserve digest hash, approved timestamp, source metadata, and stale/fresh state
- expose stale digest warnings to the briefing generation path
- avoid direct writes to FedOS Memory

Outcome:
Home can use approved Memory context for briefing generation without merging Memory into Home.

### HCI-04: Briefing Package Generation Service

Status: Planned

Goal:
Move the useful LLM-first briefing generation path into the Home backend.

Work:
- port compact signal formatting and thread/source compaction
- port cache-ready prompt block structure
- generate a structured `BriefingPackage`
- generate attached `ProposedAction` records
- preserve source refs, model metadata, prompt version, and Memory Digest provenance
- keep the current Intelligence implementation available as a reference while porting

Outcome:
Home can generate and persist a briefing package without relying on a separate Intelligence runtime.

### HCI-05: Briefing API Routes

Status: Planned

Goal:
Expose product-oriented Home APIs for briefing review.

Work:
- add `GET /api/briefings`
- add `GET /api/briefings/[id]`
- add `POST /api/briefings/run` or an equivalent scheduled/run endpoint
- add `POST /api/briefings/[id]/feedback`
- add `POST /api/proposals/[id]/decision`
- keep existing `/api/llm/*` task routes working during migration

Outcome:
Home has product APIs for briefing packages, feedback, and proposal decisions.

### HCI-06: Mobile-First, Desktop-Continuous Briefing UI

Status: Planned

Goal:
Make Home the place where the morning briefing is actually used.

Work:
- add a briefing route or view in Home
- show daily summary, priorities, recommendations, risks, opportunities, uncertainty, and source-backed rationale
- show proposed actions separately from approved tasks
- support approve, edit and approve, reject, defer, and leave pending
- make mobile good for quick review/triage
- make desktop good for deeper follow-through

Outcome:
Federico can review the morning briefing and convert approved proposals into canonical Home tasks.

### HCI-07: Chat Feedback And Briefing Revisions

Status: Planned after HCI-06

Goal:
Let Federico challenge or correct the briefing inside Home.

Work:
- capture chat feedback against a briefing package/revision
- distinguish deterministic commands from reasoning feedback
- generate new `BriefingRevision` records when reasoning changes
- show what changed between revisions
- preserve the original package rather than silently overwriting it

Outcome:
Home supports the iterative reasoning loop without cross-app orchestration.

### HCI-08: Voice Input Layer

Status: Later

Goal:
Add voice as an input method over the same command and feedback contracts.

Work:
- transcribe voice into chat/command input
- support deterministic action commands by voice
- support reasoning feedback by voice
- require confirmation for consequential actions

Outcome:
Voice extends the Home intelligence experience without creating a separate architecture.

### HCI-09: Intelligence Repo Repositioning

Status: Later

Goal:
Retire or reposition FedOS Intelligence after Home reaches runtime parity.

Work:
- identify which Intelligence APIs are no longer needed
- preserve useful debug tools only if they remain valuable
- archive, retire, or keep Intelligence as a lab repo
- remove any product dependency on the Intelligence database

Outcome:
No duplicate product runtime remains.

## Open Questions

1. Should Intelligence logic be directly ported into Home, or extracted into a shared internal package first?
2. Should the physical database eventually be renamed from `fedos_tasks` to `fedos_home`, or should the current name remain indefinitely?
3. Where should approved Memory Digest artifacts live after Home owns briefing generation?
4. Which Intelligence debug pages should be recreated in Home, and which should remain lab-only?
5. What is the minimum viable mobile briefing screen for MVP, and what desktop continuation view is needed alongside it?
6. Should chat feedback be included in the first Home implementation, or follow immediately after package/proposal review?
7. What level of voice control belongs in MVP versus post-MVP?
8. How should Home schedule morning briefing runs?
9. Which current Intelligence APIs become unnecessary after migration?
10. How should outcome feedback be represented in the Home database so future reasoning can use it cleanly?
11. When should Memory become its own GitHub repo?
12. Should the local Home folder eventually be renamed from `fedos-tasks` to `fedos-home`, or left as-is?

## Recommended Next Step

Treat this as an architecture decision first, then move through implementation readiness before changing product code.

### Immediate Tracker

| Status | Item | Notes |
|---|---|---|
| Done | Confirm Home-centered intelligence as the target architecture | Home becomes the MVP product runtime; Intelligence becomes module/reference/lab during migration. |
| Done | Confirm FedOS Home PostgreSQL as the single product database | Current physical database can remain `fedos_tasks` for MVP. |
| Done | Rename Home GitHub repository | Completed: `FedOS-Tasks` -> `FedOS-Home`. |
| Done | Update local Home `origin` remote | Completed: `https://github.com/fv2121/FedOS-Home.git`; fetch verified. |
| Done | Check Railway deployment connection | Confirmed Railway points to `fv2121/FedOS-Home` after the GitHub rename. |
| Deferred | Decide whether to rename local Home folder | Home working tree is clean; local folder rename is optional. Current path remains `/Users/federico_valori/Documents/FedOS-Home/fedos-tasks`. |
| Done | Create VS Code workspace | Created `FedOS.code-workspace` with Home, Intelligence, and Memory folders. |
| Done | Verify Home readiness checks | `npm run build`, `npm run db:generate`, and `npx prisma migrate status` passed. |
| Done | Update Architecture and Project Brief | Updated to reflect Home-centered runtime, single Home product database, and Intelligence as migration/reference layer. |
| Done | Create Home implementation backlog draft | Added HCI-00 through HCI-09 in this document; fold into the Home backlog once scope is agreed. |
| Pending | Keep FedOS Intelligence stable during migration | Use it as the working reference while useful runtime pieces move into Home. |

### Recommended Order From Here

1. Confirm whether to keep the local Home folder as `fedos-tasks` for now or rename it to `fedos-home`.
2. Decide when Memory should become its own GitHub repo.
3. Fold the HCI implementation backlog into the Home backlog once scope is agreed.
4. Start implementation with HCI-01: Home Domain Model For Briefings.

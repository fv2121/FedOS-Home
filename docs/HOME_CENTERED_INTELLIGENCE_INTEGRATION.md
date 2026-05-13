# FedOS Home-Centered Intelligence Decision Record

## Status

Accepted and mostly implemented.

This document is no longer the active implementation backlog. It records the decision to move the intelligence product runtime into FedOS Home and keeps the remaining migration decisions visible.

Current documentation ownership:
- Product intent: [PROJECT_BRIEF.md](PROJECT_BRIEF.md)
- System architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
- Active work tracker: [BACKLOG.md](BACKLOG.md)

## Decision

FedOS Home owns the product runtime for the intelligence experience.

That means Home owns:
- morning briefing generation
- briefing package persistence
- proposed action review
- approval into canonical Home tasks
- mobile and desktop product surfaces
- debug visibility for the Home-owned intelligence pipeline
- future chat, voice, revision, and outcome feedback loops

FedOS Memory remains separate and canonical. Home consumes approved Memory context, especially the Memory Digest, but does not silently write to Memory.

FedOS Intelligence remains useful as reference and lab material during the transition, but it should not remain the long-term product runtime or durable product database.

## Why

The older handoff model treated FedOS Intelligence as a separate runtime that generated briefing packages for FedOS Home to consume. That worked as a proposal, but it became increasingly awkward once Home needed to own the full user loop:
- review the briefing
- inspect priorities and uncertainty
- accept, reject, defer, or edit proposed actions
- create canonical tasks
- ask follow-up questions
- preserve future revisions
- feed task outcomes back into future reasoning

Keeping those workflows split across two product runtimes would create duplicate state, cross-app synchronization, and a shadow product API. The simpler MVP architecture is one Home product database and a modular Home backend intelligence layer.

## Current Implementation Snapshot

Completed in Home:
- HCI-00: repository, deployment, and workspace readiness
- HCI-01: `BriefingPackage`, `ProposedAction`, and approved-proposal task linkage
- HCI-02: `src/server` backend/domain boundary
- HCI-03: read-only approved Memory Digest consumption
- HCI-04: Home-owned LLM-first briefing generation and persistence
- HCI-05: briefing and proposed-action decision APIs
- HCI-06: mobile-first, desktop-continuous Home briefing UI
- HCI-07: Home-owned Outlook mail/calendar signal ingestion
- HCI-08: protected Home Debug Console for pipeline inspection and dry-run/persist runs

Next:
- HCI-09: chat feedback and briefing revisions

Later:
- HCI-10: voice input over the same feedback and command contracts
- HCI-11: retire, archive, or reposition the FedOS Intelligence repo after Home reaches runtime parity

## Product Boundaries

### FedOS Memory

FedOS Memory owns durable personal context, operating principles, preferences, stakeholder context, stable strategy, and source Memory files.

Home may read approved Memory context and may eventually suggest Memory updates, but meaningful Memory changes should remain review-based.

### FedOS Home

FedOS Home is the user-facing command center, product runtime, canonical approved-task store, and product database owner.

Home owns the records that represent the daily product experience:
- briefing packages
- proposed actions
- approved tasks
- task events
- future briefing revisions
- future feedback and outcome signals

### FedOS Intelligence

FedOS Intelligence is no longer the intended long-term runtime. It can remain as:
- reference implementation for migrated behavior
- lab for new reasoning flows
- temporary comparison/debug surface
- source of patterns to port into Home

New durable product state should not be added to the Intelligence database unless it is explicitly lab-only.

## Data Ownership

The target product database is the FedOS Home PostgreSQL database. The current physical database name can remain `fedos_tasks` for the MVP, but conceptually it is the Home product database.

Home stores:
- `BriefingPackage`
- `ProposedAction`
- the `Task.approved_from_proposed_action_id` origin link
- briefing source references
- Memory Digest provenance
- model and prompt metadata

Home does not store full raw source archives by default.

FedOS Memory remains outside this database decision. The approved Memory Digest is a derived artifact, not the source of truth.

Current local transition paths:

```text
FEDOS_MEMORY_ROOT=/Users/federico_valori/Documents/FedOS-Memory
FEDOS_DIGEST_ROOT=/Users/federico_valori/Documents/FedOS-Intelligence/data/memory_digest
```

The long-term digest artifact location is still open.

## Migrated Capability Map

The useful runtime capabilities from the former separate Intelligence flow now have Home-owned counterparts:

| Capability | Home owner |
|---|---|
| Task domain services | `src/server/tasks` |
| Memory Digest loading | `src/server/memory` |
| Signal hygiene, deduplication, and compaction | `src/server/sources/llm-first-signals.ts` |
| Outlook mail/calendar ingestion | `src/server/sources/outlook` |
| LLM provider wrapper | `src/server/llm` |
| Prompt and structured-output orchestration | `src/server/intelligence` |
| Briefing persistence | `src/server/briefings` |
| Proposed-action decisions | `src/server/proposals` |
| Pipeline diagnostics | `src/server/debug`, `/debug`, `/api/debug/intelligence/*` |

## Remaining Decisions

The active unresolved decisions are:
- how Home should support chat feedback and preserved briefing revisions
- which outcome signals from task edits, completions, deferrals, and drops should feed future reasoning first
- where approved Memory Digest artifacts should live after Home fully owns generation
- what production secret store should replace the local Microsoft 365 token-file path
- how Home should schedule morning briefing runs
- when Memory should become its own GitHub repo
- which FedOS Intelligence surfaces should remain lab-only and which can be retired
- whether the physical database should eventually be renamed from `fedos_tasks` to `fedos_home`

Track implementation work in [BACKLOG.md](BACKLOG.md), not in this decision record.

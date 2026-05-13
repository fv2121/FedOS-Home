# FedOS Home-Centered Intelligence Architecture

## Purpose
This document describes the current and target architecture for the FedOS intelligence capability inside FedOS Home.

The product architecture is Home-centered: FedOS Home owns the product runtime, product database, user experience, briefing packages, proposed actions, approved tasks, and feedback loop. The current FedOS Intelligence project remains useful as a reference/lab, but the MVP runtime path now belongs in the Home backend.

## System Boundaries
FedOS has three cooperating projects:
- **FedOS Memory**: canonical context and operating memory
- **FedOS Home**: user-facing command center, product runtime, Home PostgreSQL database, and canonical approved-task store
- **FedOS Intelligence**: reference/lab implementation for ingestion, reasoning, prioritization, recommendations, and proposed actions after the useful MVP runtime pieces have moved into Home

FedOS Memory stays separate. FedOS Home becomes the long-term runtime owner for briefing generation, briefing package storage, proposed-action review, task creation, chat/voice interaction, and outcomes.

FedOS Intelligence should not remain a separate product runtime long term. It should not become the durable task system or a parallel product database.

## Current Home Implementation
The Home runtime currently includes:
- `src/server/tasks` for canonical task-domain logic
- `src/server/memory` for read-only Memory Digest loading and provenance
- `src/server/sources/llm-first-signals.ts` for signal hygiene, deduplication, compaction, and prompt formatting
- `src/server/sources/outlook` for Home-owned Outlook mail/calendar ingestion
- `src/server/llm` for provider calls
- `src/server/intelligence` for prompt assembly and briefing orchestration
- `src/server/briefings` for briefing package persistence and retrieval
- `src/server/proposals` for proposed-action decisions and task creation handoff
- `src/server/debug` plus `/debug` and `/api/debug/intelligence/*` for protected pipeline diagnostics

The next major architecture layer is the chat feedback and briefing revision loop.

## Architectural Principles
- Home-centered product runtime with strict internal module boundaries
- deterministic ingestion, normalization, storage, safety checks, and most delivery behavior
- LLM-driven reasoning where synthesis, judgment, and explanation are required
- selective persistence rather than raw-data hoarding
- clear source traceability for surfaced priorities
- read-only use of FedOS Memory unless a proposed Memory update is explicitly reviewed
- clear separation between proposed actions and approved Home tasks
- one product database: the FedOS Home PostgreSQL database
- feedback loops that improve future reasoning without hiding uncertainty

## End-To-End Flow
```text
FedOS Memory
-> Home backend intelligence module
-> Source ingestion + normalization
-> Context assembly with approved Memory Digest
-> LLM reasoning
-> Home-owned BriefingPackage + ProposedActions
-> Home mobile-first and desktop-continuous review
-> Approved Home tasks
-> Proposal decisions + future feedback and task outcomes
-> Future reasoning and Memory-update suggestions
```

## Layers

### 1. Source Ingestion
Connector agents fetch fresh signals from approved systems.

Initial sources:
- Outlook email
- Outlook calendar

Future sources:
- Microsoft Teams
- Gmail
- Google Calendar
- internal communications
- relevant external news
- FedOS Home task state

Outputs:
- raw source metadata
- source identifiers
- timestamps
- participants
- links back to source systems

Principle:
source data should generally be fetched when needed rather than stored wholesale.

### 2. Normalization
Source-specific payloads are converted into a shared internal `BriefingSignal` structure. Earlier planning docs used `Item` as the conceptual model name; `BriefingSignal` is the current Home implementation name.

Outputs:
- normalized items
- source type and source references
- participants, topics, timestamps, and metadata
- context tags where available

Principle:
normalized items are primarily working structures for reasoning and orchestration.

### 3. Context Assembly
The system combines normalized items with the user's current context.

Inputs:
- FedOS Memory files
- active objectives
- tracked people
- tracked topics
- commitments and open loops
- preferences and permissions
- FedOS Home task state when available
- recent feedback

Outputs:
- reasoning-ready signal pack
- active evaluation criteria for the current context
- warnings for missing or unavailable context

### 4. Reasoning
LLM workflows perform the judgment-heavy work.

Responsibilities:
- summarization
- prioritization
- explanation
- recommendation
- proposed-action generation
- emerging theme detection
- uncertainty reporting
- reflection and calibration prompts

Principle:
deterministic logic should clean, shape, and trace the inputs. The LLM should decide what matters when contextual judgment is required.

### 5. Selective Memory And Learning
The system persists only the subset of information useful for continuity, learning, traceability, and future reasoning.

Persisted records may include:
- briefing packages
- briefing revisions
- proposed actions
- review decisions
- derived insights
- source references
- lightweight metadata
- feedback events
- objective and context records
- proposed-action and approved-task linkages
- learning signals from Home task outcomes

Principle:
persist derived insight and references, not full raw source content by default.

In the target architecture, product persistence belongs in the FedOS Home PostgreSQL database. The current Intelligence database is transitional/reference/debug state only.

### 6. Briefing And Proposed Action Records
Important surfaced items can become proposed actions.

Proposed actions are not canonical tasks. They are reviewable Home-owned drafts attached to a briefing package or revision.

Outputs:
- briefing package
- briefing revision, where applicable
- proposed action title and context
- rationale
- source references
- suggested priority
- suggested deadline
- suggested owner
- uncertainty or assumptions

FedOS Home owns the approval, edit, rejection, task creation, status, and event history.

### 7. Orchestration
The orchestration layer coordinates the system.

Responsibilities:
- trigger connectors
- invoke normalization
- gather context
- call reasoning services
- merge and structure outputs
- manage source/context failures
- assemble final briefing payloads
- schedule recurring runs when unattended briefings are added

The former Python Intelligence orchestration can remain reference/lab material. The MVP runtime orchestration lives inside the Home backend.

### 8. Delivery And Interaction
Delivery layers adapt outputs to user-facing channels.

Initial product channels:
- FedOS Home mobile app/PWA
- FedOS Home desktop interface

Future channels:
- voice
- Teams/chat bot

FedOS Intelligence may keep lab-only debug channels, but the MVP product diagnostic path is the Home Debug Console.

Responsibilities:
- present priorities, rationale, recommendations, and proposed actions
- capture feedback and corrections
- preserve source links and explainability
- avoid becoming an inbox clone

### 9. Learning And Adaptation
Feedback and observed behavior improve future reasoning.

Inputs:
- explicit feedback
- proposed-action approval or rejection
- Home task edits, completions, deferrals, and drops
- repeated patterns across source systems
- Memory updates
- conversational corrections

Outputs:
- refined preferences
- improved stakeholder sensitivity
- better recommendation quality
- improved action proposals
- suggested Memory updates where appropriate

## Agent Roles
- Connector agents fetch and prepare source data.
- Reasoning agents summarize, prioritize, recommend, and explain.
- Proposal agents prepare proposed actions for Home review.
- Orchestration agents coordinate the workflow and resolve output shape.
- Interaction agents adapt outputs to Home mobile, Home desktop, voice, and chat.
- Learning agents interpret feedback and task outcomes.

For the MVP, these roles should remain simple internal module/service boundaries inside Home rather than independent autonomous agents.

## Core Models

### BriefingSignal
Core normalized representation of an incoming signal. This is currently an internal runtime structure, not a durable database table.

Typical fields:
- `id`
- `source_type`
- `source_id`
- `source_link`
- `title`
- `summary`
- `timestamp`
- `participants`
- `topics`
- `context_mode`
- `metadata`

### Objective
Current goal, priority, focus area, or preference shaping reasoning.

Typical fields:
- `id`
- `title`
- `description`
- `status`
- `time_horizon`
- `context_mode`
- `priority_weight`
- `metadata`

### BriefingPackage
Home-owned user-visible briefing package generated by the intelligence module.

Current durable fields:
- `id`
- `status`
- `context_mode`
- `payload`
- `source_refs`
- `memory_digest_hash`
- `memory_digest_stale`
- `memory_digest_approved_at`
- `model`
- `prompt_version`
- `created_at`
- `updated_at`

### ProposedAction
Suggested next step generated by the intelligence module for FedOS Home review.

Current durable fields:
- `id`
- `briefing_package_id`
- `title`
- `description`
- `rationale`
- `source_refs`
- `suggested_status`
- `suggested_priority`
- `suggested_due_at`
- `suggested_owner`
- `suggested_category_id`
- `suggested_project_id`
- `suggested_source_type`
- `suggested_source_ref`
- `suggested_tags`
- `uncertainty`
- `status`
- `decision_reason`
- `decided_at`
- `created_at`
- `updated_at`

### Recommendation
Suggested action, resource, topic, person, or next step.

Typical fields:
- `id`
- `type`
- `title`
- `description`
- `rationale`
- `related_item_ids`
- `related_objectives`
- `context_mode`
- `confidence`
- `status`

### FeedbackEvent
Future explicit or implicit user feedback.

Typical fields:
- `id`
- `event_type`
- `target_type`
- `target_id`
- `context_mode`
- `timestamp`
- `details`
- `source_channel`

### ContextProfile
Operating context for business, personal, or family mode.

Typical fields:
- `id`
- `context_mode`
- `active_objective_ids`
- `tracked_people`
- `tracked_topics`
- `preferences`
- `suppressed_signals`
- `metadata`

## LLM Usage
Primary LLM use:
- prioritization
- synthesis
- explanation
- recommendation
- proposed-action drafting
- uncertainty phrasing

Mostly deterministic:
- connector calls
- normalization
- hygiene filtering
- deduplication
- schema validation
- persistence
- auth and safety controls

Selective LLM use:
- orchestration summaries
- learning synthesis
- Memory update proposals
- calibration prompts

## Storage Principles
Store:
- Home-owned briefing packages
- Home-owned proposed actions and decision state
- derived insight
- source references
- lightweight metadata
- future objectives and context records when needed
- future briefing revisions and feedback events when needed
- proposed-action and approved-task linkages

Avoid storing by default:
- full raw email bodies
- full message histories
- full meeting transcripts
- unnecessary copies of source-system records

## Open Architecture Questions
- What is the minimal useful model for chat feedback and preserved briefing revisions?
- Which Home task events and proposal decisions should feed future reasoning first?
- Which Memory files should be loaded for each context mode?
- Which reasoning outputs should be persisted versus generated on demand?
- How should proposed Memory updates be reviewed and applied?
- Where should approved Memory Digest artifacts live after Home owns the runtime?
- What production secret store should replace the local Microsoft 365 token-file path?
- How should Home schedule unattended morning briefing runs?
- Which current Intelligence debug surfaces should remain lab-only now that Home owns the MVP Debug Console?

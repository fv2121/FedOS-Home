# FedOS Intelligence Capability Brief

## Objective
Build the FedOS intelligence capability as part of the FedOS Home product runtime: a personal intelligence system that ingests fresh signals, interprets them against operating context, surfaces what matters, explains why, and proposes useful next actions for review.

The intelligence capability should reduce cognitive load for one primary user by turning high-volume inbound information into a small, trustworthy set of priorities, recommendations, and action proposals.

## Core Idea
The FedOS intelligence capability is not a data aggregation product. It is a reasoning layer that sits above existing tools and source systems and is experienced through FedOS Home.

Its job is to:
- collect relevant fresh signals from approved sources
- normalize those signals into a common shape
- read FedOS Memory as context
- reason over what matters now
- produce concise briefings and recommendations
- propose actions for review inside FedOS Home
- learn from feedback, approvals, rejections, edits, and task outcomes

The product should feel like a trusted chief-of-staff layer: calm, selective, explainable, and useful without becoming noisy or over-automated.

## FedOS System Roles
FedOS is designed with clear ownership boundaries.

### FedOS Memory
FedOS Memory is the canonical context and operating memory.

It owns:
- identity and role context
- current priorities
- preferences
- stakeholders
- permissions
- business and personal context
- commitments and open loops
- decisions, feedback, and learning notes
- prioritization rubrics and briefing templates

The intelligence capability reads Memory as context, primarily through approved Memory context such as the Memory Digest. It may propose updates to Memory, but meaningful Memory changes should remain inspectable and approval-based.

### FedOS Home
FedOS Home is the user-facing command center, product runtime, canonical approved-task store, and product database owner.

It owns:
- mobile and desktop user experience
- briefing package persistence
- briefing revision history
- proposed action review
- approved tasks
- task status
- priority, due dates, category, and project links
- task source links
- task event history
- approval, rejection, edit, deferral, and completion flows
- chat and later voice interaction
- the daily execution interface

Signals and recommendations are not tasks. A proposed action becomes a task only after Federico approves or edits it in FedOS Home.

### FedOS Intelligence
FedOS Intelligence is the current reference/lab implementation for the ingestion, reasoning, orchestration, briefing, recommendation, and proposal capability.

It currently owns useful implementation patterns:
- source ingestion
- normalization
- signal hygiene and deduplication
- prompt/context assembly
- LLM reasoning workflows
- prioritization and explanation
- recommendations
- proposed actions
- uncertainty reporting
- feedback interpretation
- learning signals derived from user behavior

These useful runtime pieces should migrate into the FedOS Home backend over time. The Intelligence repo should not remain the long-term product runtime or durable product database.

## Primary User
The system is designed first for Federico as a single primary user operating across business, personal, and family contexts.

In business mode, the user is a senior operator with high inbound volume: email, meetings, requests, decisions, follow-ups, stakeholder signals, and external developments.

In personal or family mode, the same user manages life administration, family logistics, personal goals, reminders, interests, and commitments.

The product should optimize for one person's real operating rhythm rather than for a generic productivity audience.

## Product Principles
- Be selective: surface the few things that matter, not everything available.
- Be explainable: show why something was prioritized and what uncertainty remains.
- Be context-aware: reason against Memory, objectives, stakeholders, preferences, and current mode.
- Be action-oriented: connect insight to proposed next steps without silently executing consequential actions.
- Be lightweight with storage: keep derived insight, references, feedback, and learning signals rather than full raw source archives.
- Be approval-based: user control comes before automation breadth.
- Be adaptive: improve through feedback, task outcomes, repeated patterns, and calibration.
- Be calm: reduce cognitive load rather than creating another feed.

## Non-Goals
The intelligence capability is not intended to be:
- a broad productivity suite
- a replacement for email, calendar, Teams, Gmail, or other source systems
- a raw-data warehouse
- a standalone task manager
- a fully autonomous agent
- a general content feed
- a multi-user enterprise product

The product should remain an intelligent layer that helps Federico interpret, prioritize, decide, and act.

## Primary Use Cases
- Generate a concise morning briefing from fresh signals and Memory context
- Rank top priorities and explain why they matter now
- Detect risks, deadlines, stakeholder issues, opportunities, and emerging themes
- Suggest practical next actions without turning them into tasks automatically
- Prepare the user for meetings, decisions, and conversations
- Identify open loops and commitments that need attention
- Surface a small number of timely recommendations such as topics, articles, events, or people worth tracking
- Capture explicit feedback on surfaced items, recommendations, and proposed actions
- Learn from what is approved, rejected, edited, ignored, completed, deferred, or dropped

## Context And Inputs

### Context Modes
FedOS should support context modes so the same product can reason differently depending on whether Federico is operating in a business, personal, or family context.

Each mode may adapt:
- source selection
- evaluation logic
- prioritization criteria
- objectives
- stakeholders
- recommendations
- proposed actions
- wording and interface tone

Business mode should emphasize work-related communications, meetings, stakeholders, strategic priorities, commercial risks, delivery commitments, and professional opportunities.

Personal or family mode should emphasize family logistics, life administration, personal goals, routines, commitments, reminders, and wellbeing.

### Source Systems
Initial business-mode sources:
- Outlook email
- Outlook calendar

Likely future sources:
- Microsoft Teams messages
- Teams meeting notes and transcripts
- Gmail
- Google Calendar
- internal communications and news
- relevant external news
- FedOS Home task state
- manually supplied notes or documents

### Memory Context
The intelligence capability should read selected FedOS Memory files as a judgment frame for the LLM.

Memory context should help the system understand:
- who Federico is
- what matters now
- which stakeholders are important
- what commitments and open loops exist
- what preferences and permissions apply
- how to prioritize ambiguous signals
- what tone and level of detail are useful

Memory should be treated as a high-value source of context, not as raw prompt decoration.

### Objectives And Priorities
The intelligence capability should maintain or retrieve a clear set of current objectives, priorities, focus areas, tracked people, tracked topics, and known sensitivities.

When evaluating signals, the reasoning layer should explicitly consult:
- active objectives
- FedOS Memory context
- current commitments
- tracked stakeholders
- tracked topics
- user feedback history
- task outcomes from FedOS Home
- current calendar and timing context

## Reasoning And Prioritization

### Prioritization Framework
The system should evaluate incoming signals using a blend of contextual, behavioral, and strategic criteria.

Relevant criteria include:
- urgency
- strategic relevance
- stakeholder importance
- deadline proximity
- risk or downside exposure
- opportunity or upside potential
- novelty or change from the norm
- relationship to current objectives
- relationship to current commitments
- likelihood that user action is needed
- repeat pattern or recurring signal
- personal preference and historical behavior
- available time and calendar constraints

The system should avoid rigid numeric scoring as the primary decision model when LLM reasoning can make a better contextual judgment. Deterministic logic should handle hygiene, normalization, deduplication, traceability, and safety boundaries. The LLM should handle judgment-heavy ranking, synthesis, and explanation.

### Explainability
Every surfaced priority should make its reasoning visible.

Where practical, surfaced items should include:
- why this matters now
- which objective, stakeholder, commitment, or context it relates to
- whether it is urgent, strategic, risky, or time-sensitive
- what action, if any, appears implied
- what is known, inferred, or uncertain
- what source signal supports the conclusion

The explanation should be concise enough to support action without creating another reading burden.

### Uncertainty
The system should be honest when the signal is thin, ambiguous, stale, or missing key context.

Uncertainty should be explicit when:
- a source is unavailable
- Memory context is missing or incomplete
- a signal implies action but the owner is unclear
- a stakeholder appears important but is not yet tracked
- an LLM conclusion depends on inference rather than direct evidence

Uncertainty should guide better decisions, not undermine confidence unnecessarily.

## Recommendations
The intelligence capability should surface a small number of timely recommendations that feel grounded in the user's real context.

Recommendations may include:
- people to follow up with
- topics to track more actively
- documents, articles, or books worth reading
- events worth attending
- meetings that need preparation
- calendar blocks worth creating
- decisions that need clarification
- open loops that should be closed

Recommendations should be specific, useful, and connected to actual signals or Memory context.

## Proposed Actions In FedOS Home
The intelligence capability should produce proposed actions, not approved tasks.

A proposed action is a reviewable suggestion that may include:
- title
- context
- rationale
- linked source item
- suggested priority
- suggested deadline
- suggested owner
- suggested category or project
- uncertainty or assumptions

FedOS Home should present proposed actions for approval, editing, rejection, or deferral. Once approved, the resulting task belongs to FedOS Home.

The approval loop should feed learning back to the intelligence capability:
- approved unchanged
- approved after edit
- rejected
- ignored
- deferred
- completed
- dropped
- repeatedly postponed

This creates the bridge between reasoning and execution without sacrificing user control.

In the target architecture, proposed actions and review decisions are Home-owned product records in the Home PostgreSQL database.

## Learning And Adaptation

### Learning Loop
The intelligence capability should learn through a structured feedback loop.

Learning signals include:
- explicit feedback on priorities and recommendations
- approved, rejected, edited, or ignored proposed actions
- task status changes in FedOS Home
- task completion, deferral, drop, or deadline changes
- repeated patterns across email, calendar, Teams, and tasks
- changes in Memory context
- conversational corrections
- stakeholder or topic promotions and suppressions

The learning loop should improve:
- ranking quality
- briefing tone and length
- stakeholder sensitivity
- proposed-action usefulness
- recommendation relevance
- context-mode accuracy
- detection of emerging themes

### Reflection And Calibration
The intelligence capability should eventually support lightweight calibration conversations.

Examples:
- "This topic keeps appearing. Should I track it more actively?"
- "You approved three actions related to this stakeholder. Should they be promoted?"
- "This priority is in Memory, but recent behavior suggests it may be less active. Should I lower its weight?"
- "You keep deferring this type of action. Should I propose fewer of them?"

These prompts should be occasional, focused, and useful. They should help the user think more clearly, not create interruption.

### Guided Discovery
The system should occasionally surface useful signals just outside the user's explicit criteria.

Examples:
- a recurring person not yet marked as important
- an emerging topic linked to current objectives
- a low-volume but high-risk signal
- a recommendation that may broaden the user's thinking

Discovery should always be easy to correct: track more, ignore, suppress, or lower priority.

## Delivery And Interaction

### Morning Brief
The morning brief is the core scheduled experience.

It should answer:
- What matters today?
- Why does it matter?
- What needs action?
- What should I prepare for?
- What risks or open loops should not be missed?
- What can safely be ignored?
- What is uncertain or missing?

The brief should be concise, calm, and organized around priorities rather than source systems.

### FedOS Home Mobile And Desktop
FedOS Home should present:
- briefing narrative
- ranked priorities
- supporting signals
- recommendations
- proposed actions
- uncertainty
- Memory availability/status
- source health
- feedback controls
- links back to source systems and FedOS Home

The mobile experience should support lightweight morning review, triage, feedback, and voice/chat use. The desktop experience should support deeper follow-through on approved tasks and briefing-driven work.

Debug dashboards can remain in the Intelligence repo during migration, but the product experience should live in Home.

### Voice
Voice should support on-the-go moments such as getting ready, walking, or commuting.

Voice should be able to:
- summarize the brief
- answer follow-up questions
- explain why something matters
- capture quick feedback
- draft a proposed action for later Home approval

### Chat
Chat should support lightweight interaction through Teams or another messaging surface.

It should be useful for:
- quick summaries
- "what matters now?" checks
- clarification
- feedback
- proposed-action review prompts
- narrow meeting or stakeholder prep

## Trust, Privacy, And Control
Trust is a core product requirement.

The intelligence capability should:
- use least-privilege source access
- avoid storing full raw source content by default
- keep sensitive retention minimal
- maintain source traceability
- separate business and personal context clearly
- expose what context was used when possible
- make uncertainty visible
- require approval before consequential external actions
- never silently send messages, update calendars, or create approved tasks

The user should always be able to inspect, correct, approve, reject, or override the system's judgment.

## MVP Scope

### MVP Goal
Prove that the FedOS intelligence capability can produce a genuinely useful morning briefing from Outlook email, Outlook calendar, FedOS Memory, and active objectives, then make that briefing usable in FedOS Home for review, revision, and approved task creation.

### In Scope
- Outlook email ingestion
- Outlook calendar ingestion
- normalization into `Item`
- hygiene filtering and deduplication
- read-only FedOS Memory context loading
- approved Memory Digest consumption
- active objective loading
- LLM-first briefing generation
- ranked priorities with rationale
- concise narrative summary
- recommendations
- proposed actions
- Home-owned briefing package/proposed-action persistence
- uncertainty reporting
- feedback capture
- basic Home review experience plus Intelligence debug/reference experience during migration
- scheduled morning job entrypoint

### Out Of Scope
- Gmail
- Google Calendar
- personal/family mode
- Teams messages and transcripts
- autonomous external actions
- automatic task creation without Home approval
- broad external news ingestion
- multi-user workflows
- deep long-horizon analytics

### MVP Success Criteria
- The system consistently surfaces the most important daily business signals.
- The morning brief is concise enough to use quickly.
- Priorities include clear rationale and traceable source context.
- Proposed actions are specific enough for Home approval.
- Memory context materially improves relevance.
- Feedback can be captured and used to improve future runs.
- Missing context and source failures are visible rather than hidden.

## High-Level Architecture

```text
FedOS Memory
-> FedOS Home backend intelligence module
-> Source Ingestion
-> Normalization
-> Context Assembly with approved Memory Digest
-> Reasoning
-> Home-owned BriefingPackage + ProposedActions
-> Home mobile-first and desktop-continuous review
-> Approved Home tasks
-> Feedback + Task Outcomes
-> Future Reasoning
```

### Source Ingestion
Fetch fresh signals from approved source systems.

Initial sources:
- Outlook email
- Outlook calendar

### Normalization
Convert source-specific payloads into canonical `Item` structures with source references, timestamps, participants, summaries, metadata, and context tags.

### Context Assembly
Combine normalized signals with:
- FedOS Memory context
- active objectives
- tracked people
- tracked topics
- current commitments
- recent feedback
- relevant Home task state when available

### Reasoning
Use LLM workflows for:
- prioritization
- synthesis
- explanation
- recommendations
- proposed actions
- uncertainty
- reflection prompts

### Home Product Persistence
Store briefing packages, revisions, proposed actions, review decisions, approved tasks, and feedback events in the FedOS Home PostgreSQL database.

### Learning
Use feedback and task outcomes to refine future judgment.

## Core Models

### Item
Normalized representation of an incoming signal.

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
Current goal, strategic priority, focus area, or known preference shaping reasoning.

Typical fields:
- `id`
- `title`
- `description`
- `status`
- `time_horizon`
- `context_mode`
- `priority_weight`
- `metadata`

### ProposedAction
Draft action generated by the intelligence capability for review in Home.

Typical fields:
- `id`
- `title`
- `context`
- `rationale`
- `signal_id`
- `source_refs`
- `suggested_priority`
- `suggested_deadline`
- `suggested_owner`
- `suggested_category`
- `uncertainty`
- `metadata`

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
Explicit or implicit user feedback.

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
Operating context for a mode such as business, personal, or family.

Typical fields:
- `id`
- `context_mode`
- `active_objective_ids`
- `tracked_people`
- `tracked_topics`
- `preferences`
- `suppressed_signals`
- `metadata`

## Build Priorities
1. Keep the LLM-first morning brief reliable and useful during migration.
2. Add Home domain models for briefing packages, revisions, proposed actions, review decisions, and feedback.
3. Move the useful intelligence runtime into the Home backend.
4. Build the mobile-first, desktop-continuous Home briefing experience.
5. Capture approval/rejection/edit/defer feedback and task outcomes in Home.
6. Improve Memory-driven relevance and stakeholder judgment through approved Memory Digest use.
7. Harden auth, token storage, deployment readiness, and scheduling.
8. Expand source coverage once the core loop is trustworthy.

## Engineering Principles
- Keep routes thin and business logic in services.
- Keep connectors deterministic and source-specific.
- Keep prompts explicit and versionable.
- Keep LLM usage focused on judgment-heavy work.
- Prefer structured schemas over ad hoc dictionaries.
- Preserve source traceability.
- Store derived insight and references, not unnecessary raw content.
- Build small vertical slices that can be tested end to end.
- Avoid multi-agent complexity until the core loop is reliable.

## Open Questions
- What is the minimum viable Home domain model for briefing packages, revisions, proposed actions, and review decisions?
- Which Home task outcomes should feed future reasoning first?
- Which Memory files should be included in each context mode?
- How should proposed Memory updates be reviewed and approved?
- What is the right cadence beyond the morning brief?
- Which source should be added after Outlook calendar/email: Teams, Gmail, or external news?
- Which current Intelligence debug tools should remain lab-only after Home owns the runtime?

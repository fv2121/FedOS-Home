import type { LLMFirstInsights } from "@/server/intelligence/prompt";

export type BriefingPayload = {
  narrative: string;
  top_priorities: LLMFirstInsights["top_priorities"];
  recommendations: string[];
  uncertainty: string | null;
};

export type BriefingProposedAction = {
  id: string;
  briefing_package_id: string;
  title: string;
  description: string | null;
  suggested_status: string | null;
  suggested_priority: string | null;
  suggested_category_id: string | null;
  suggested_project_id: string | null;
  suggested_owner: string | null;
  suggested_due_at: string | null;
  suggested_source_type: string | null;
  suggested_source_ref: string | null;
  suggested_tags: unknown;
  rationale: string | null;
  uncertainty: string | null;
  status: "pending" | "approved" | "rejected" | "deferred";
  decision_reason: string | null;
  decided_at: string | null;
  created_at: string;
  approved_task: { id: string; title: string } | null;
};

export type BriefingPackageDetail = {
  id: string;
  status: string;
  context_mode: string;
  created_at: string;
  updated_at: string;
  model: string | null;
  prompt_version: string | null;
  memory_digest_hash: string | null;
  memory_digest_stale: boolean | null;
  memory_digest_approved_at: string | null;
  payload: BriefingPayload;
  proposed_actions: BriefingProposedAction[];
};

export type ProposalDecisionStatus = BriefingProposedAction["status"];

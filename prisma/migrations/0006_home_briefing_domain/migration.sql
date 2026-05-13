-- CreateEnum
CREATE TYPE "BriefingPackageStatus" AS ENUM ('active', 'archived', 'failed');

-- CreateEnum
CREATE TYPE "ProposedActionStatus" AS ENUM ('pending', 'approved', 'rejected', 'deferred');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "approved_from_proposed_action_id" TEXT;

-- CreateTable
CREATE TABLE "BriefingPackage" (
    "id" TEXT NOT NULL,
    "status" "BriefingPackageStatus" NOT NULL DEFAULT 'active',
    "context_mode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source_refs" JSONB,
    "memory_digest_hash" TEXT,
    "memory_digest_stale" BOOLEAN,
    "memory_digest_approved_at" TIMESTAMP(3),
    "model" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BriefingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedAction" (
    "id" TEXT NOT NULL,
    "briefing_package_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "suggested_status" "TaskStatus",
    "suggested_priority" "TaskPriority",
    "suggested_category_id" TEXT,
    "suggested_project_id" TEXT,
    "suggested_owner" TEXT,
    "suggested_due_at" TIMESTAMP(3),
    "suggested_source_type" "SourceType",
    "suggested_source_ref" TEXT,
    "suggested_tags" JSONB,
    "rationale" TEXT,
    "uncertainty" TEXT,
    "source_refs" JSONB,
    "status" "ProposedActionStatus" NOT NULL DEFAULT 'pending',
    "decision_reason" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposedAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Task_approved_from_proposed_action_id_key" ON "Task"("approved_from_proposed_action_id");

-- CreateIndex
CREATE INDEX "BriefingPackage_status_idx" ON "BriefingPackage"("status");

-- CreateIndex
CREATE INDEX "BriefingPackage_context_mode_idx" ON "BriefingPackage"("context_mode");

-- CreateIndex
CREATE INDEX "BriefingPackage_created_at_idx" ON "BriefingPackage"("created_at");

-- CreateIndex
CREATE INDEX "ProposedAction_briefing_package_id_idx" ON "ProposedAction"("briefing_package_id");

-- CreateIndex
CREATE INDEX "ProposedAction_status_idx" ON "ProposedAction"("status");

-- CreateIndex
CREATE INDEX "ProposedAction_suggested_due_at_idx" ON "ProposedAction"("suggested_due_at");

-- CreateIndex
CREATE INDEX "ProposedAction_created_at_idx" ON "ProposedAction"("created_at");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_approved_from_proposed_action_id_fkey" FOREIGN KEY ("approved_from_proposed_action_id") REFERENCES "ProposedAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposedAction" ADD CONSTRAINT "ProposedAction_briefing_package_id_fkey" FOREIGN KEY ("briefing_package_id") REFERENCES "BriefingPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

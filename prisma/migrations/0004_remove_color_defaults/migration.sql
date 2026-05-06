-- Keep project, status, and priority colors database-owned.
-- This migration removes database defaults instead of backfilling with code-owned colors.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "color" TEXT;

CREATE TABLE IF NOT EXISTS "PriorityConfig" (
    "priority" "TaskPriority" NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "PriorityConfig_pkey" PRIMARY KEY ("priority")
);

CREATE TABLE IF NOT EXISTS "StatusConfig" (
    "status" "TaskStatus" NOT NULL,
    "color" TEXT NOT NULL,
    CONSTRAINT "StatusConfig_pkey" PRIMARY KEY ("status")
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Project" WHERE "color" IS NULL) THEN
    RAISE EXCEPTION 'Project.color must be populated before applying migration 0004_remove_color_defaults';
  END IF;

  IF EXISTS (SELECT 1 FROM "PriorityConfig" WHERE "color" IS NULL) THEN
    RAISE EXCEPTION 'PriorityConfig.color must be populated before applying migration 0004_remove_color_defaults';
  END IF;

  IF EXISTS (SELECT 1 FROM "StatusConfig" WHERE "color" IS NULL) THEN
    RAISE EXCEPTION 'StatusConfig.color must be populated before applying migration 0004_remove_color_defaults';
  END IF;
END $$;

ALTER TABLE "Project" ALTER COLUMN "color" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "color" SET NOT NULL;

ALTER TABLE "PriorityConfig" ALTER COLUMN "color" DROP DEFAULT;
ALTER TABLE "PriorityConfig" ALTER COLUMN "color" SET NOT NULL;

ALTER TABLE "StatusConfig" ALTER COLUMN "color" DROP DEFAULT;
ALTER TABLE "StatusConfig" ALTER COLUMN "color" SET NOT NULL;

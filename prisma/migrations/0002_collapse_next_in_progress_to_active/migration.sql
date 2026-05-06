-- Collapse "next" and "in_progress" into "active"
-- PostgreSQL cannot use ADD VALUE in a transaction, so we recreate the enum.

-- 1. Create the new enum type
CREATE TYPE "TaskStatus_new" AS ENUM ('inbox', 'active', 'waiting', 'deferred', 'done', 'dropped');

-- 2. Convert the column: map next/in_progress → active, keep the rest
ALTER TABLE "Task"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "TaskStatus_new"
    USING (CASE status::text
      WHEN 'next' THEN 'active'
      WHEN 'in_progress' THEN 'active'
      ELSE status::text
    END)::"TaskStatus_new",
  ALTER COLUMN status SET DEFAULT 'inbox';

-- 3. Drop old type and rename new one
DROP TYPE "TaskStatus";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";

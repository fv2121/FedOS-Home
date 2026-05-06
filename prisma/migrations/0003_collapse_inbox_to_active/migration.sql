-- Collapse "inbox" into "active" and make active the default.
-- PostgreSQL enums cannot remove values directly, so recreate the enum.

CREATE TYPE "TaskStatus_new" AS ENUM ('active', 'waiting', 'deferred', 'done', 'dropped');

ALTER TABLE "Task"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "TaskStatus_new"
    USING (CASE status::text
      WHEN 'inbox' THEN 'active'
      ELSE status::text
    END)::"TaskStatus_new",
  ALTER COLUMN status SET DEFAULT 'active';

DROP TYPE "TaskStatus";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";

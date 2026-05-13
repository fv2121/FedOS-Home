import { loadEnvConfig } from "@next/env";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  approveDraft,
  getDigestStatus,
  loadApprovedMemoryDigest,
  loadMemoryContext,
  readApproved,
  readDraft,
  readFeedback,
  saveDraft,
  saveFeedback,
} from "@/server/memory";

loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const exerciseWorkflow = args.has("--workflow");

async function main() {
  const memory = await loadMemoryContext();
  const digest = await loadApprovedMemoryDigest({ memory });

  console.log(
    JSON.stringify(
      {
        memory: {
          available: memory.available,
          root: memory.root,
          filesLoaded: memory.filesLoaded.length,
          filesMissing: memory.filesMissing.length,
          error: memory.error,
        },
        digest: {
          available: digest.available,
          root: digest.root,
          stale: digest.stale,
          approvedAt: digest.approvedAt,
          approvedHash: digest.approvedHash,
          sourceHash: digest.sourceHash,
          filesLoaded: digest.filesLoaded.length,
          filesMissing: digest.filesMissing.length,
          warnings: digest.warnings,
        },
      },
      null,
      2,
    ),
  );

  if (!exerciseWorkflow) return;

  // The workflow exercise writes draft/approved/feedback files. To avoid
  // clobbering the real FEDOS_DIGEST_ROOT, always run against an isolated
  // temp directory.
  const tempRoot = await mkdtemp(path.join(tmpdir(), "fedos-digest-smoke-"));
  console.log(`\n--- workflow (sandbox: ${tempRoot}) ---`);
  try {
    const initialStatus = await getDigestStatus({ memory, digestRoot: tempRoot });
    console.log("status.before", {
      root: initialStatus.root,
      draftPresent: initialStatus.draftPresent,
      approvedPresent: initialStatus.approvedPresent,
      feedbackPresent: initialStatus.feedbackPresent,
      stale: initialStatus.stale,
    });

    const sampleDraft = `# Memory Digest (smoke test draft)\n\nGenerated at ${new Date().toISOString()}.\n`;
    const afterSaveDraft = await saveDraft(
      { content: sampleDraft, manuallyEdited: true, model: "smoke" },
      { memory, digestRoot: tempRoot },
    );
    console.log("after.saveDraft", {
      draftPresent: afterSaveDraft.draftPresent,
      draftHash: afterSaveDraft.draftHash,
      draftMatchesSource: afterSaveDraft.draftMatchesSource,
    });

    const afterSaveFeedback = await saveFeedback("Smoke feedback note.", {
      memory,
      digestRoot: tempRoot,
    });
    console.log("after.saveFeedback", {
      feedbackPresent: afterSaveFeedback.feedbackPresent,
    });

    const draftRead = await readDraft({ digestRoot: tempRoot });
    const feedbackRead = await readFeedback({ digestRoot: tempRoot });
    console.log("read.draft.length", draftRead?.length ?? 0);
    console.log("read.feedback.length", feedbackRead?.length ?? 0);

    const afterApprove = await approveDraft({ memory, digestRoot: tempRoot });
    const approvedRead = await readApproved({ digestRoot: tempRoot });
    console.log("after.approve", {
      approvedPresent: afterApprove.approvedPresent,
      approvedHash: afterApprove.approvedHash,
      stale: afterApprove.stale,
      approvedLength: approvedRead?.length ?? 0,
    });
  } catch (err) {
    console.error("workflow failed:", err);
    process.exitCode = 1;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

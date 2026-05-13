import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  computeMemorySourceHash,
  loadMemoryContext,
  type MemoryContext,
} from "./context";

/**
 * Read/write workflow for the FedOS Memory Digest artifact (HCI-08A).
 *
 * The digest is a derived, human-approved compression of FedOS Memory. This
 * module owns the on-disk artifact at FEDOS_DIGEST_ROOT but never writes to
 * FedOS Memory itself. The read-only consumer used by the briefing pipeline
 * lives in `./digest.ts`; this module covers draft, feedback, and approval.
 */

export const DIGEST_PROMPT_VERSION = "v1";

const DRAFT_FILENAME = "draft.md";
const APPROVED_FILENAME = "approved.md";
const FEEDBACK_FILENAME = "feedback.md";
const METADATA_FILENAME = "metadata.json";

export type DigestWorkflowStatus = {
  available: boolean;
  root: string | null;
  draftPresent: boolean;
  approvedPresent: boolean;
  feedbackPresent: boolean;
  sourceHash: string;
  approvedHash: string | null;
  approvedAt: string | null;
  stale: boolean;
  draftHash: string | null;
  draftMatchesSource: boolean;
  metadata: Record<string, unknown>;
  filesLoaded: string[];
  filesMissing: string[];
  memoryAvailable: boolean;
  memoryError: string | null;
  warnings: string[];
};

export class DigestRootNotConfiguredError extends Error {
  constructor() {
    super("FEDOS_DIGEST_ROOT is not configured");
    this.name = "DigestRootNotConfiguredError";
  }
}

export class DigestDraftMissingError extends Error {
  constructor() {
    super("No draft digest to approve");
    this.name = "DigestDraftMissingError";
  }
}

export class MemoryUnavailableError extends Error {
  constructor() {
    super("FedOS Memory is not available; cannot generate digest");
    this.name = "MemoryUnavailableError";
  }
}

function resolveRoot(digestRoot?: string): string {
  const root = digestRoot ?? process.env.FEDOS_DIGEST_ROOT;
  if (!root) {
    throw new DigestRootNotConfiguredError();
  }
  return path.resolve(root);
}

async function ensureRoot(digestRoot?: string): Promise<string> {
  const root = resolveRoot(digestRoot);
  await mkdir(root, { recursive: true });
  return root;
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

async function readMetadata(root: string): Promise<Record<string, unknown>> {
  const raw = await readTextIfExists(path.join(root, METADATA_FILENAME));
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

async function writeMetadata(
  root: string,
  data: Record<string, unknown>,
): Promise<void> {
  const sorted = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});
  await writeFile(
    path.join(root, METADATA_FILENAME),
    `${JSON.stringify(sorted, null, 2)}\n`,
    "utf-8",
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export type DigestWorkflowOptions = {
  digestRoot?: string;
  memory?: MemoryContext;
};

async function loadMemory(options?: DigestWorkflowOptions): Promise<MemoryContext> {
  return options?.memory ?? (await loadMemoryContext());
}

export async function getDigestStatus(
  options?: DigestWorkflowOptions,
): Promise<DigestWorkflowStatus> {
  const memory = await loadMemory(options);
  const sourceHash = computeMemorySourceHash(memory);
  const warnings: string[] = [];

  if (!memory.available && memory.error) {
    warnings.push(`Memory context unavailable: ${memory.error}`);
  }

  let root: string;
  try {
    root = resolveRoot(options?.digestRoot);
  } catch (err) {
    warnings.push(
      err instanceof Error ? err.message : "FEDOS_DIGEST_ROOT is not configured",
    );
    return {
      available: false,
      root: null,
      draftPresent: false,
      approvedPresent: false,
      feedbackPresent: false,
      sourceHash,
      approvedHash: null,
      approvedAt: null,
      stale: false,
      draftHash: null,
      draftMatchesSource: false,
      metadata: {},
      filesLoaded: [...memory.filesLoaded],
      filesMissing: [...memory.filesMissing],
      memoryAvailable: memory.available,
      memoryError: memory.error,
      warnings,
    };
  }

  try {
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) {
      warnings.push(`FEDOS_DIGEST_ROOT is not a directory: ${root}`);
    }
  } catch {
    // Root does not exist yet — that is fine, it will be created on first write.
  }

  const metadata = await readMetadata(root);
  const approvedHash = asString(metadata.approved_hash);
  const approvedAt = asString(metadata.approved_at);
  const draftHash = asString(metadata.draft_source_hash);

  const [draftPresent, approvedPresent, feedbackPresent] = await Promise.all([
    fileExists(path.join(root, DRAFT_FILENAME)),
    fileExists(path.join(root, APPROVED_FILENAME)),
    fileExists(path.join(root, FEEDBACK_FILENAME)),
  ]);

  const stale =
    approvedPresent && approvedHash !== null && approvedHash !== sourceHash;
  const draftMatchesSource =
    draftPresent && draftHash !== null && draftHash === sourceHash;

  if (approvedPresent && approvedHash === null) {
    warnings.push(
      "Approved digest has no recorded approved_hash; staleness unknown",
    );
  }
  if (stale) {
    warnings.push(
      "Approved digest is stale: source Memory has changed since approval",
    );
  }

  return {
    available: true,
    root,
    draftPresent,
    approvedPresent,
    feedbackPresent,
    sourceHash,
    approvedHash,
    approvedAt,
    stale,
    draftHash,
    draftMatchesSource,
    metadata,
    filesLoaded: [...memory.filesLoaded],
    filesMissing: [...memory.filesMissing],
    memoryAvailable: memory.available,
    memoryError: memory.error,
    warnings,
  };
}

export async function readDraft(options?: DigestWorkflowOptions): Promise<string | null> {
  const root = resolveRoot(options?.digestRoot);
  return readTextIfExists(path.join(root, DRAFT_FILENAME));
}

export async function readApproved(options?: DigestWorkflowOptions): Promise<string | null> {
  const root = resolveRoot(options?.digestRoot);
  return readTextIfExists(path.join(root, APPROVED_FILENAME));
}

export async function readFeedback(options?: DigestWorkflowOptions): Promise<string | null> {
  const root = resolveRoot(options?.digestRoot);
  return readTextIfExists(path.join(root, FEEDBACK_FILENAME));
}

export type SaveDraftInput = {
  content: string;
  manuallyEdited: boolean;
  model?: string;
};

export async function saveDraft(
  input: SaveDraftInput,
  options?: DigestWorkflowOptions,
): Promise<DigestWorkflowStatus> {
  const memory = await loadMemory(options);
  const root = await ensureRoot(options?.digestRoot);

  await writeFile(path.join(root, DRAFT_FILENAME), input.content, "utf-8");

  const metadata = await readMetadata(root);
  metadata.draft_generated_at = new Date().toISOString();
  metadata.draft_source_hash = computeMemorySourceHash(memory);
  metadata.draft_source_files = [...memory.filesLoaded];
  metadata.digest_prompt_version = DIGEST_PROMPT_VERSION;
  metadata.draft_manually_edited = Boolean(input.manuallyEdited);
  if (input.model) {
    metadata.draft_model = input.model;
  }
  metadata.generated_by = "fedos-home";
  await writeMetadata(root, metadata);

  return getDigestStatus({ ...options, memory });
}

export async function saveFeedback(
  content: string,
  options?: DigestWorkflowOptions,
): Promise<DigestWorkflowStatus> {
  const root = await ensureRoot(options?.digestRoot);
  await writeFile(path.join(root, FEEDBACK_FILENAME), content, "utf-8");
  return getDigestStatus(options);
}

export async function approveDraft(
  options?: DigestWorkflowOptions,
): Promise<DigestWorkflowStatus> {
  const memory = await loadMemory(options);
  const root = await ensureRoot(options?.digestRoot);

  const draftPath = path.join(root, DRAFT_FILENAME);
  const draftContent = await readTextIfExists(draftPath);
  if (draftContent === null) {
    throw new DigestDraftMissingError();
  }

  await writeFile(path.join(root, APPROVED_FILENAME), draftContent, "utf-8");

  const metadata = await readMetadata(root);
  metadata.approved_at = new Date().toISOString();
  metadata.approved_hash = computeMemorySourceHash(memory);
  metadata.approved_source_files = [...memory.filesLoaded];
  metadata.approved_prompt_version = DIGEST_PROMPT_VERSION;
  metadata.generated_by = "fedos-home";
  await writeMetadata(root, metadata);

  return getDigestStatus({ ...options, memory });
}

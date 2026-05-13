import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  computeMemorySourceHash,
  loadMemoryContext,
  type MemoryContext,
} from "./context";

/**
 * Read-only consumer for the approved FedOS Memory Digest.
 *
 * Reads `approved.md` and `metadata.json` from FEDOS_DIGEST_ROOT and reports
 * staleness by comparing the live Memory source hash to the recorded
 * `approved_hash`. Staleness is a warning, never a failure.
 *
 * Home does not author, regenerate, or approve digests. Those workflows
 * remain in FedOS Memory tooling.
 */

const APPROVED_FILENAME = "approved.md";
const METADATA_FILENAME = "metadata.json";

export type ApprovedMemoryDigest = {
  available: boolean;
  root: string | null;
  content: string | null;
  promptBlock: string;
  stale: boolean;
  approvedAt: string | null;
  approvedHash: string | null;
  sourceHash: string;
  sourceFiles: string[];
  filesLoaded: string[];
  filesMissing: string[];
  metadata: Record<string, unknown>;
  warnings: string[];
};

function emptyDigest(
  sourceHash: string,
  warnings: string[],
  memory?: MemoryContext,
  root: string | null = null,
): ApprovedMemoryDigest {
  return {
    available: false,
    root,
    content: null,
    promptBlock: "",
    stale: false,
    approvedAt: null,
    approvedHash: null,
    sourceHash,
    sourceFiles: [],
    filesLoaded: memory ? [...memory.filesLoaded] : [],
    filesMissing: memory ? [...memory.filesMissing] : [],
    metadata: {},
    warnings,
  };
}

async function readTextIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function readMetadata(filePath: string): Promise<Record<string, unknown>> {
  const raw = await readTextIfExists(filePath);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/**
 * Load the approved Memory Digest and compute its staleness relative to live
 * FedOS Memory. Always resolves; never throws on missing files or env vars.
 */
export async function loadApprovedMemoryDigest(options?: {
  memory?: MemoryContext;
  digestRoot?: string;
}): Promise<ApprovedMemoryDigest> {
  const memory = options?.memory ?? (await loadMemoryContext());
  const sourceHash = computeMemorySourceHash(memory);
  const warnings: string[] = [];

  if (!memory.available && memory.error) {
    warnings.push(`Memory context unavailable: ${memory.error}`);
  }

  const digestRoot = options?.digestRoot ?? process.env.FEDOS_DIGEST_ROOT;
  if (!digestRoot) {
    warnings.push("FEDOS_DIGEST_ROOT is not configured");
    return emptyDigest(sourceHash, warnings, memory);
  }

  const resolvedRoot = path.resolve(digestRoot);

  try {
    const rootStat = await stat(resolvedRoot);
    if (!rootStat.isDirectory()) {
      warnings.push(`FEDOS_DIGEST_ROOT is not a directory: ${resolvedRoot}`);
      return emptyDigest(sourceHash, warnings, memory, resolvedRoot);
    }
  } catch {
    warnings.push(`FEDOS_DIGEST_ROOT path does not exist: ${resolvedRoot}`);
    return emptyDigest(sourceHash, warnings, memory, resolvedRoot);
  }

  const metadata = await readMetadata(path.join(resolvedRoot, METADATA_FILENAME));
  const content = await readTextIfExists(path.join(resolvedRoot, APPROVED_FILENAME));

  const approvedHash = asString(metadata.approved_hash);
  const approvedAt = asString(metadata.approved_at);
  const sourceFiles = asStringArray(metadata.approved_source_files);

  const available = content !== null;
  const stale = available && approvedHash !== null && approvedHash !== sourceHash;

  if (!available) {
    warnings.push("Approved digest file not found");
  }
  if (available && approvedHash === null) {
    warnings.push("Approved digest has no recorded approved_hash; staleness unknown");
  }
  if (stale) {
    warnings.push("Approved digest is stale: source Memory has changed since approval");
  }

  return {
    available,
    root: resolvedRoot,
    content,
    promptBlock: available ? formatApprovedMemoryDigestForPrompt(content!, { stale }) : "",
    stale,
    approvedAt,
    approvedHash,
    sourceHash,
    sourceFiles,
    filesLoaded: [...memory.filesLoaded],
    filesMissing: [...memory.filesMissing],
    metadata,
    warnings,
  };
}

export function formatApprovedMemoryDigestForPrompt(
  content: string,
  options: { stale: boolean },
): string {
  if (!content) return "";
  let header = "=== FEDOS MEMORY DIGEST (approved, read-only) ===";
  if (options.stale) {
    header += "\n(NOTE: source Memory has changed since approval — digest is flagged stale)";
  }
  return `${header}\n\n${content.trim()}\n\n=== END OF MEMORY DIGEST ===`;
}

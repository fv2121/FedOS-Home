import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Read-only FedOS Memory context loader for Home.
 *
 * Reads markdown files from FEDOS_MEMORY_ROOT (env var). FedOS Memory is the
 * canonical source of truth and is never written to from Home.
 *
 * If the root is not set or files are missing, loading degrades gracefully
 * (`available: false`, warnings populated, no throw).
 */

export const MEMORY_FILES = [
  "identity/identity.md",
  "system/operating-principles.md",
  "system/permissions.md",
  "system/daily-brief-template.md",
  "system/briefing-sources.md",
  "system/prioritisation-rubric.md",
  "context/current-priorities.md",
  "context/preferences.md",
  "context/stakeholders.md",
  "context/business-context.md",
  "work/open-loops.md",
  "work/commitments.md",
  "work/active-projects.md",
  "logs/decision-log.md",
  "logs/feedback-log.md",
] as const;

export type MemoryRelativePath = (typeof MEMORY_FILES)[number];

export type MemoryContext = {
  available: boolean;
  root: string | null;
  filesLoaded: string[];
  filesMissing: string[];
  sections: Record<string, string>;
  error: string | null;
};

function emptyContext(error: string | null = null): MemoryContext {
  return {
    available: false,
    root: null,
    filesLoaded: [],
    filesMissing: [],
    sections: {},
    error,
  };
}

export async function loadMemoryContext(
  memoryRoot: string | undefined = process.env.FEDOS_MEMORY_ROOT,
): Promise<MemoryContext> {
  if (!memoryRoot) {
    return emptyContext("FEDOS_MEMORY_ROOT is not configured");
  }

  const resolvedRoot = path.resolve(memoryRoot);
  const context: MemoryContext = {
    available: false,
    root: resolvedRoot,
    filesLoaded: [],
    filesMissing: [],
    sections: {},
    error: null,
  };

  try {
    const rootStat = await stat(resolvedRoot);
    if (!rootStat.isDirectory()) {
      context.error = `FEDOS_MEMORY_ROOT is not a directory: ${resolvedRoot}`;
      return context;
    }
  } catch {
    context.error = `FEDOS_MEMORY_ROOT path does not exist: ${resolvedRoot}`;
    return context;
  }

  for (const relPath of MEMORY_FILES) {
    const filePath = path.join(resolvedRoot, relPath);
    try {
      const content = await readFile(filePath, "utf-8");
      context.sections[relPath] = content;
      context.filesLoaded.push(relPath);
    } catch {
      context.filesMissing.push(relPath);
    }
  }

  context.available = context.filesLoaded.length > 0;
  return context;
}

/**
 * Stable SHA-256 over loaded Memory sections.
 *
 * Hash covers (relative path, content) pairs in sorted order so it is
 * deterministic regardless of object key ordering. Missing files do not
 * contribute — they are reported separately via `filesMissing`.
 */
export function computeMemorySourceHash(memory: MemoryContext): string {
  const hasher = createHash("sha256");
  const relPaths = Object.keys(memory.sections).sort();
  for (const relPath of relPaths) {
    hasher.update(relPath, "utf-8");
    hasher.update("\0");
    hasher.update(memory.sections[relPath], "utf-8");
    hasher.update("\0");
  }
  return hasher.digest("hex");
}

export function formatMemoryForPrompt(memory: MemoryContext): string {
  if (!memory.available || Object.keys(memory.sections).length === 0) {
    return "";
  }
  const lines: string[] = ["=== FEDOS MEMORY CONTEXT (read-only) ==="];
  for (const relPath of Object.keys(memory.sections)) {
    lines.push(`\n--- ${relPath} ---`);
    lines.push(memory.sections[relPath].trim());
  }
  lines.push("\n=== END OF MEMORY CONTEXT ===");
  return lines.join("\n");
}

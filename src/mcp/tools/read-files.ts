/**
 * read_files Tool
 *
 * Reads specific files from a previously analyzed repository.
 * Uses the cached repoPath from analyze_repo to access the clone.
 */

import { z } from "zod";
import { readFile, stat } from "fs/promises";
import { join, resolve, normalize } from "path";
import { analysisCache } from "../../core/cache.js";

/**
 * Schema for read_files tool
 */
export const readFilesSchema = {
  analysisId: z
    .string()
    .describe("The analysisId from a previous analyze_repo result"),
  paths: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe("Relative file paths from the repository (max 20)"),
  maxLines: z
    .number()
    .min(1)
    .max(2000)
    .default(500)
    .optional()
    .describe("Maximum lines per file (default 500, max 2000)"),
};

export type ReadFilesInput = {
  analysisId: string;
  paths: string[];
  maxLines?: number;
};

interface FileResult {
  path: string;
  content?: string;
  lineCount?: number;
  truncated?: boolean;
  error?: string;
}

/**
 * Execute read_files tool
 */
export async function executeReadFiles(input: ReadFilesInput): Promise<object> {
  const { analysisId, paths, maxLines = 500 } = input;

  // Look up cached analysis
  const cached = analysisCache.getByAnalysisId(analysisId);
  if (!cached) {
    return {
      error: `Analysis ${analysisId} not found in cache. It may have expired. Run analyze_repo again.`,
    };
  }

  const repoPath = cached.repoPath;
  if (!repoPath) {
    return {
      error: `No repository path stored for analysis ${analysisId}. This analysis predates the read_files feature.`,
    };
  }

  // Verify repo still exists
  try {
    await stat(repoPath);
  } catch {
    return {
      error: `Repository at ${repoPath} is no longer available. Run analyze_repo again.`,
    };
  }

  const resolvedRepoPath = resolve(repoPath);
  const effectiveMaxLines = Math.min(maxLines, 2000);

  // Read files
  const files: FileResult[] = await Promise.all(
    paths.slice(0, 20).map(async (filePath): Promise<FileResult> => {
      // Path traversal prevention
      const normalized = normalize(filePath);
      if (normalized.startsWith("..") || normalized.startsWith("/")) {
        return { path: filePath, error: "Invalid path: must be relative and within the repository" };
      }

      const fullPath = resolve(join(resolvedRepoPath, normalized));
      if (!fullPath.startsWith(resolvedRepoPath)) {
        return { path: filePath, error: "Invalid path: traversal outside repository" };
      }

      try {
        const content = await readFile(fullPath, "utf-8");
        const lines = content.split("\n");
        const truncated = lines.length > effectiveMaxLines;
        const outputContent = truncated
          ? lines.slice(0, effectiveMaxLines).join("\n")
          : content;

        return {
          path: filePath,
          content: outputContent,
          lineCount: lines.length,
          truncated,
        };
      } catch {
        return { path: filePath, error: "File not found or not readable" };
      }
    })
  );

  return {
    analysisId,
    files,
  };
}

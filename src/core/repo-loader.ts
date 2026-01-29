import { readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { glob } from "glob";
import type { FileContent, LoadOptions, RepoContext } from "../types.js";
import {
  getDefaultIgnorePatterns,
  shouldIncludeFile,
  prioritizeFiles,
} from "./file-filter.js";

const DEFAULT_TOKEN_BUDGET = 800_000;
const CHARS_PER_TOKEN = 4;

/**
 * Result of resolving a source to a local path
 */
export interface ResolvedSource {
  repoPath: string;
  cleanup?: () => Promise<void>;
}

/**
 * Resolve a source (local path or GitHub URL) to a local directory path
 * Returns a cleanup function if the source was cloned to a temp directory
 */
export async function resolveSource(source: string): Promise<ResolvedSource> {
  if (await isGitHubUrl(source)) {
    const repoPath = await cloneGitHubRepo(source);

    return {
      repoPath,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        try {
          await rm(repoPath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      },
    };
  }

  // Local path - verify it exists
  const stats = await stat(source);
  if (!stats.isDirectory()) {
    throw new Error(`Source must be a directory: ${source}`);
  }

  return { repoPath: source };
}

export function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

export function estimateTokensForFiles(files: FileContent[]): number {
  return files.reduce((total, file) => {
    const headerTokens = estimateTokens(`\n--- ${file.path} ---\n`);
    const contentTokens = estimateTokens(file.content);
    return total + headerTokens + contentTokens;
  }, 0);
}

async function isGitHubUrl(source: string): Promise<boolean> {
  return (
    source.startsWith("https://github.com/") ||
    source.startsWith("git@github.com:")
  );
}

async function cloneGitHubRepo(url: string): Promise<string> {
  const { execSync } = await import("node:child_process");
  const { mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");

  const tempDir = await mkdtemp(join(tmpdir(), "cba-"));

  const normalizedUrl = url
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

  try {
    execSync(`git clone --depth 1 ${normalizedUrl}.git ${tempDir}`, {
      stdio: "pipe",
    });
  } catch {
    execSync(`git clone --depth 1 ${normalizedUrl} ${tempDir}`, {
      stdio: "pipe",
    });
  }

  return tempDir;
}

export async function loadRepo(
  source: string,
  options: LoadOptions = {}
): Promise<RepoContext> {
  let basePath = source;

  if (await isGitHubUrl(source)) {
    basePath = await cloneGitHubRepo(source);
  }

  const stats = await stat(basePath);
  if (!stats.isDirectory()) {
    throw new Error(`Source must be a directory: ${source}`);
  }

  const ignorePatterns = [
    ...getDefaultIgnorePatterns(),
    ...(options.exclude || []),
  ];

  const allFiles = await glob("**/*", {
    cwd: basePath,
    nodir: true,
    dot: true,
    ignore: ignorePatterns,
  });

  const filteredFiles = allFiles.filter((filePath) =>
    shouldIncludeFile(filePath, options.include, options.exclude)
  );

  const filesWithSize = await Promise.all(
    filteredFiles.map(async (filePath) => {
      const fullPath = join(basePath, filePath);
      const fileStats = await stat(fullPath);
      return { path: filePath, size: fileStats.size };
    })
  );

  const prioritized = prioritizeFiles(filesWithSize);
  const tokenBudget = options.maxTokens || DEFAULT_TOKEN_BUDGET;
  const selectedFiles: FileContent[] = [];
  let currentTokens = 0;

  for (const file of prioritized) {
    const fullPath = join(basePath, file.path);

    try {
      const content = await readFile(fullPath, "utf-8");
      const fileTokens = estimateTokens(content) + estimateTokens(`\n--- ${file.path} ---\n`);

      if (currentTokens + fileTokens > tokenBudget) {
        if (fileTokens > 10000) {
          const truncatedContent = content.slice(0, 20000) + "\n\n... [truncated] ...";
          const truncatedTokens = estimateTokens(truncatedContent);

          if (currentTokens + truncatedTokens <= tokenBudget) {
            selectedFiles.push({
              path: file.path,
              content: truncatedContent,
              size: truncatedContent.length,
            });
            currentTokens += truncatedTokens;
          }
        }
        continue;
      }

      selectedFiles.push({
        path: file.path,
        content,
        size: content.length,
      });
      currentTokens += fileTokens;
    } catch {
      continue;
    }
  }

  return {
    files: selectedFiles,
    tokenCount: currentTokens,
    source,
  };
}

export function formatRepoForPrompt(context: RepoContext): string {
  const parts: string[] = [
    `Repository: ${context.source}`,
    `Files loaded: ${context.files.length}`,
    `Estimated tokens: ${context.tokenCount}`,
    "",
    "=== FILE CONTENTS ===",
    "",
  ];

  for (const file of context.files) {
    parts.push(`--- ${file.path} ---`);
    parts.push(file.content);
    parts.push("");
  }

  return parts.join("\n");
}

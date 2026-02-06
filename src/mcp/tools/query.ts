/**
 * Query Repo Tool
 *
 * Ask questions about a codebase using structural analysis + optional Gemini AI.
 * Reuses cached analysis when available.
 */

import { z } from "zod";
import { basename, join } from "path";
import { readFile } from "fs/promises";
import { resolveSource } from "../../core/repo-loader.js";
import { orchestrateAnalysis } from "../../core/orchestrator.js";
import { analysisCache } from "../../core/cache.js";
import { generateJsonWithGemini } from "../../core/gemini.js";

/**
 * Schema for query_repo tool
 */
export const queryRepoSchema = {
  source: z
    .string()
    .describe("Local path or GitHub URL to the repository"),
  question: z
    .string()
    .describe("Question about the codebase (e.g. 'how is authentication handled?')"),
};

export type QueryRepoInput = {
  source: string;
  question: string;
};

interface RelevantFile {
  path: string;
  reason: string;
}

interface QueryResult {
  answer: string;
  relevantFiles: RelevantFile[];
  confidence: "high" | "medium" | "low";
  suggestedFollowUps: string[];
}

/**
 * Extract repository name from source
 */
function extractSourceName(source: string): string {
  const githubMatch = source.match(/github\.com\/([^\/]+\/[^\/]+)/);
  if (githubMatch) {
    return githubMatch[1].replace(/\.git$/, "");
  }
  return basename(source) || source;
}

/**
 * Score file relevance against a question using keyword matching
 */
function scoreFileRelevance(
  filePath: string,
  symbols: string[],
  question: string
): number {
  const q = question.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  let score = 0;

  const pathLower = filePath.toLowerCase();
  for (const word of words) {
    if (pathLower.includes(word)) score += 3;
  }

  for (const sym of symbols) {
    const symLower = sym.toLowerCase();
    for (const word of words) {
      if (symLower.includes(word)) score += 2;
    }
  }

  return score;
}

/**
 * Execute query_repo tool
 */
export async function executeQueryRepo(input: QueryRepoInput): Promise<QueryResult & { analysisId: string }> {
  const { source, question } = input;

  const sourceName = extractSourceName(source);
  const { repoPath, cleanup } = await resolveSource(source);

  try {
    // Check cache first
    let cached = analysisCache.get(repoPath);
    let analysisId: string;

    if (cached) {
      analysisId = cached.result.analysisId;
    } else {
      // Run standard analysis and cache it
      const result = await orchestrateAnalysis(repoPath, {
        depth: "standard",
        sourceName,
        cleanup,
      });
      analysisId = result.analysisId;
      cached = analysisCache.get(repoPath);

      if (!cached) {
        throw new Error("Analysis completed but cache lookup failed");
      }
    }

    // Build file → symbol index from structural analysis
    const fileSymbols = new Map<string, string[]>();
    for (const mod of cached.structural) {
      for (const sym of mod.symbols) {
        if (sym.file && sym.name) {
          const existing = fileSymbols.get(sym.file) || [];
          existing.push(sym.name);
          fileSymbols.set(sym.file, existing);
        }
      }
      // exports is string[] (symbol names), not objects — associate with modulePath
      if (mod.exports.length > 0) {
        const existing = fileSymbols.get(mod.modulePath) || [];
        existing.push(...mod.exports);
        fileSymbols.set(mod.modulePath, existing);
      }
    }

    // Also include files from the directory structure tree
    const collectFiles = (node: { name: string; type: string; children?: any[] }, prefix: string): void => {
      const path = prefix ? `${prefix}/${node.name}` : node.name;
      if (node.type === "file") {
        if (!fileSymbols.has(path)) {
          fileSymbols.set(path, []);
        }
      } else if (node.children) {
        for (const child of node.children) {
          collectFiles(child, path);
        }
      }
    };
    if (cached.surface.repositoryMap.structure?.children) {
      for (const child of cached.surface.repositoryMap.structure.children) {
        collectFiles(child, "");
      }
    }

    // Score and rank files
    const scored = Array.from(fileSymbols.entries())
      .map(([path, symbols]) => ({
        path,
        symbols,
        score: scoreFileRelevance(path, symbols, question),
      }))
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    // If no scored results, fall back to entry points + main files
    const filesToRead = scored.length > 0
      ? scored.map((f) => f.path)
      : (cached.surface.repositoryMap.entryPoints || []).slice(0, 10);

    // Read file contents (cap at ~100k total chars)
    const fileContents = new Map<string, string>();
    let totalChars = 0;
    const MAX_TOTAL_CHARS = 100_000;
    const MAX_PER_FILE = 4_000;

    for (const filePath of filesToRead) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      const fullPath = join(repoPath, filePath);
      try {
        const content = await readFile(fullPath, "utf-8");
        const truncated = content.length > MAX_PER_FILE
          ? content.slice(0, MAX_PER_FILE) + "\n... [truncated]"
          : content;
        fileContents.set(filePath, truncated);
        totalChars += truncated.length;
      } catch {
        // Skip unreadable files
      }
    }

    // Try Gemini-powered answer
    try {
      return await queryWithGemini(
        question,
        analysisId,
        cached,
        fileContents
      );
    } catch {
      // Fall back to keyword-based answer
      return buildFallbackAnswer(
        question,
        analysisId,
        cached,
        scored,
        fileContents
      );
    }
  } catch (error) {
    // Clean up on error since we may have started a fresh clone
    if (cleanup) {
      await cleanup();
    }
    throw error;
  }
}

/**
 * Query with Gemini AI
 */
async function queryWithGemini(
  question: string,
  analysisId: string,
  cached: NonNullable<ReturnType<typeof analysisCache.get>>,
  fileContents: Map<string, string>
): Promise<QueryResult & { analysisId: string }> {
  const surface = cached.surface;

  const fileSummary = Array.from(fileContents.entries())
    .map(([path, content]) => `--- ${path} ---\n${content}`)
    .join("\n\n");

  const structuralSummary = cached.structural
    .map((mod) => {
      const exports = mod.exports.slice(0, 10).join(", ");
      const funcs = mod.complexity.functionCount;
      const classes = mod.complexity.classCount;
      return `- ${mod.modulePath}: ${funcs} functions, ${classes} classes. Exports: ${exports || "none"}`;
    })
    .join("\n");

  const prompt = `Answer this question about a codebase:

QUESTION: ${question}

Repository: ${surface.repositoryMap.name}
Languages: ${surface.repositoryMap.languages.map((l) => l.language).join(", ")}
Entry points: ${surface.repositoryMap.entryPoints.slice(0, 10).join(", ")}
Modules: ${surface.identifiedModules.map((m) => m.name).join(", ")}

Structural overview:
${structuralSummary}

Relevant file contents:
${fileSummary}

Respond with this exact JSON structure:
{
  "answer": "Clear, detailed answer to the question based on the code",
  "relevantFiles": [
    {"path": "relative/path.ts", "reason": "Why this file is relevant"}
  ],
  "confidence": "high" | "medium" | "low",
  "suggestedFollowUps": ["Follow-up question 1", "Follow-up question 2"]
}

Guidelines:
- Reference specific files and code when possible
- If the code doesn't clearly answer the question, say so and set confidence to "low"
- Suggest 2-3 follow-up questions that would help understand more
- Keep relevantFiles to the most important 5-8 files`;

  const result = await generateJsonWithGemini<QueryResult>(prompt, {
    maxOutputTokens: 4096,
  });

  return { ...result, analysisId };
}

/**
 * Build fallback answer from keyword matching (no Gemini)
 */
function buildFallbackAnswer(
  question: string,
  analysisId: string,
  cached: NonNullable<ReturnType<typeof analysisCache.get>>,
  scored: { path: string; symbols: string[]; score: number }[],
  fileContents: Map<string, string>
): QueryResult & { analysisId: string } {
  const surface = cached.surface;
  const topFiles = scored.slice(0, 8);

  const relevantFiles: RelevantFile[] = topFiles.map((f) => ({
    path: f.path,
    reason: f.symbols.length > 0
      ? `Contains relevant symbols: ${f.symbols.slice(0, 5).join(", ")}`
      : `File path matches question keywords`,
  }));

  const answer = topFiles.length > 0
    ? `Based on keyword matching against the codebase structure, the most relevant files for "${question}" are listed below. ` +
      `The repository is a ${surface.repositoryMap.languages[0]?.language || "unknown"} project with ${surface.repositoryMap.fileCount} files. ` +
      `For a more detailed answer, ensure GEMINI_API_KEY is set. ` +
      `Use read_files with analysisId "${analysisId}" to examine the relevant files.`
    : `Could not find files matching "${question}" through keyword search. ` +
      `The repository contains ${surface.repositoryMap.fileCount} files primarily in ${surface.repositoryMap.languages[0]?.language || "unknown"}. ` +
      `Try rephrasing the question or use read_files with analysisId "${analysisId}" to explore specific files. ` +
      `For AI-powered answers, set GEMINI_API_KEY.`;

  return {
    answer,
    relevantFiles,
    confidence: topFiles.length > 3 ? "medium" : "low",
    analysisId,
    suggestedFollowUps: [
      `Use read_files to examine: ${topFiles.slice(0, 3).map((f) => f.path).join(", ")}`,
      `Use expand_section to drill into specific modules`,
      `Use trace_dataflow to follow data through the system`,
    ],
  };
}

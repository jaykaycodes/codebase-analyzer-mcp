/**
 * Find Patterns Tool
 *
 * Targeted analysis for architecture pattern detection.
 * Uses structural analysis + Gemini to identify design patterns.
 */

import { z } from "zod";
import { resolveSource } from "../../core/repo-loader.js";
import { surfaceAnalysis, analyzeModulesStructurally, loadModuleFiles } from "../../core/layers/index.js";
import { generateJsonWithGemini } from "../../core/gemini.js";
import { join } from "path";
import { readFile } from "fs/promises";
import { glob } from "glob";

/**
 * Common design patterns to detect
 */
export const DETECTABLE_PATTERNS = [
  "singleton",
  "factory",
  "observer",
  "strategy",
  "decorator",
  "adapter",
  "facade",
  "repository",
  "dependency-injection",
  "event-driven",
  "pub-sub",
  "middleware",
  "mvc",
  "mvvm",
  "clean-architecture",
  "hexagonal",
  "cqrs",
  "saga",
] as const;

export type PatternType = (typeof DETECTABLE_PATTERNS)[number];

/**
 * Schema for find_patterns tool
 */
export const findPatternsSchema = {
  source: z
    .string()
    .describe("Local path or GitHub URL to the repository"),
  patternTypes: z
    .array(z.string())
    .optional()
    .describe(`Optional: specific patterns to look for. Available: ${DETECTABLE_PATTERNS.join(", ")}`),
};

export type FindPatternsInput = {
  source: string;
  patternTypes?: string[];
};

interface PatternMatch {
  pattern: string;
  confidence: "high" | "medium" | "low";
  locations: {
    file: string;
    description: string;
  }[];
  explanation: string;
}

interface PatternAnalysisResult {
  patternsFound: PatternMatch[];
  patternsNotFound: string[];
  summary: string;
  recommendations: string[];
}

/**
 * Execute find_patterns tool
 */
export async function executeFindPatterns(input: FindPatternsInput): Promise<PatternAnalysisResult> {
  const { source, patternTypes } = input;

  // Resolve source
  const { repoPath, cleanup } = await resolveSource(source);

  try {
    // Run surface analysis to get structure
    const surface = await surfaceAnalysis(repoPath, {});

    // Load key files for pattern analysis
    const fileContents = new Map<string, string>();
    const keyFiles = await glob("**/*.{ts,js,py,java,go,rb,rs}", {
      cwd: repoPath,
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
    });

    // Load up to 50 key files
    for (const file of keyFiles.slice(0, 50)) {
      const fullPath = join(repoPath, file);
      try {
        const content = await readFile(fullPath, "utf-8");
        if (content.length < 50000) {
          fileContents.set(file, content);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Build file content summary for prompt
    const fileSummary = Array.from(fileContents.entries())
      .map(([path, content]) => {
        // Truncate large files for prompt
        const truncated = content.length > 5000
          ? content.slice(0, 5000) + "\n... [truncated]"
          : content;
        return `--- ${path} ---\n${truncated}`;
      })
      .join("\n\n");

    // Determine patterns to search for
    const patternsToFind = patternTypes?.length
      ? patternTypes
      : [...DETECTABLE_PATTERNS];

    // Use Gemini to analyze patterns
    const prompt = `Analyze this codebase for the following design patterns: ${patternsToFind.join(", ")}

Repository structure:
${JSON.stringify(surface.identifiedModules, null, 2)}

Primary language: ${surface.repositoryMap.languages[0]?.language || "Unknown"}

File contents:
${fileSummary}

For each pattern, determine:
1. Is it present? (yes/no)
2. Confidence level (high/medium/low)
3. Which files implement it
4. Brief explanation of how it's implemented

Respond with this exact JSON structure:
{
  "patternsFound": [
    {
      "pattern": "pattern-name",
      "confidence": "high|medium|low",
      "locations": [
        { "file": "path/to/file.ts", "description": "Brief description of implementation" }
      ],
      "explanation": "How this pattern is implemented in the codebase"
    }
  ],
  "patternsNotFound": ["pattern-name"],
  "summary": "Overall summary of architectural patterns in this codebase",
  "recommendations": ["Suggestions for pattern improvements or additions"]
}`;

    const result = await generateJsonWithGemini<PatternAnalysisResult>(prompt, {
      maxOutputTokens: 4096,
    });

    return result;
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

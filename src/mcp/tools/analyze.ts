/**
 * Enhanced analyze_repo Tool (v2)
 *
 * Uses the orchestrator for multi-layer analysis with progressive disclosure.
 */

import { z } from "zod";
import { orchestrateAnalysis } from "../../core/orchestrator.js";
import { resolveSource } from "../../core/repo-loader.js";
import type { AnalysisDepth } from "../../types.js";

/**
 * Schema for analyze_repo tool
 */
export const analyzeRepoSchema = {
  source: z
    .string()
    .describe("Local path or GitHub URL to the repository"),
  depth: z
    .enum(["surface", "standard", "deep"])
    .default("standard")
    .describe("Analysis depth: surface (fast), standard (balanced), deep (thorough)"),
  focus: z
    .array(z.string())
    .optional()
    .describe("Optional: specific modules or paths to focus analysis on"),
  exclude: z
    .array(z.string())
    .optional()
    .describe("Optional: glob patterns to exclude from analysis"),
  tokenBudget: z
    .number()
    .optional()
    .describe("Optional: maximum token budget for analysis (default: 800,000)"),
  includeSemantics: z
    .boolean()
    .default(false)
    .describe("Include deep semantic analysis using LLM (slower, more expensive)"),
};

export type AnalyzeRepoInput = {
  source: string;
  depth?: AnalysisDepth;
  focus?: string[];
  exclude?: string[];
  tokenBudget?: number;
  includeSemantics?: boolean;
};

/**
 * Execute analyze_repo tool
 */
export async function executeAnalyzeRepo(input: AnalyzeRepoInput): Promise<object> {
  const {
    source,
    depth = "standard",
    focus,
    exclude,
    tokenBudget,
    includeSemantics = false,
  } = input;

  // Resolve source (local path or GitHub URL)
  const { repoPath, cleanup } = await resolveSource(source);

  try {
    // Run orchestrated analysis
    const result = await orchestrateAnalysis(repoPath, {
      depth,
      focus,
      exclude,
      tokenBudget,
      includeSemantics,
    });

    return result;
  } finally {
    // Clean up temp directory if it was a GitHub clone
    if (cleanup) {
      await cleanup();
    }
  }
}

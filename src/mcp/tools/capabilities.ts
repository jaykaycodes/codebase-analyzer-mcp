/**
 * Capability Discovery Tool
 *
 * Allows agents to discover available analysis types, supported languages,
 * and cost estimates before requesting analysis.
 */

import { z } from "zod";
import { getAnalysisCapabilities } from "../../core/orchestrator.js";
import { AVAILABLE_MODELS, type GeminiModel } from "../../core/gemini.js";

/**
 * Schema for get_analysis_capabilities tool (no inputs required)
 */
export const getCapabilitiesSchema = {};

/**
 * Response type for capability discovery
 */
export interface CapabilitiesResponse {
  layers: string[];
  depths: string[];
  tools: {
    name: string;
    description: string;
    parameters: string[];
  }[];
  supportedLanguages: string[];
  models: {
    available: readonly string[];
    default: string;
    note: string;
  };
  tokenBudget: {
    default: number;
    recommended: {
      small: number;
      medium: number;
      large: number;
    };
  };
  estimateCost: (fileCount: number, depth: "surface" | "standard" | "deep") => number;
}

/**
 * Get analysis capabilities
 */
export function getCapabilities(): CapabilitiesResponse {
  const baseCapabilities = getAnalysisCapabilities();

  return {
    ...baseCapabilities,
    tools: [
      {
        name: "analyze_repo",
        description: "Full repository analysis with progressive disclosure",
        parameters: ["source", "depth", "focus", "exclude", "tokenBudget", "includeSemantics"],
      },
      {
        name: "expand_section",
        description: "Expand a section from a previous analysis for more detail",
        parameters: ["analysisId", "sectionId", "depth"],
      },
      {
        name: "find_patterns",
        description: "Detect architecture patterns in the codebase",
        parameters: ["source", "patternTypes"],
      },
      {
        name: "trace_dataflow",
        description: "Trace data flow from entry point to destination",
        parameters: ["source", "from", "to"],
      },
      {
        name: "extract_feature",
        description: "Analyze how a specific feature is implemented",
        parameters: ["source", "feature"],
      },
      {
        name: "query_repo",
        description: "Ask questions about the codebase",
        parameters: ["source", "question"],
      },
      {
        name: "compare_repos",
        description: "Compare how repositories approach the same problem",
        parameters: ["sources", "aspect"],
      },
    ],
    models: {
      available: AVAILABLE_MODELS,
      default: "gemini-3-flash-preview",
      note: "Set GEMINI_MODEL env var to override default",
    },
    tokenBudget: {
      default: 800_000,
      recommended: {
        small: 100_000,   // < 50 files
        medium: 400_000,  // 50-500 files
        large: 800_000,   // 500+ files
      },
    },
  };
}

/**
 * Format capabilities for MCP response
 */
export function formatCapabilitiesResponse(): object {
  const caps = getCapabilities();

  // Remove function from response (can't serialize)
  const { estimateCost, ...rest } = caps;

  return {
    ...rest,
    costEstimates: {
      note: "Approximate token costs by depth",
      surface: "~10% of base tokens (fast, cheap)",
      standard: "~30% of base tokens (balanced)",
      deep: "~60% of base tokens (thorough, expensive)",
      formula: "baseTokens = fileCount * 500 (avg tokens per file)",
    },
  };
}

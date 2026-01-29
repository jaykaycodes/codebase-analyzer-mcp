/**
 * Expand Section Tool
 *
 * Allows agents to drill into specific sections of a previous analysis
 * for more detail without re-analyzing the entire repository.
 */

import { z } from "zod";
import { expandAnalysisSection } from "../../core/orchestrator.js";

/**
 * Schema for expand_section tool
 */
export const expandSectionSchema = {
  analysisId: z
    .string()
    .describe("The analysisId from a previous analyze_repo result"),
  sectionId: z
    .string()
    .describe("The section ID to expand (from sections[].id in analysis result)"),
  depth: z
    .enum(["detail", "full"])
    .default("detail")
    .describe("Expansion depth: detail (more info) or full (complete analysis)"),
};

export type ExpandSectionInput = {
  analysisId: string;
  sectionId: string;
  depth?: "detail" | "full";
};

/**
 * Execute expand_section tool
 */
export async function executeExpandSection(input: ExpandSectionInput): Promise<object> {
  const { analysisId, sectionId, depth = "detail" } = input;

  const result = await expandAnalysisSection(analysisId, sectionId, depth);

  if (result.error) {
    throw new Error(result.error);
  }

  if (!result.section) {
    throw new Error(`Section ${sectionId} not found in analysis ${analysisId}`);
  }

  return {
    analysisId,
    sectionId,
    expandedTo: depth,
    section: result.section,
  };
}

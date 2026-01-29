/**
 * Progressive Disclosure System
 *
 * Manages the transformation of analysis results into expandable sections
 * with cost estimation for token-aware expansion.
 */

import { randomUUID } from "crypto";
import type {
  AnalysisResultV2,
  AnalysisSummary,
  ExpandableSection,
  SemanticAnalysis,
  StructuralAnalysis,
  SurfaceAnalysis,
  AgentDigest,
  AnalysisDepth,
} from "../types.js";

/**
 * Characters per token estimate (conservative)
 */
const CHARS_PER_TOKEN = 4;

/**
 * Generate a unique analysis ID
 */
export function generateAnalysisId(): string {
  return `analysis_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

/**
 * Estimate token count for an object
 */
export function estimateTokens(obj: unknown): number {
  const json = JSON.stringify(obj);
  return Math.ceil(json.length / CHARS_PER_TOKEN);
}

/**
 * Build analysis result with progressive disclosure
 */
export function buildAnalysisResult(
  analysisId: string,
  source: string,
  depth: AnalysisDepth,
  surface: SurfaceAnalysis,
  structural: StructuralAnalysis[],
  semantic: SemanticAnalysis | null,
  durationMs: number
): AnalysisResultV2 {
  // Build summary from available data
  const summary = buildSummary(surface, structural, semantic);

  // Build expandable sections
  const sections = buildExpandableSections(surface, structural, semantic);

  // Build agent digest
  const forAgent = buildAgentDigest(surface, summary, sections);

  // Calculate total token cost
  const tokenCost = estimateTokens({
    repositoryMap: surface.repositoryMap,
    summary,
    sections: sections.map((s) => ({ id: s.id, title: s.title, summary: s.summary })),
    forAgent,
  });

  return {
    analysisId,
    version: 2,
    timestamp: new Date().toISOString(),
    source,
    depth,
    tokenCost,
    durationMs,
    repositoryMap: surface.repositoryMap,
    summary,
    sections,
    forAgent,
  };
}

/**
 * Build summary from analysis data
 */
function buildSummary(
  surface: SurfaceAnalysis,
  structural: StructuralAnalysis[],
  semantic: SemanticAnalysis | null
): AnalysisSummary {
  // Determine architecture type
  let architectureType = "unknown";
  if (semantic?.architectureType) {
    architectureType = semantic.architectureType;
  } else {
    // Infer from structure
    const modules = surface.identifiedModules.map((m) => m.name.toLowerCase());
    if (modules.some((m) => ["controllers", "routes", "api"].includes(m))) {
      architectureType = "web-application";
    } else if (modules.some((m) => ["components", "views"].includes(m))) {
      architectureType = "component-based";
    } else if (modules.some((m) => ["lib", "pkg"].includes(m))) {
      architectureType = "library";
    }
  }

  // Get primary patterns
  const primaryPatterns: string[] = [];
  if (semantic?.patterns) {
    primaryPatterns.push(
      ...semantic.patterns
        .filter((p) => p.confidence > 0.7)
        .slice(0, 5)
        .map((p) => p.name)
    );
  }

  // Build tech stack from languages and dependencies
  const techStack = surface.repositoryMap.languages.slice(0, 5).map((l) => l.language);

  // Determine complexity level
  let complexity: "low" | "medium" | "high" = "medium";
  if (surface.complexity < 30) {
    complexity = "low";
  } else if (surface.complexity > 70) {
    complexity = "high";
  }

  return {
    architectureType,
    primaryPatterns,
    techStack,
    complexity,
  };
}

/**
 * Build expandable sections from analysis data
 */
function buildExpandableSections(
  surface: SurfaceAnalysis,
  structural: StructuralAnalysis[],
  semantic: SemanticAnalysis | null
): ExpandableSection[] {
  const sections: ExpandableSection[] = [];

  // Module sections
  for (const module of surface.identifiedModules.slice(0, 10)) {
    const structuralData = structural.find((s) => s.modulePath === module.path);

    const section: ExpandableSection = {
      id: `module_${module.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
      title: `Module: ${module.name}`,
      type: "module",
      summary: `${module.type} module with ${module.fileCount} files in ${module.primaryLanguage}`,
      canExpand: !!structuralData,
      expansionCost: {
        detail: structuralData ? estimateTokens(structuralData.symbols.slice(0, 20)) : 0,
        full: structuralData ? estimateTokens(structuralData) : 0,
      },
    };

    if (structuralData) {
      section.detail = {
        exports: structuralData.exports,
        complexity: structuralData.complexity,
        symbolCount: structuralData.symbols.length,
        importCount: structuralData.imports.length,
      };
    }

    sections.push(section);
  }

  // Pattern sections (if semantic analysis was done)
  if (semantic?.patterns && semantic.patterns.length > 0) {
    sections.push({
      id: "patterns_overview",
      title: "Design Patterns",
      type: "pattern",
      summary: `${semantic.patterns.length} patterns detected: ${semantic.patterns.slice(0, 3).map((p) => p.name).join(", ")}${semantic.patterns.length > 3 ? "..." : ""}`,
      canExpand: true,
      expansionCost: {
        detail: estimateTokens(semantic.patterns.slice(0, 5)),
        full: estimateTokens(semantic.patterns),
      },
      detail: {
        patternCount: semantic.patterns.length,
        topPatterns: semantic.patterns.slice(0, 5).map((p) => ({
          name: p.name,
          type: p.type,
          confidence: p.confidence,
        })),
      },
    });
  }

  // Data models section
  if (semantic?.dataModels && semantic.dataModels.length > 0) {
    sections.push({
      id: "data_models",
      title: "Data Models",
      type: "datamodel",
      summary: `${semantic.dataModels.length} data models: ${semantic.dataModels.slice(0, 3).map((m) => m.name).join(", ")}${semantic.dataModels.length > 3 ? "..." : ""}`,
      canExpand: true,
      expansionCost: {
        detail: estimateTokens(semantic.dataModels.slice(0, 5)),
        full: estimateTokens(semantic.dataModels),
      },
      detail: {
        modelCount: semantic.dataModels.length,
        models: semantic.dataModels.slice(0, 5).map((m) => ({
          name: m.name,
          fieldCount: m.fields.length,
        })),
      },
    });
  }

  // API endpoints section
  if (semantic?.apiEndpoints && semantic.apiEndpoints.length > 0) {
    sections.push({
      id: "api_endpoints",
      title: "API Endpoints",
      type: "api",
      summary: `${semantic.apiEndpoints.length} endpoints detected`,
      canExpand: true,
      expansionCost: {
        detail: estimateTokens(semantic.apiEndpoints.slice(0, 10)),
        full: estimateTokens(semantic.apiEndpoints),
      },
      detail: {
        endpointCount: semantic.apiEndpoints.length,
        endpoints: semantic.apiEndpoints.slice(0, 10),
      },
    });
  }

  return sections;
}

/**
 * Build agent-optimized digest
 */
function buildAgentDigest(
  surface: SurfaceAnalysis,
  summary: AnalysisSummary,
  sections: ExpandableSection[]
): AgentDigest {
  const { repositoryMap, complexity } = surface;

  // Quick summary (2-3 sentences)
  const quickSummary = `${repositoryMap.name} is a ${summary.complexity} complexity ${summary.architectureType} codebase with ${repositoryMap.fileCount} files primarily in ${repositoryMap.languages[0]?.language || "mixed languages"}. ${summary.primaryPatterns.length > 0 ? `Key patterns include ${summary.primaryPatterns.slice(0, 3).join(", ")}.` : ""}`;

  // Key insights
  const keyInsights: string[] = [];

  // Add language insights
  if (repositoryMap.languages.length > 1) {
    keyInsights.push(
      `Multi-language codebase: ${repositoryMap.languages.slice(0, 3).map((l) => `${l.language} (${l.percentage}%)`).join(", ")}`
    );
  }

  // Add complexity insights
  if (complexity > 70) {
    keyInsights.push("High complexity score suggests thorough analysis recommended");
  }

  // Add entry point insights
  if (repositoryMap.entryPoints.length > 0) {
    keyInsights.push(`Main entry points: ${repositoryMap.entryPoints.slice(0, 3).join(", ")}`);
  }

  // Add pattern insights
  if (summary.primaryPatterns.length > 0) {
    keyInsights.push(`Detected patterns: ${summary.primaryPatterns.join(", ")}`);
  }

  // Suggested next steps
  const suggestedNextSteps: string[] = [];

  // Suggest expansion based on what's available
  const expandableSections = sections.filter((s) => s.canExpand);
  if (expandableSections.length > 0) {
    suggestedNextSteps.push(
      `Expand sections for details: ${expandableSections.slice(0, 3).map((s) => s.id).join(", ")}`
    );
  }

  // Suggest semantic analysis if not done
  if (!sections.some((s) => s.type === "pattern")) {
    suggestedNextSteps.push("Run with includeSemantics=true for pattern detection");
  }

  // Suggest focus areas based on complexity
  if (complexity > 50) {
    const coreModules = surface.identifiedModules
      .filter((m) => m.type === "core")
      .slice(0, 3);
    if (coreModules.length > 0) {
      suggestedNextSteps.push(
        `Focus on core modules: ${coreModules.map((m) => m.name).join(", ")}`
      );
    }
  }

  return {
    quickSummary,
    keyInsights,
    suggestedNextSteps,
  };
}

/**
 * Expand a specific section to detail or full level
 */
export function expandSection(
  result: AnalysisResultV2,
  sectionId: string,
  level: "detail" | "full",
  structural: StructuralAnalysis[],
  semantic: SemanticAnalysis | null
): ExpandableSection | null {
  const section = result.sections.find((s) => s.id === sectionId);
  if (!section || !section.canExpand) {
    return null;
  }

  // Deep copy section
  const expanded: ExpandableSection = JSON.parse(JSON.stringify(section));

  // Add detail based on section type
  if (section.type === "module") {
    const modulePath = section.id.replace("module_", "").replace(/_/g, "/");
    const structuralData = structural.find((s) => s.modulePath === modulePath);

    if (structuralData) {
      if (level === "detail") {
        expanded.detail = {
          exports: structuralData.exports,
          complexity: structuralData.complexity,
          topSymbols: structuralData.symbols.slice(0, 20).map((s) => ({
            name: s.name,
            type: s.type,
            line: s.line,
          })),
          importCount: structuralData.imports.length,
        };
      } else {
        expanded.full = {
          ...structuralData,
        };
      }
    }
  } else if (section.type === "pattern" && semantic) {
    if (level === "detail") {
      expanded.detail = {
        patterns: semantic.patterns.slice(0, 10),
      };
    } else {
      expanded.full = {
        patterns: semantic.patterns,
        crossFileRelationships: semantic.crossFileRelationships,
      };
    }
  } else if (section.type === "datamodel" && semantic) {
    if (level === "detail") {
      expanded.detail = {
        models: semantic.dataModels.slice(0, 10),
      };
    } else {
      expanded.full = {
        models: semantic.dataModels,
      };
    }
  } else if (section.type === "api" && semantic) {
    if (level === "detail") {
      expanded.detail = {
        endpoints: semantic.apiEndpoints.slice(0, 20),
      };
    } else {
      expanded.full = {
        endpoints: semantic.apiEndpoints,
      };
    }
  }

  return expanded;
}

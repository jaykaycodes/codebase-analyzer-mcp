/**
 * Semantic Layer Analysis
 *
 * Uses Gemini LLM for deep semantic analysis:
 * - Architecture pattern detection
 * - Cross-file relationship inference
 * - Design pattern recognition
 * - Code quality insights
 *
 * This is the most expensive layer - only run when explicitly requested.
 */

import type {
  ApiEndpoint,
  DataModel,
  DetectedPattern,
  SemanticAnalysis,
  StructuralAnalysis,
  SurfaceAnalysis,
} from "../../types.js";
import { generateJsonWithGemini, hasGeminiKey } from "../gemini.js";

/**
 * Semantic analysis prompt template
 */
const SEMANTIC_ANALYSIS_PROMPT = `You are an expert software architect analyzing a codebase. Based on the structural analysis provided, perform deep semantic analysis.

## Repository Overview
Name: {REPO_NAME}
Primary Languages: {LANGUAGES}
File Count: {FILE_COUNT}
Complexity Score: {COMPLEXITY}

## Structural Analysis Summary
{STRUCTURAL_SUMMARY}

## Key Symbols and Relationships
{SYMBOLS_SUMMARY}

## Import Graph
{IMPORT_GRAPH}

Analyze this codebase and provide a detailed JSON response with the following structure:

{
  "architectureType": "string - one of: monolith, modular-monolith, microservices, serverless, event-driven, layered, hexagonal, clean-architecture, mvc, mvvm, other",
  "patterns": [
    {
      "name": "string - pattern name (e.g., Singleton, Factory, Repository, etc.)",
      "type": "architectural | design | anti-pattern",
      "confidence": "number 0-1",
      "locations": ["file paths where pattern is found"],
      "description": "brief explanation of how pattern is implemented"
    }
  ],
  "dataModels": [
    {
      "name": "string - model/entity name",
      "fields": ["field names"],
      "relationships": ["relationship descriptions"]
    }
  ],
  "apiEndpoints": [
    {
      "path": "string - route path",
      "method": "GET | POST | PUT | DELETE | PATCH",
      "purpose": "string - what this endpoint does"
    }
  ],
  "crossFileRelationships": [
    {
      "from": "file path",
      "to": "file path",
      "relationship": "description of relationship (e.g., 'imports and extends', 'dependency injection', 'event emission')"
    }
  ],
  "insights": [
    "key insight 1",
    "key insight 2",
    "..."
  ]
}

Focus on:
1. Identifying the dominant architectural pattern
2. Detecting design patterns (both good and problematic)
3. Understanding data model relationships
4. Finding API/route definitions
5. Noting cross-cutting concerns (logging, auth, validation)

Be specific and reference actual file paths when possible.`;

/**
 * Perform semantic analysis using Gemini
 */
export async function semanticAnalysis(
  surface: SurfaceAnalysis,
  structural: StructuralAnalysis[],
  options: {
    tokenBudget?: number;
    focusAreas?: string[];
  } = {}
): Promise<SemanticAnalysis> {
  if (!hasGeminiKey()) {
    throw new Error(
      "Semantic analysis (deep depth) requires GEMINI_API_KEY.\n\n" +
      "To set it up, add the env var to your MCP server config in ~/.mcp.json:\n\n" +
      '  "codebase-analyzer": {\n' +
      '    "command": "npx",\n' +
      '    "args": ["-y", "codebase-analyzer-mcp"],\n' +
      '    "env": { "GEMINI_API_KEY": "your_key" }\n' +
      "  }\n\n" +
      "Get a free key at https://aistudio.google.com/apikey\n\n" +
      "Use --depth surface or --depth standard for free analysis without an API key."
    );
  }

  // Build context for LLM
  const repoName = surface.repositoryMap.name;
  const languages = surface.repositoryMap.languages
    .slice(0, 5)
    .map((l) => `${l.language} (${l.percentage}%)`)
    .join(", ");
  const fileCount = surface.repositoryMap.fileCount;
  const complexity = surface.complexity;

  // Summarize structural analysis
  const structuralSummary = summarizeStructuralAnalysis(structural);
  const symbolsSummary = summarizeSymbols(structural);
  const importGraph = summarizeImports(structural);

  // Build prompt
  const prompt = SEMANTIC_ANALYSIS_PROMPT
    .replace("{REPO_NAME}", repoName)
    .replace("{LANGUAGES}", languages)
    .replace("{FILE_COUNT}", String(fileCount))
    .replace("{COMPLEXITY}", String(complexity))
    .replace("{STRUCTURAL_SUMMARY}", structuralSummary)
    .replace("{SYMBOLS_SUMMARY}", symbolsSummary)
    .replace("{IMPORT_GRAPH}", importGraph);

  // Call Gemini
  const result = await generateJsonWithGemini<SemanticAnalysisResponse>(prompt, {
    maxOutputTokens: options.tokenBudget || 8192,
    temperature: 0.1, // Low temperature for more consistent analysis
  });

  // Transform response to our types
  return {
    architectureType: result.architectureType || "unknown",
    patterns: (result.patterns || []).map((p) => ({
      name: p.name,
      type: p.type as "architectural" | "design" | "anti-pattern",
      confidence: p.confidence,
      locations: p.locations || [],
      description: p.description,
    })),
    dataModels: (result.dataModels || []).map((m) => ({
      name: m.name,
      fields: m.fields || [],
      relationships: m.relationships || [],
    })),
    apiEndpoints: (result.apiEndpoints || []).map((e) => ({
      path: e.path,
      method: e.method,
      purpose: e.purpose,
    })),
    crossFileRelationships: (result.crossFileRelationships || []).map((r) => ({
      from: r.from,
      to: r.to,
      relationship: r.relationship,
    })),
    insights: result.insights || [],
  };
}

/**
 * Response type from Gemini
 */
interface SemanticAnalysisResponse {
  architectureType: string;
  patterns: Array<{
    name: string;
    type: string;
    confidence: number;
    locations: string[];
    description: string;
  }>;
  dataModels: Array<{
    name: string;
    fields: string[];
    relationships: string[];
  }>;
  apiEndpoints: Array<{
    path: string;
    method: string;
    purpose: string;
  }>;
  crossFileRelationships: Array<{
    from: string;
    to: string;
    relationship: string;
  }>;
  insights: string[];
}

/**
 * Summarize structural analysis for prompt
 */
function summarizeStructuralAnalysis(analyses: StructuralAnalysis[]): string {
  const summary: string[] = [];

  for (const analysis of analyses.slice(0, 10)) {
    // Limit to 10 modules
    summary.push(
      `### ${analysis.modulePath}
- Lines of Code: ${analysis.complexity.linesOfCode}
- Functions: ${analysis.complexity.functionCount}
- Classes: ${analysis.complexity.classCount}
- Cyclomatic Complexity: ${analysis.complexity.cyclomaticComplexity}
- Exports: ${analysis.exports.slice(0, 10).join(", ")}${analysis.exports.length > 10 ? "..." : ""}`
    );
  }

  if (analyses.length > 10) {
    summary.push(`\n... and ${analyses.length - 10} more modules`);
  }

  return summary.join("\n\n");
}

/**
 * Summarize key symbols
 */
function summarizeSymbols(analyses: StructuralAnalysis[]): string {
  const allSymbols = analyses.flatMap((a) => a.symbols);

  // Group by type
  const byType = new Map<string, string[]>();
  for (const symbol of allSymbols) {
    const list = byType.get(symbol.type) || [];
    if (list.length < 20) {
      // Limit per type
      list.push(`${symbol.name} (${symbol.file}:${symbol.line})`);
    }
    byType.set(symbol.type, list);
  }

  const summary: string[] = [];
  for (const [type, symbols] of byType.entries()) {
    summary.push(`**${type}s**: ${symbols.join(", ")}`);
  }

  return summary.join("\n");
}

/**
 * Summarize import relationships
 */
function summarizeImports(analyses: StructuralAnalysis[]): string {
  const imports = analyses.flatMap((a) => a.imports);

  // Group by target module
  const importCounts = new Map<string, number>();
  for (const imp of imports) {
    const count = importCounts.get(imp.to) || 0;
    importCounts.set(imp.to, count + 1);
  }

  // Sort by count and take top 20
  const topImports = Array.from(importCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return topImports.map(([module, count]) => `- ${module}: imported ${count} times`).join("\n");
}

/**
 * Quick semantic hints without full LLM analysis
 * Used for surface-level pattern detection
 */
export function quickSemanticHints(
  surface: SurfaceAnalysis,
  structural: StructuralAnalysis[]
): {
  likelyArchitecture: string;
  possiblePatterns: string[];
  suggestedFocus: string[];
} {
  const hints = {
    likelyArchitecture: "unknown",
    possiblePatterns: [] as string[],
    suggestedFocus: [] as string[],
  };

  const { repositoryMap, identifiedModules } = surface;

  // Detect architecture from structure
  const hasRoutes = identifiedModules.some((m) =>
    ["routes", "api", "controllers", "pages"].includes(m.name.toLowerCase())
  );
  const hasModels = identifiedModules.some((m) =>
    ["models", "entities", "schemas"].includes(m.name.toLowerCase())
  );
  const hasServices = identifiedModules.some((m) =>
    ["services", "use-cases", "usecases"].includes(m.name.toLowerCase())
  );

  if (hasRoutes && hasModels && hasServices) {
    hints.likelyArchitecture = "layered";
    hints.possiblePatterns.push("MVC", "Service Layer", "Repository Pattern");
  } else if (repositoryMap.languages[0]?.language === "TypeScript") {
    const hasComponents = identifiedModules.some((m) =>
      ["components", "views", "ui"].includes(m.name.toLowerCase())
    );
    if (hasComponents) {
      hints.likelyArchitecture = "component-based";
      hints.possiblePatterns.push("Component Pattern", "Container/Presentational");
    }
  }

  // Check for common patterns in symbols
  const allSymbols = structural.flatMap((s) => s.symbols);
  const symbolNames = allSymbols.map((s) => s.name.toLowerCase());

  if (symbolNames.some((n) => n.includes("singleton") || n.includes("instance"))) {
    hints.possiblePatterns.push("Singleton");
  }
  if (symbolNames.some((n) => n.includes("factory") || n.includes("create"))) {
    hints.possiblePatterns.push("Factory");
  }
  if (symbolNames.some((n) => n.includes("observer") || n.includes("subscribe"))) {
    hints.possiblePatterns.push("Observer");
  }
  if (symbolNames.some((n) => n.includes("repository") || n.includes("store"))) {
    hints.possiblePatterns.push("Repository");
  }

  // Suggest focus areas
  if (surface.complexity > 60) {
    hints.suggestedFocus.push("High complexity - consider semantic analysis for patterns");
  }
  if (repositoryMap.fileCount > 500) {
    hints.suggestedFocus.push("Large codebase - focus on core modules first");
  }

  return hints;
}

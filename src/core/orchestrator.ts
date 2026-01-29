/**
 * Analysis Orchestrator
 *
 * Coordinates multi-phase analysis:
 * 1. Surface scan (always runs, fast)
 * 2. Structural analysis (parallel by module)
 * 3. Semantic analysis (conditional, expensive)
 * 4. Synthesis with progressive disclosure
 *
 * Handles partial failures gracefully and tracks token budget.
 */

import { join } from "path";
import { readFile } from "fs/promises";
import type {
  AnalysisDepth,
  AnalysisOptions,
  AnalysisResultV2,
  OrchestratorState,
  SemanticAnalysis,
  StructuralAnalysis,
  SubAgentTask,
} from "../types.js";
import {
  surfaceAnalysis,
  analyzeModulesStructurally,
  loadModuleFiles,
  semanticAnalysis,
  quickSemanticHints,
} from "./layers/index.js";
import { analysisCache } from "./cache.js";
import { buildAnalysisResult, generateAnalysisId } from "./disclosure.js";
import { logger } from "./logger.js";

/**
 * Default token budget (800k tokens)
 */
const DEFAULT_TOKEN_BUDGET = 800_000;

/**
 * Complexity threshold for semantic analysis suggestion
 */
const SEMANTIC_COMPLEXITY_THRESHOLD = 50;

/**
 * Maximum parallel structural analysis tasks
 */
const MAX_PARALLEL_STRUCTURAL = 5;

/**
 * Orchestrate full analysis
 */
export async function orchestrateAnalysis(
  repoPath: string,
  options: AnalysisOptions = {}
): Promise<AnalysisResultV2> {
  const startTime = Date.now();
  const analysisId = generateAnalysisId();

  const depth = options.depth || "standard";
  const tokenBudget = options.tokenBudget || DEFAULT_TOKEN_BUDGET;
  const includeSemantics = options.includeSemantics || depth === "deep";

  // Initialize state
  const state: OrchestratorState = {
    analysisId,
    startTime,
    phase: "surface",
    tasks: [],
    tokenBudget,
    tokensUsed: 0,
  };

  const warnings: string[] = [];
  const partialFailures: { layer: string; error: string }[] = [];

  logger.orchestrator(`Starting analysis: ${analysisId}`);
  logger.orchestrator(`Depth: ${depth}, Budget: ${tokenBudget}, Semantics: ${includeSemantics}`, {
    depth,
    tokenBudget,
    includeSemantics,
  });
  logger.startSpinner("Running surface analysis...");

  // Phase 1: Surface Analysis (always runs)
  logger.progress("surface", "Phase 1: Starting surface analysis");
  const surface = await surfaceAnalysis(repoPath, {
    exclude: options.exclude,
  });
  logger.stopSpinner(`Surface: ${surface.repositoryMap.totalFiles} files, ${surface.identifiedModules.length} modules`);
  logger.surface(`Found ${surface.repositoryMap.languages.length} languages`, {
    languages: surface.repositoryMap.languages.slice(0, 5).map((l) => l.name),
    fileCount: surface.repositoryMap.totalFiles,
    complexity: surface.complexity,
  });

  state.phase = "structural";
  state.tokensUsed = surface.repositoryMap.estimatedTokens;

  // Check token budget
  if (state.tokensUsed > tokenBudget) {
    warnings.push(
      `Repository size (${state.tokensUsed} tokens) exceeds budget (${tokenBudget}). Analysis may be incomplete.`
    );
  }

  // If surface-only depth, skip structural and semantic
  if (depth === "surface") {
    logger.orchestrator("Surface-only mode, skipping deeper analysis");
    const result = buildAnalysisResult(
      analysisId,
      repoPath,
      depth,
      surface,
      [],
      null,
      Date.now() - startTime
    );
    result.warnings = warnings.length > 0 ? warnings : undefined;
    return result;
  }

  // Phase 2: Structural Analysis (parallel by module)
  logger.progress("structural", "Phase 2: Starting structural analysis");
  logger.startSpinner("Running structural analysis...");
  let structural: StructuralAnalysis[] = [];

  try {
    // Determine which modules to analyze based on budget and focus
    let modulesToAnalyze = surface.identifiedModules;

    // Apply focus filter if specified
    if (options.focus && options.focus.length > 0) {
      const filteredModules = modulesToAnalyze.filter((m) =>
        options.focus!.some((f) => {
          const focusLower = f.toLowerCase().replace(/^\/|\/$/g, "");
          const pathLower = m.path.toLowerCase();
          const nameLower = m.name.toLowerCase();
          // Match if focus is contained in path, or path starts with focus, or name matches
          return pathLower.includes(focusLower) ||
            pathLower.startsWith(focusLower) ||
            focusLower.includes(pathLower) ||
            nameLower === focusLower;
        })
      );

      if (filteredModules.length > 0) {
        modulesToAnalyze = filteredModules;
      } else {
        warnings.push(`No modules matched focus filter: ${options.focus.join(", ")}. Analyzing all modules.`);
      }
    }

    // Limit modules based on budget
    const maxModules = Math.min(
      modulesToAnalyze.length,
      Math.ceil(tokenBudget / 50000) // Rough estimate: 50k tokens per module
    );
    modulesToAnalyze = modulesToAnalyze.slice(0, maxModules);

    logger.updateSpinner(`Analyzing ${modulesToAnalyze.length} modules...`);
    logger.structural(`Analyzing ${modulesToAnalyze.length} modules`, {
      modules: modulesToAnalyze.map((m) => m.name),
    });

    // Load file contents for modules
    const allFiles: string[] = [];
    for (const module of modulesToAnalyze) {
      // Get files in this module
      const moduleDir = join(repoPath, module.path);
      // We need to load file contents - for now, collect paths
      // The structural layer will load them
    }

    // Process modules in parallel batches
    structural = await analyzeModulesInParallel(
      repoPath,
      modulesToAnalyze,
      state
    );

    logger.stopSpinner(`Structural: ${structural.length} modules analyzed`);
    const totalSymbols = structural.reduce(
      (acc, s) => acc + s.exports.length + s.symbols.length,
      0
    );
    const totalFunctions = structural.reduce(
      (acc, s) => acc + s.complexity.functionCount,
      0
    );
    logger.structural(`Completed structural analysis`, {
      modules: structural.length,
      totalSymbols,
      totalFunctions,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.stopSpinner();
    logger.error("structural", `Structural analysis failed: ${errorMessage}`);
    partialFailures.push({ layer: "structural", error: errorMessage });
  }

  // Phase 3: Semantic Analysis (conditional)
  state.phase = "semantic";
  let semantic: SemanticAnalysis | null = null;

  if (includeSemantics) {
    logger.progress("semantic", "Phase 3: Starting semantic analysis (LLM)");
    logger.startSpinner("Running semantic analysis with Gemini...");

    try {
      semantic = await semanticAnalysis(surface, structural, {
        tokenBudget: Math.min(8192, tokenBudget - state.tokensUsed),
        focusAreas: options.focus,
      });
      logger.stopSpinner("Semantic analysis complete");
      logger.semantic(`Completed semantic analysis`, {
        architectureType: semantic?.architectureType,
        patternsFound: semantic?.patterns?.length || 0,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.stopSpinner();
      logger.error("semantic", `Semantic analysis failed: ${errorMessage}`);
      partialFailures.push({ layer: "semantic", error: errorMessage });
    }
  } else {
    // Add quick semantic hints without LLM
    const hints = quickSemanticHints(surface, structural);
    if (surface.complexity > SEMANTIC_COMPLEXITY_THRESHOLD) {
      warnings.push(
        `Complexity score (${surface.complexity}) suggests semantic analysis would be valuable. Use includeSemantics=true.`
      );
    }
  }

  // Phase 4: Synthesis
  state.phase = "synthesis";
  logger.progress("synthesis", "Phase 4: Building final result");

  const durationMs = Date.now() - startTime;
  const result = buildAnalysisResult(
    analysisId,
    repoPath,
    depth,
    surface,
    structural,
    semantic,
    durationMs
  );

  // Add warnings and failures
  if (warnings.length > 0) {
    result.warnings = warnings;
  }
  if (partialFailures.length > 0) {
    result.partialFailures = partialFailures;
  }

  // Cache result for expand_section
  analysisCache.set(repoPath, {
    result,
    surface,
    structural,
    semantic,
  }, undefined, depth);

  state.phase = "complete";
  logger.orchestrator(`Analysis complete`, {
    durationMs,
    phases: ["surface", "structural", ...(includeSemantics ? ["semantic"] : []), "synthesis"],
    warnings: warnings.length,
    failures: partialFailures.length,
  });

  return result;
}

/**
 * Analyze modules in parallel with batching
 */
async function analyzeModulesInParallel(
  repoPath: string,
  modules: Array<{ path: string; name: string; type: string; fileCount: number; primaryLanguage: string }>,
  state: OrchestratorState
): Promise<StructuralAnalysis[]> {
  const results: StructuralAnalysis[] = [];

  const totalBatches = Math.ceil(modules.length / MAX_PARALLEL_STRUCTURAL);

  // Process in batches
  for (let i = 0; i < modules.length; i += MAX_PARALLEL_STRUCTURAL) {
    const batchNum = Math.floor(i / MAX_PARALLEL_STRUCTURAL) + 1;
    const batch = modules.slice(i, i + MAX_PARALLEL_STRUCTURAL);

    logger.debug("structural", `Processing batch ${batchNum}/${totalBatches}`, {
      modules: batch.map((m) => m.name),
    });
    logger.updateSpinner(`Structural: batch ${batchNum}/${totalBatches} (${batch.map((m) => m.name).join(", ")})`);

    // Create tasks for this batch
    const batchTasks: SubAgentTask[] = batch.map((m) => ({
      id: `structural_${m.path}`,
      type: "structural",
      target: m.path,
      status: "pending",
      startTime: Date.now(),
    }));
    state.tasks.push(...batchTasks);

    // Load files for batch modules
    const fileContents = new Map<string, string>();
    await Promise.all(
      batch.map(async (module) => {
        const modulePath = join(repoPath, module.path);
        try {
          // Read files in module directory
          const { glob } = await import("glob");
          const files = await glob("**/*", {
            cwd: modulePath,
            nodir: true,
            absolute: false,
            ignore: ["**/node_modules/**", "**/.git/**"],
          });

          for (const file of files.slice(0, 50)) { // Limit files per module
            const filePath = join(module.path, file);
            const fullPath = join(repoPath, filePath);
            try {
              const content = await readFile(fullPath, "utf-8");
              if (content.length < 100000) { // Skip very large files
                fileContents.set(filePath, content);
              }
            } catch {
              // Skip files that can't be read
            }
          }
        } catch {
          // Skip modules that can't be read
        }
      })
    );

    // Run structural analysis
    const batchResults = await analyzeModulesStructurally(
      batch,
      repoPath,
      fileContents
    );

    // Update task status and log results
    for (const task of batchTasks) {
      const result = batchResults.find((r) => r.modulePath === task.target);
      if (result) {
        task.status = "completed";
        task.endTime = Date.now();
        task.result = result;
        const duration = task.endTime - (task.startTime || task.endTime);
        logger.debug("structural", `Module ${task.target} completed`, {
          functions: result.complexity.functionCount,
          classes: result.complexity.classCount,
          exports: result.exports.length,
          symbols: result.symbols.length,
          durationMs: duration,
        });
      } else {
        task.status = "failed";
        task.endTime = Date.now();
        task.error = "No result returned";
        logger.warn("structural", `Module ${task.target} returned no result`);
      }
    }

    logger.debug("structural", `Batch ${batchNum} complete: ${batchResults.length}/${batch.length} succeeded`);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Expand a section in a cached analysis
 */
export async function expandAnalysisSection(
  analysisId: string,
  sectionId: string,
  level: "detail" | "full"
): Promise<{
  section: import("../types.js").ExpandableSection | null;
  error?: string;
}> {
  // Get cached analysis
  const cached = analysisCache.getByAnalysisId(analysisId);

  if (!cached) {
    return {
      section: null,
      error: `Analysis ${analysisId} not found in cache. It may have expired.`,
    };
  }

  const { expandSection } = await import("./disclosure.js");
  const expanded = expandSection(
    cached.result,
    sectionId,
    level,
    cached.structural,
    cached.semantic
  );

  if (!expanded) {
    return {
      section: null,
      error: `Section ${sectionId} not found or cannot be expanded.`,
    };
  }

  return { section: expanded };
}

/**
 * Get analysis capabilities
 */
export function getAnalysisCapabilities(): {
  layers: string[];
  depths: string[];
  supportedLanguages: string[];
  estimateCost: (fileCount: number, depth: AnalysisDepth) => number;
} {
  return {
    layers: ["surface", "structural", "semantic"],
    depths: ["surface", "standard", "deep"],
    supportedLanguages: [
      "TypeScript",
      "JavaScript",
      "Python",
      "Go",
      "Rust",
      "Java",
      "Ruby",
      "C",
      "C++",
      "C#",
    ],
    estimateCost: (fileCount: number, depth: AnalysisDepth): number => {
      // Estimate tokens based on file count and depth
      const baseTokens = fileCount * 500; // Avg 500 tokens per file

      switch (depth) {
        case "surface":
          return Math.round(baseTokens * 0.1); // 10% for surface
        case "standard":
          return Math.round(baseTokens * 0.3); // 30% for structural
        case "deep":
          return Math.round(baseTokens * 0.6); // 60% for semantic
      }
    },
  };
}

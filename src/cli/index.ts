import { Command } from "commander";
import {
  analyzeRepo,
  extractFeature,
  queryRepo,
  compareRepos,
} from "../core/analyzer.js";
import {
  formatAnalyzeOutput,
  formatFeatureOutput,
  formatQueryOutput,
  formatCompareOutput,
} from "../core/output-formatter.js";
import { basename } from "path";
import { orchestrateAnalysis } from "../core/orchestrator.js";
import { resolveSource } from "../core/repo-loader.js";
import { logger } from "../core/logger.js";
import type { OutputFormat, AnalysisDepth } from "../types.js";

/**
 * Extract repository name from source (GitHub URL or local path)
 */
function extractSourceName(source: string): string {
  // GitHub URL patterns
  const githubMatch = source.match(/github\.com\/([^\/]+\/[^\/]+)/);
  if (githubMatch) {
    return githubMatch[1].replace(/\.git$/, "");
  }
  return basename(source) || source;
}

const program = new Command();

program
  .name("cba")
  .description("Codebase Analyzer - Analyze repositories using Gemini AI")
  .version("2.0.0");

program
  .command("analyze")
  .description("Perform full architectural analysis of a repository (v2)")
  .argument("<source>", "Local path or GitHub URL")
  .option("-d, --depth <depth>", "Analysis depth: surface, standard, deep", "standard")
  .option("-f, --focus <areas...>", "Specific areas to focus on")
  .option("-e, --exclude <patterns...>", "Glob patterns to exclude")
  .option("-t, --token-budget <tokens>", "Maximum token budget", "800000")
  .option("-s, --semantics", "Include deep semantic analysis (uses LLM)")
  .option("-v, --verbose", "Show detailed progress and subagent activity")
  .option("-q, --quiet", "Only output the final result (no progress)")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .option("--v1", "Use legacy v1 analyzer instead of v2")
  .action(async (source: string, options: {
    depth?: string;
    focus?: string[];
    exclude?: string[];
    tokenBudget?: string;
    semantics?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    format: string;
    v1?: boolean;
  }) => {
    try {
      // Set up logging
      if (options.verbose) {
        logger.setVerbose(true);
      }
      if (options.quiet) {
        logger.setQuiet(true);
      }

      // Use v1 or v2
      if (options.v1) {
        if (!options.quiet) {
          console.error(`Analyzing ${source} (v1 mode)...`);
        }
        const result = await analyzeRepo({
          source,
          focus: options.focus,
          exclude: options.exclude,
        });
        console.log(formatAnalyzeOutput(result, options.format as OutputFormat));
        return;
      }

      // V2 analysis
      const sourceName = extractSourceName(source);
      const { repoPath, cleanup } = await resolveSource(source);

      try {
        const result = await orchestrateAnalysis(repoPath, {
          depth: (options.depth || "standard") as AnalysisDepth,
          focus: options.focus,
          exclude: options.exclude,
          tokenBudget: parseInt(options.tokenBudget || "800000", 10),
          includeSemantics: options.semantics,
          sourceName,
        });

        if (options.format === "markdown") {
          console.log(formatAnalysisAsMarkdown(result));
        } else {
          console.log(JSON.stringify(result, null, 2));
        }

        // Show log report in verbose mode
        if (options.verbose && !options.quiet) {
          console.error("\n" + logger.formatReport());
        }
      } finally {
        if (cleanup) {
          await cleanup();
        }
      }
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("patterns")
  .description("Find architecture patterns in a codebase")
  .argument("<source>", "Local path or GitHub URL")
  .option("-p, --patterns <patterns...>", "Specific patterns to look for")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .action(async (source: string, options: {
    patterns?: string[];
    verbose?: boolean;
    quiet?: boolean;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      const { executeFindPatterns } = await import("../mcp/tools/patterns.js");
      const result = await executeFindPatterns({
        source,
        patternTypes: options.patterns,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("dataflow")
  .description("Trace data flow from an entry point")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<from>", "Entry point (function name, file, or description)")
  .option("-t, --to <destination>", "Destination to trace to")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .action(async (source: string, from: string, options: {
    to?: string;
    verbose?: boolean;
    quiet?: boolean;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      const { executeTraceDataflow } = await import("../mcp/tools/dataflow.js");
      const result = await executeTraceDataflow({
        source,
        from,
        to: options.to,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("feature")
  .description("Analyze how a specific feature is implemented")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<feature>", "Description of the feature to analyze")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (source: string, feature: string, options: {
    verbose?: boolean;
    quiet?: boolean;
    format: string;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      if (!options.quiet) {
        console.error(`Analyzing feature "${feature}" in ${source}...`);
      }
      const result = await extractFeature({ source, feature });
      console.log(formatFeatureOutput(result, options.format as OutputFormat));
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("query")
  .description("Ask a question about a codebase")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<question>", "The question to ask")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (source: string, question: string, options: {
    verbose?: boolean;
    quiet?: boolean;
    format: string;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      if (!options.quiet) {
        console.error(`Querying ${source}...`);
      }
      const result = await queryRepo({ source, question });
      console.log(formatQueryOutput(result, options.format as OutputFormat));
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("compare")
  .description("Compare how multiple repos approach the same problem")
  .argument("<sources...>", "Two or more local paths or GitHub URLs")
  .option("-a, --aspect <aspect>", "The aspect to compare", "architecture")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (sources: string[], options: {
    aspect: string;
    verbose?: boolean;
    quiet?: boolean;
    format: string;
  }) => {
    if (sources.length < 2) {
      console.error("Error: At least 2 repositories are required for comparison");
      process.exit(1);
    }
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      if (!options.quiet) {
        console.error(`Comparing ${sources.length} repositories...`);
      }
      const result = await compareRepos({
        sources,
        aspect: options.aspect,
      });
      console.log(formatCompareOutput(result, options.format as OutputFormat));
    } catch (error) {
      logger.error("cli", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command("capabilities")
  .description("Show available analysis capabilities")
  .action(async () => {
    const { formatCapabilitiesResponse } = await import("../mcp/tools/capabilities.js");
    const capabilities = formatCapabilitiesResponse();
    console.log(JSON.stringify(capabilities, null, 2));
  });

/**
 * Format analysis result as markdown
 */
function formatAnalysisAsMarkdown(result: any): string {
  const lines: string[] = [];

  lines.push(`# ${result.repositoryMap?.name || "Repository"} Analysis`);
  lines.push("");
  lines.push(`**Analysis ID:** \`${result.analysisId}\``);
  lines.push(`**Depth:** ${result.depth}`);
  lines.push(`**Duration:** ${result.durationMs}ms`);
  lines.push("");

  if (result.summary) {
    lines.push("## Summary");
    lines.push(`- **Architecture:** ${result.summary.architectureType}`);
    lines.push(`- **Complexity:** ${result.summary.complexity}`);
    if (result.summary.primaryPatterns?.length > 0) {
      lines.push(`- **Patterns:** ${result.summary.primaryPatterns.join(", ")}`);
    }
    if (result.summary.techStack?.length > 0) {
      lines.push(`- **Tech Stack:** ${result.summary.techStack.join(", ")}`);
    }
    lines.push("");
  }

  if (result.repositoryMap) {
    lines.push("## Repository Map");
    lines.push(`- **Total Files:** ${result.repositoryMap.fileCount}`);
    lines.push(`- **Estimated Tokens:** ${result.repositoryMap.estimatedTokens}`);
    lines.push(`- **Languages:** ${result.repositoryMap.languages?.map((l: any) => `${l.language} (${l.percentage}%)`).join(", ")}`);
    lines.push(`- **Entry Points:** ${result.repositoryMap.entryPoints?.slice(0, 5).join(", ")}`);
    lines.push("");
  }

  if (result.sections?.length > 0) {
    lines.push("## Sections");
    for (const section of result.sections) {
      lines.push(`### ${section.title}`);
      lines.push(section.summary);
      if (section.canExpand) {
        lines.push(`*Expandable (detail: ~${section.expansionCost?.detail} tokens, full: ~${section.expansionCost?.full} tokens)*`);
      }
      lines.push("");
    }
  }

  if (result.forAgent) {
    lines.push("## Agent Hints");
    lines.push(result.forAgent.quickSummary);
    lines.push("");
    if (result.forAgent.keyInsights?.length > 0) {
      lines.push("**Key Insights:**");
      for (const insight of result.forAgent.keyInsights) {
        lines.push(`- ${insight}`);
      }
      lines.push("");
    }
    if (result.forAgent.suggestedNextSteps?.length > 0) {
      lines.push("**Suggested Next Steps:**");
      for (const step of result.forAgent.suggestedNextSteps) {
        lines.push(`- ${step}`);
      }
      lines.push("");
    }
  }

  if (result.warnings?.length > 0) {
    lines.push("## Warnings");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

program.parse();

import { Command } from "commander";
import { basename } from "path";
import { orchestrateAnalysis } from "../core/orchestrator.js";
import { resolveSource } from "../core/repo-loader.js";
import { logger } from "../core/logger.js";
import type { AnalysisDepth } from "../types.js";

/**
 * Extract repository name from source (GitHub URL or local path)
 */
function extractSourceName(source: string): string {
  const githubMatch = source.match(/github\.com\/([^\/]+\/[^\/]+)/);
  if (githubMatch) {
    return githubMatch[1].replace(/\.git$/, "");
  }
  return basename(source) || source;
}

const program = new Command();

program
  .name("cba")
  .description("Codebase Analyzer - Multi-layer repository analysis with Gemini AI")
  .version("2.0.0");

program
  .command("analyze")
  .description("Perform architectural analysis of a repository")
  .argument("<source>", "Local path or GitHub URL")
  .option("-d, --depth <depth>", "Analysis depth: surface, standard, deep", "standard")
  .option("-f, --focus <areas...>", "Specific areas to focus on")
  .option("-e, --exclude <patterns...>", "Glob patterns to exclude")
  .option("-t, --token-budget <tokens>", "Maximum token budget", "800000")
  .option("-s, --semantics", "Include deep semantic analysis (uses LLM)")
  .option("-v, --verbose", "Show detailed progress and subagent activity")
  .option("-q, --quiet", "Only output the final result (no progress)")
  .option("--format <format>", "Output format (json or markdown)", "json")
  .action(async (source: string, options: {
    depth?: string;
    focus?: string[];
    exclude?: string[];
    tokenBudget?: string;
    semantics?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    format: string;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

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

        if (options.verbose && !options.quiet) {
          console.error("\n" + logger.formatReport());
        }
      } finally {
        if (cleanup) await cleanup();
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
  .command("capabilities")
  .description("Show available analysis capabilities")
  .action(async () => {
    const { formatCapabilitiesResponse } = await import("../mcp/tools/capabilities.js");
    console.log(JSON.stringify(formatCapabilitiesResponse(), null, 2));
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

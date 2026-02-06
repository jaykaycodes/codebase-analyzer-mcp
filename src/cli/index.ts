import { Command } from "commander";
import { basename } from "path";
import { orchestrateAnalysis } from "../core/orchestrator.js";
import { resolveSource } from "../core/repo-loader.js";
import { logger } from "../core/logger.js";
import type { AnalysisDepth, DirectoryNode } from "../types.js";
import pkg from "../../package.json";

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
  .version(pkg.version);

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
  .option("-o, --output <path>", "Write analysis to a file (markdown by default, .json for JSON)")
  .action(async (source: string, options: {
    depth?: string;
    focus?: string[];
    exclude?: string[];
    tokenBudget?: string;
    semantics?: boolean;
    verbose?: boolean;
    quiet?: boolean;
    format: string;
    output?: string;
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

        if (options.output) {
          const { writeFile } = await import("fs/promises");
          const content = options.output.endsWith(".json")
            ? JSON.stringify(result, null, 2)
            : formatAnalysisAsMarkdown(result);
          await writeFile(options.output, content, "utf-8");
          console.error(`Analysis written to ${options.output}`);
        } else if (options.format === "markdown") {
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
  .command("query")
  .description("Ask a question about a codebase")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<question>", "Question about the codebase")
  .option("-v, --verbose", "Show detailed progress")
  .option("-q, --quiet", "Only output the final result")
  .action(async (source: string, question: string, options: {
    verbose?: boolean;
    quiet?: boolean;
  }) => {
    try {
      if (options.verbose) logger.setVerbose(true);
      if (options.quiet) logger.setQuiet(true);

      const { executeQueryRepo } = await import("../mcp/tools/query.js");
      const result = await executeQueryRepo({
        source,
        question,
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
 * Render a directory tree as indented text
 */
function renderTree(node: DirectoryNode, depth: number, maxDepth: number): string[] {
  const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "__pycache__", ".cache", "coverage"]);
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  if (depth > 0) {
    lines.push(`${indent}${node.name}${node.type === "directory" ? "/" : ""}`);
  }

  if (node.type === "directory" && node.children && depth < maxDepth) {
    const dirs = node.children
      .filter((c) => c.type === "directory" && !SKIP_DIRS.has(c.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = node.children
      .filter((c) => c.type === "file")
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const dir of dirs) {
      lines.push(...renderTree(dir, depth + 1, maxDepth));
    }
    // Only show files at top level or if few enough
    if (depth === 0 || files.length <= 5) {
      for (const file of files) {
        lines.push(`${"  ".repeat(depth + 1)}${file.name}`);
      }
    } else if (files.length > 5) {
      lines.push(`${"  ".repeat(depth + 1)}... ${files.length} files`);
    }
  }

  return lines;
}

/**
 * Format analysis result as markdown
 */
function formatAnalysisAsMarkdown(result: any): string {
  const lines: string[] = [];
  const name = result.repositoryMap?.name || "Repository";
  const date = new Date().toISOString().split("T")[0];

  // Metadata comment
  lines.push(`<!-- codebase-analyzer-mcp | ${date} | depth: ${result.depth} | id: ${result.analysisId} -->`);
  lines.push("");

  // Title
  lines.push(`# ${name}`);
  lines.push("");

  // Quick summary
  if (result.forAgent?.quickSummary) {
    lines.push(result.forAgent.quickSummary);
    lines.push("");
  }

  // Overview table
  const repoMap = result.repositoryMap;
  const summary = result.summary;
  if (repoMap || summary) {
    lines.push("## Overview");
    lines.push("");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    if (repoMap?.fileCount != null) {
      lines.push(`| Files | ${repoMap.fileCount} |`);
    }
    if (repoMap?.languages?.length > 0) {
      const langs = repoMap.languages
        .map((l: any) => `${l.language} (${l.percentage}%)`)
        .join(", ");
      lines.push(`| Languages | ${langs} |`);
    }
    if (summary?.architectureType) {
      lines.push(`| Architecture | ${summary.architectureType} |`);
    }
    if (summary?.complexity) {
      lines.push(`| Complexity | ${summary.complexity} |`);
    }
    if (repoMap?.entryPoints?.length > 0) {
      lines.push(`| Entry points | ${repoMap.entryPoints.slice(0, 5).join(", ")} |`);
    }
    if (summary?.techStack?.length > 0) {
      lines.push(`| Tech stack | ${summary.techStack.join(", ")} |`);
    }
    if (summary?.primaryPatterns?.length > 0) {
      lines.push(`| Patterns | ${summary.primaryPatterns.join(", ")} |`);
    }
    lines.push("");
  }

  // Key Insights
  if (result.forAgent?.keyInsights?.length > 0) {
    lines.push("## Key Insights");
    lines.push("");
    for (const insight of result.forAgent.keyInsights) {
      lines.push(`- ${insight}`);
    }
    lines.push("");
  }

  // Directory structure
  if (repoMap?.structure) {
    lines.push("## Structure");
    lines.push("");
    lines.push("```");
    const treeLines = renderTree(repoMap.structure, 0, 3);
    lines.push(...treeLines);
    lines.push("```");
    lines.push("");
  }

  // Modules
  const moduleSections = result.sections?.filter((s: any) => s.type === "module") || [];
  if (moduleSections.length > 0) {
    lines.push("## Modules");
    lines.push("");
    for (const section of moduleSections) {
      const modulePath = section.id.replace("module_", "").replace(/_/g, "/");
      const detail = section.detail as Record<string, any> | undefined;

      // Header line with key info
      let header = `### ${modulePath}`;
      const meta: string[] = [];
      if (section.summary) meta.push(section.summary);
      if (meta.length) header += ` — ${meta.join(", ")}`;
      lines.push(header);
      lines.push("");

      if (detail) {
        if (detail.type === "documentation") {
          // Documentation module
          if (detail.headings?.length > 0) {
            lines.push(`Headings: ${detail.headings.map((h: any) => h.title).join(", ")}`);
          }
        } else {
          // Code module
          if (detail.exports?.length > 0) {
            lines.push(`Exports: ${detail.exports.slice(0, 10).join(", ")}${detail.exports.length > 10 ? ", ..." : ""}`);
          }
          const cx = detail.complexity;
          if (cx) {
            lines.push(`Complexity: ${cx.cyclomaticComplexity} cyclomatic | ${cx.linesOfCode} LOC | ${cx.functionCount} functions | ${cx.classCount} classes`);
          }
          if (detail.symbolCount != null || detail.importCount != null) {
            lines.push(`Symbols: ${detail.symbolCount ?? 0} | Imports: ${detail.importCount ?? 0}`);
          }
        }
        lines.push("");
      }
    }
  }

  // Non-module sections (patterns, data models, APIs)
  const otherSections = result.sections?.filter((s: any) => s.type !== "module") || [];
  if (otherSections.length > 0) {
    for (const section of otherSections) {
      lines.push(`## ${section.title}`);
      lines.push("");
      lines.push(section.summary);
      lines.push("");
    }
  }

  // Warnings
  if (result.warnings?.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Determine mode: MCP server (default) or CLI
const cliCommands = ["analyze", "patterns", "dataflow", "query", "capabilities", "help", "-h", "--help", "-V", "--version"];
const firstArg = process.argv[2];
const isCliMode = firstArg && cliCommands.some(cmd => firstArg === cmd || firstArg.startsWith("-"));

if (isCliMode) {
  program.parse();
} else {
  // Default: run MCP server (this is an MCP package after all)
  import("../mcp/server.js").catch((err) => {
    console.error("Failed to start MCP server:", err);
    process.exit(1);
  });
}

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
import type { OutputFormat } from "../types.js";

const program = new Command();

program
  .name("cba")
  .description("Codebase Analyzer - Analyze repositories using Gemini AI")
  .version("0.1.0");

program
  .command("analyze")
  .description("Perform full architectural analysis of a repository")
  .argument("<source>", "Local path or GitHub URL")
  .option("-f, --focus <areas...>", "Specific areas to focus on")
  .option("-e, --exclude <patterns...>", "Glob patterns to exclude")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (source: string, options: { focus?: string[]; exclude?: string[]; format: string }) => {
    try {
      console.error(`Analyzing ${source}...`);
      const result = await analyzeRepo({
        source,
        focus: options.focus,
        exclude: options.exclude,
      });
      console.log(formatAnalyzeOutput(result, options.format as OutputFormat));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

program
  .command("feature")
  .description("Analyze how a specific feature is implemented")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<feature>", "Description of the feature to analyze")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (source: string, feature: string, options: { format: string }) => {
    try {
      console.error(`Analyzing feature "${feature}" in ${source}...`);
      const result = await extractFeature({ source, feature });
      console.log(formatFeatureOutput(result, options.format as OutputFormat));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

program
  .command("query")
  .description("Ask a question about a codebase")
  .argument("<source>", "Local path or GitHub URL")
  .argument("<question>", "The question to ask")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (source: string, question: string, options: { format: string }) => {
    try {
      console.error(`Querying ${source}...`);
      const result = await queryRepo({ source, question });
      console.log(formatQueryOutput(result, options.format as OutputFormat));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

program
  .command("compare")
  .description("Compare how multiple repos approach the same problem")
  .argument("<sources...>", "Two or more local paths or GitHub URLs")
  .option("-a, --aspect <aspect>", "The aspect to compare", "architecture")
  .option(
    "--format <format>",
    "Output format (json or markdown)",
    "json"
  )
  .action(async (sources: string[], options: { aspect: string; format: string }) => {
    if (sources.length < 2) {
      console.error("Error: At least 2 repositories are required for comparison");
      process.exit(1);
    }
    try {
      console.error(`Comparing ${sources.length} repositories...`);
      const result = await compareRepos({
        sources,
        aspect: options.aspect,
      });
      console.log(formatCompareOutput(result, options.format as OutputFormat));
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

program.parse();

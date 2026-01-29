import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  formatCapabilitiesResponse,
  analyzeRepoSchema,
  executeAnalyzeRepo,
  expandSectionSchema,
  executeExpandSection,
  findPatternsSchema,
  executeFindPatterns,
  traceDataflowSchema,
  executeTraceDataflow,
} from "./tools/index.js";

const server = new McpServer({
  name: "codebase-analyzer",
  version: "2.0.0",
});

server.tool(
  "get_analysis_capabilities",
  "Discover available analysis types, supported languages, and cost estimates. Call this first to understand what analysis options are available.",
  {},
  async () => {
    try {
      const capabilities = formatCapabilitiesResponse();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(capabilities, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting capabilities: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "analyze_repo",
  "Perform a full architectural analysis of a repository with progressive disclosure. Returns expandable sections that can be drilled into with expand_section.",
  {
    source: analyzeRepoSchema.source,
    depth: analyzeRepoSchema.depth,
    focus: analyzeRepoSchema.focus,
    exclude: analyzeRepoSchema.exclude,
    tokenBudget: analyzeRepoSchema.tokenBudget,
    includeSemantics: analyzeRepoSchema.includeSemantics,
  },
  async ({ source, depth, focus, exclude, tokenBudget, includeSemantics }) => {
    try {
      const result = await executeAnalyzeRepo({
        source,
        depth,
        focus,
        exclude,
        tokenBudget,
        includeSemantics,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error analyzing repository: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "expand_section",
  "Expand a section from a previous analysis for more detail. Use after analyze_repo to drill into specific areas.",
  {
    analysisId: expandSectionSchema.analysisId,
    sectionId: expandSectionSchema.sectionId,
    depth: expandSectionSchema.depth,
  },
  async ({ analysisId, sectionId, depth }) => {
    try {
      const result = await executeExpandSection({
        analysisId,
        sectionId,
        depth,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error expanding section: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "find_patterns",
  "Detect architecture and design patterns in a codebase. Returns pattern matches with confidence levels and locations.",
  {
    source: findPatternsSchema.source,
    patternTypes: findPatternsSchema.patternTypes,
  },
  async ({ source, patternTypes }) => {
    try {
      const result = await executeFindPatterns({
        source,
        patternTypes,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error finding patterns: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "trace_dataflow",
  "Trace data flow through the codebase from an entry point. Useful for understanding how data moves through the system.",
  {
    source: traceDataflowSchema.source,
    from: traceDataflowSchema.from,
    to: traceDataflowSchema.to,
  },
  async ({ source, from, to }) => {
    try {
      const result = await executeTraceDataflow({
        source,
        from,
        to,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error tracing dataflow: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Codebase Analyzer MCP server v2.0.0 running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

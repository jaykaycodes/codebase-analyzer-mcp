import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  analyzeRepo,
  extractFeature,
  queryRepo,
  compareRepos,
} from "../core/analyzer.js";

const server = new McpServer({
  name: "codebase-analyzer",
  version: "0.1.0",
});

server.tool(
  "analyze_repo",
  "Perform a full architectural analysis of a repository. Returns comprehensive information about architecture, structure, data models, patterns, and agent-optimized insights.",
  {
    source: z
      .string()
      .describe("Local path or GitHub URL to the repository"),
    focus: z
      .array(z.string())
      .optional()
      .describe("Optional: specific areas to focus the analysis on"),
    exclude: z
      .array(z.string())
      .optional()
      .describe("Optional: glob patterns to exclude from analysis"),
  },
  async ({ source, focus, exclude }) => {
    try {
      const result = await analyzeRepo({ source, focus, exclude });
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
  "extract_feature",
  "Analyze how a specific feature is implemented in a repository. Returns detailed information about the files, data flow, and patterns involved, plus a replication guide.",
  {
    source: z
      .string()
      .describe("Local path or GitHub URL to the repository"),
    feature: z
      .string()
      .describe("Description of the feature to analyze (e.g., 'user authentication', 'payment processing')"),
  },
  async ({ source, feature }) => {
    try {
      const result = await extractFeature({ source, feature });
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
            text: `Error extracting feature: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "query_repo",
  "Ask arbitrary questions about a codebase. Good for specific questions like 'what ORM is used' or 'how is error logging implemented'.",
  {
    source: z
      .string()
      .describe("Local path or GitHub URL to the repository"),
    question: z
      .string()
      .describe("The question to ask about the codebase"),
  },
  async ({ source, question }) => {
    try {
      const result = await queryRepo({ source, question });
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
            text: `Error querying repository: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "compare_repos",
  "Compare how multiple repositories approach the same problem or aspect. Useful for evaluating different architectural approaches.",
  {
    sources: z
      .array(z.string())
      .min(2)
      .describe("Array of local paths or GitHub URLs to compare"),
    aspect: z
      .string()
      .describe("The aspect to compare (e.g., 'authentication', 'state management', 'API design')"),
  },
  async ({ sources, aspect }) => {
    try {
      const result = await compareRepos({ sources, aspect });
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
            text: `Error comparing repositories: ${message}`,
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
  console.error("Codebase Analyzer MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

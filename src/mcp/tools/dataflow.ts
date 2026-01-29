/**
 * Trace Dataflow Tool
 *
 * Traces data flow through the codebase from an entry point.
 * Useful for understanding how data moves through the system.
 */

import { z } from "zod";
import { resolveSource } from "../../core/repo-loader.js";
import { surfaceAnalysis } from "../../core/layers/index.js";
import { generateJsonWithGemini } from "../../core/gemini.js";
import { join } from "path";
import { readFile } from "fs/promises";
import { glob } from "glob";

/**
 * Schema for trace_dataflow tool
 */
export const traceDataflowSchema = {
  source: z
    .string()
    .describe("Local path or GitHub URL to the repository"),
  from: z
    .string()
    .describe("Entry point to trace from (function name, file path, or description like 'user login')"),
  to: z
    .string()
    .optional()
    .describe("Optional: destination to trace to (if known)"),
};

export type TraceDataflowInput = {
  source: string;
  from: string;
  to?: string;
};

interface DataflowStep {
  step: number;
  file: string;
  function: string;
  description: string;
  dataTransformation: string;
}

interface DataflowResult {
  entryPoint: {
    file: string;
    function: string;
    description: string;
  };
  destination: {
    file: string;
    function: string;
    description: string;
  } | null;
  flow: DataflowStep[];
  dataTypes: {
    name: string;
    definition: string;
    usedIn: string[];
  }[];
  sideEffects: string[];
  summary: string;
}

/**
 * Execute trace_dataflow tool
 */
export async function executeTraceDataflow(input: TraceDataflowInput): Promise<DataflowResult> {
  const { source, from, to } = input;

  // Resolve source
  const { repoPath, cleanup } = await resolveSource(source);

  try {
    // Run surface analysis to understand structure
    const surface = await surfaceAnalysis(repoPath, {});

    // Load code files
    const fileContents = new Map<string, string>();
    const codeFiles = await glob("**/*.{ts,js,tsx,jsx,py,java,go,rb,rs}", {
      cwd: repoPath,
      nodir: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/*.test.*", "**/*.spec.*"],
    });

    // Load files for analysis
    for (const file of codeFiles.slice(0, 60)) {
      const fullPath = join(repoPath, file);
      try {
        const content = await readFile(fullPath, "utf-8");
        if (content.length < 50000) {
          fileContents.set(file, content);
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Build file content for prompt
    const fileSummary = Array.from(fileContents.entries())
      .map(([path, content]) => {
        const truncated = content.length > 4000
          ? content.slice(0, 4000) + "\n... [truncated]"
          : content;
        return `--- ${path} ---\n${truncated}`;
      })
      .join("\n\n");

    // Use Gemini to trace dataflow
    const prompt = `Trace the data flow in this codebase:

FROM: ${from}
${to ? `TO: ${to}` : "TO: (trace as far as possible)"}

Repository structure:
- Entry points: ${surface.repositoryMap.entryPoints.join(", ")}
- Primary language: ${surface.repositoryMap.languages[0]?.name || "Unknown"}
- Modules: ${surface.identifiedModules.map(m => m.name).join(", ")}

File contents:
${fileSummary}

Trace how data flows from the entry point${to ? ` to ${to}` : ""}. Identify:
1. The specific entry point (file and function)
2. Each step in the data flow
3. How data is transformed at each step
4. Data types involved
5. Any side effects (database writes, API calls, etc.)

Respond with this exact JSON structure:
{
  "entryPoint": {
    "file": "path/to/file.ts",
    "function": "functionName",
    "description": "What this entry point does"
  },
  "destination": {
    "file": "path/to/file.ts",
    "function": "functionName",
    "description": "Where the data flow ends"
  },
  "flow": [
    {
      "step": 1,
      "file": "path/to/file.ts",
      "function": "functionName",
      "description": "What happens at this step",
      "dataTransformation": "How data is transformed"
    }
  ],
  "dataTypes": [
    {
      "name": "TypeName",
      "definition": "Brief definition",
      "usedIn": ["file1.ts", "file2.ts"]
    }
  ],
  "sideEffects": ["Description of side effects"],
  "summary": "Overall summary of the data flow"
}

If you cannot find the entry point, explain what you looked for in the summary and return an empty flow array.`;

    const result = await generateJsonWithGemini<DataflowResult>(prompt, {
      maxOutputTokens: 4096,
    });

    return result;
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

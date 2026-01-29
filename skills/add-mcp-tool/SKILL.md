---
name: add-mcp-tool
description: This skill guides adding new MCP tools to the codebase-analyzer server. Use when extending the analyzer with new capabilities like new analysis types, query tools, or integrations.
---

# Adding MCP Tools

## Quick Start

To add a new MCP tool:

1. Create `src/mcp/tools/your-tool.ts`
2. Export from `src/mcp/tools/index.ts`
3. Register in `src/mcp/server.ts`
4. Add CLI command (optional)
5. Run `pnpm build`

## Step 1: Create Tool File

Create `src/mcp/tools/your-tool.ts`:

```typescript
import { z } from "zod";
import { resolveSource } from "../../core/repo-loader.js";

// Schema for MCP tool parameters
export const yourToolSchema = {
  source: z
    .string()
    .describe("Local path or GitHub URL to the repository"),
  yourParam: z
    .string()
    .optional()
    .describe("Description of parameter"),
};

export type YourToolInput = {
  source: string;
  yourParam?: string;
};

// Execute function
export async function executeYourTool(input: YourToolInput): Promise<object> {
  const { source, yourParam } = input;

  // Resolve source (handles GitHub URLs)
  const { repoPath, cleanup } = await resolveSource(source);

  try {
    // Your implementation here
    const result = {
      // Your result structure
    };

    return result;
  } finally {
    // Clean up temp directory if GitHub clone
    if (cleanup) await cleanup();
  }
}
```

## Step 2: Export from Index

Add to `src/mcp/tools/index.ts`:

```typescript
export {
  yourToolSchema,
  executeYourTool,
  type YourToolInput,
} from "./your-tool.js";
```

## Step 3: Register in Server

Add to `src/mcp/server.ts`:

```typescript
import {
  yourToolSchema,
  executeYourTool,
} from "./tools/index.js";

server.tool(
  "your_tool_name",
  "Description of what the tool does",
  {
    source: yourToolSchema.source,
    yourParam: yourToolSchema.yourParam,
  },
  async ({ source, yourParam }) => {
    try {
      const result = await executeYourTool({ source, yourParam });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text" as const,
          text: `Error: ${message}`,
        }],
        isError: true,
      };
    }
  }
);
```

## Step 4: Add CLI Command (Optional)

Add to `src/cli/index.ts`:

```typescript
program
  .command("your-command")
  .description("What this command does")
  .argument("<source>", "Local path or GitHub URL")
  .option("-p, --param <value>", "Your parameter")
  .action(async (source: string, options) => {
    try {
      const { executeYourTool } = await import("../mcp/tools/your-tool.js");
      const result = await executeYourTool({
        source,
        yourParam: options.param,
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
```

## Step 5: Add Types (If Needed)

Add to `src/types.ts`:

```typescript
export interface YourToolResult {
  // Define your result structure
}
```

## Patterns to Follow

### Use Existing Layers

If your tool does analysis, consider using existing layers:

```typescript
import { surfaceAnalysis } from "../../core/layers/index.js";

const surface = await surfaceAnalysis(repoPath, { exclude });
```

### Handle Partial Failures

Don't throw on every error - capture and continue:

```typescript
const warnings: string[] = [];
const failures: { area: string; error: string }[] = [];

try {
  // risky operation
} catch (error) {
  failures.push({
    area: "operation-name",
    error: error.message
  });
}

return { result, warnings, failures };
```

### Respect Token Budget

Check budget before expensive operations:

```typescript
if (estimatedTokens > tokenBudget) {
  warnings.push(`Estimated tokens (${estimatedTokens}) exceeds budget`);
}
```

## Testing

After adding:

```bash
pnpm build
pnpm cba your-command ./test-repo
```

## Checklist

- [ ] Tool file created with schema and execute function
- [ ] Exported from index.ts
- [ ] Registered in server.ts
- [ ] CLI command added (if applicable)
- [ ] Types added to types.ts (if needed)
- [ ] `pnpm build` passes
- [ ] Tool works via MCP and CLI

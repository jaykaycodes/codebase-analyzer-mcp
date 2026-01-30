#!/usr/bin/env bun
/**
 * Build script - bundles MCP server and CLI with proper shebang + permissions.
 * Run with: bun scripts/build.ts
 */

import { $ } from "bun";
import { chmodSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const rootDir = join(import.meta.dir, "..");
const distDir = join(rootDir, "dist");

console.log("Building...");

// Bundle MCP server
await $`bun build src/mcp/server.ts --outfile dist/mcp/server.js --target node`.cwd(rootDir);

// Bundle CLI
await $`bun build src/cli/index.ts --outfile dist/cli/index.js --target node`.cwd(rootDir);

// Add shebang and set executable permission
const cliPath = join(distDir, "cli/index.js");
const content = readFileSync(cliPath, "utf-8");
writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`);
chmodSync(cliPath, 0o755);

console.log("Done!");

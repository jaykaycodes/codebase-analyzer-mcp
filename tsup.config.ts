import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "mcp/server": "src/mcp/server.ts",
    "cli/index": "src/cli/index.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  shims: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

# Codebase Analyzer MCP

[![npm](https://img.shields.io/npm/v/codebase-analyzer-mcp)](https://www.npmjs.com/package/codebase-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for codebase analysis with Gemini AI. Progressive disclosure keeps costs low — start with free structural analysis, drill into semantic details only when needed.

## Install

Add to your MCP config (`~/.mcp.json` for Claude Code):

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "npx",
      "args": ["-y", "codebase-analyzer-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_key_here"
      }
    }
  }
}
```

Restart Claude Code. The tools will be available immediately.

**Gemini API key** is optional — enables semantic analysis, pattern detection, and dataflow tracing. Without it, you still get structural analysis. Get a free key at https://aistudio.google.com/apikey

## Tools

| Tool | Description | Requires Gemini |
|------|-------------|:---:|
| `analyze_repo` | Full analysis with progressive disclosure | No |
| `query_repo` | Ask questions about a codebase | Optional |
| `expand_section` | Drill into specific analysis sections | No |
| `read_files` | Read source files from a cached analysis | No |
| `find_patterns` | Detect design/architecture patterns | Yes |
| `trace_dataflow` | Trace data flow through the system | Yes |
| `get_analysis_capabilities` | List supported languages and options | No |

## Analysis Layers

| Layer | Cost | What You Get |
|-------|------|--------------|
| **Surface** | Free | Files, languages, entry points, modules |
| **Structural** | Free | Symbols, imports, complexity (via tree-sitter) |
| **Semantic** | Gemini | Architecture insights, pattern detection |

Results include expandable sections — you only pay for what you drill into.

## CLI

```bash
npx codebase-analyzer-mcp analyze .                      # Standard analysis
npx codebase-analyzer-mcp analyze . -d surface            # Fast, free overview
npx codebase-analyzer-mcp analyze . -d deep -s            # Full semantic analysis
npx codebase-analyzer-mcp query . "how is auth handled?"  # Ask a question
npx codebase-analyzer-mcp patterns .                      # Find design patterns
npx codebase-analyzer-mcp dataflow . "user login"         # Trace data flow
```

## Development

```bash
git clone https://github.com/jaykaycodes/codebase-analyzer-mcp.git
cd codebase-analyzer-mcp
bun install
bun run build
```

For local MCP testing, create `.mcp.json` at repo root:

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "node",
      "args": ["dist/mcp/server.js"]
    }
  }
}
```

## License

MIT

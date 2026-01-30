# Codebase Analyzer MCP

[![npm](https://img.shields.io/npm/v/codebase-analyzer-mcp)](https://www.npmjs.com/package/codebase-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Analyze any codebase with Gemini AI. Progressive disclosure keeps costs low - start with free structural analysis, drill into semantic details only when needed.

## Quick Start

### Claude Code Plugin

```bash
claude /plugin install https://github.com/jaykaycodes/codebase-analyzer-mcp
```

Then use `/analyze`, `/patterns`, `/trace`, or `/explore` commands.

### MCP Server

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "npx",
      "args": ["-y", "codebase-analyzer-mcp", "--mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

Get a Gemini API key at https://aistudio.google.com/apikey

### CLI

```bash
npx codebase-analyzer-mcp analyze .                    # Standard analysis
npx codebase-analyzer-mcp analyze . -d surface         # Fast, free overview
npx codebase-analyzer-mcp analyze . -d deep -s         # Full semantic analysis
npx codebase-analyzer-mcp patterns .                   # Find design patterns
npx codebase-analyzer-mcp dataflow . "user login"      # Trace data flow
```

## What It Does

| Layer | Cost | What You Get |
|-------|------|--------------|
| **Surface** | Free | Files, languages, entry points, modules |
| **Structural** | Free | Symbols, imports, complexity (via tree-sitter) |
| **Semantic** | Gemini | Architecture insights, pattern detection |

Analysis results include expandable sections - you only pay for what you drill into.

## MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_repo` | Full analysis with progressive disclosure |
| `expand_section` | Drill into specific sections |
| `find_patterns` | Detect design/architecture patterns |
| `trace_dataflow` | Trace data flow through the system |

## Plugin Commands & Agents

| Command | Agent | Purpose |
|---------|-------|---------|
| `/analyze` | `architecture-analyzer` | Full architecture analysis |
| `/patterns` | `pattern-detective` | Find design patterns |
| `/trace` | `dataflow-tracer` | Trace data flow |
| `/explore` | `codebase-explorer` | Quick exploration |
| `/compare` | - | Compare repositories |

---

## Alternative Installation

### Global Install

```bash
npm install -g codebase-analyzer-mcp
# Then use: cba analyze .
```

## Development

```bash
git clone https://github.com/jaykaycodes/codebase-analyzer-mcp.git
cd codebase-analyzer-mcp
bun install
bun run dev           # Watch mode
bun run build:js      # Build JS
bun run cba analyze . # Test CLI
```

## License

MIT

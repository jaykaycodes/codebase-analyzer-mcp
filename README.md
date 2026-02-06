# Codebase Analyzer MCP

[![npm](https://img.shields.io/npm/v/codebase-analyzer-mcp)](https://www.npmjs.com/package/codebase-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Analyze any codebase with Gemini AI. Progressive disclosure keeps costs low - start with free structural analysis, drill into semantic details only when needed.

## Install

### Option 1: Claude Code Plugin (recommended)

```bash
claude /plugin install jaykaycodes/codebase-analyzer-mcp
```

This gives you MCP tools + agents + the `/cba:analyze` command. Just ask questions naturally.

**Gemini API key (optional):** Enables semantic analysis, pattern detection, and dataflow tracing. Without it, you still get structural analysis.

```bash
mkdir -p ~/.config/codebase-analyzer
echo '{"geminiApiKey":"YOUR_KEY"}' > ~/.config/codebase-analyzer/config.json
```

Get a free key at https://aistudio.google.com/apikey

### Option 2: Standalone MCP Server

Add to `~/.mcp.json`:

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

Restart Claude Code, then use `analyze_repo`, `query_repo`, etc.

### Option 3: CLI

```bash
npx codebase-analyzer-mcp analyze .                              # Standard analysis
npx codebase-analyzer-mcp analyze . -d surface                   # Fast, free overview
npx codebase-analyzer-mcp analyze . -d deep -s                   # Full semantic analysis
npx codebase-analyzer-mcp query . "how is auth handled?"         # Ask a question
npx codebase-analyzer-mcp patterns .                             # Find design patterns
npx codebase-analyzer-mcp dataflow . "user login"                # Trace data flow
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
| `query_repo` | Ask questions about a codebase |
| `expand_section` | Drill into specific sections |
| `read_files` | Read source files from a cached analysis |
| `find_patterns` | Detect design/architecture patterns |
| `trace_dataflow` | Trace data flow through the system |
| `get_analysis_capabilities` | List supported languages and analysis options |

## Plugin Components

### Command

```
/cba:analyze [source] [--depth surface|standard|deep] [--focus <paths>]
```

### Agents

| Agent | Purpose |
|-------|---------|
| `architecture-analyzer` | Full codebase architecture analysis |
| `pattern-detective` | Design/anti-pattern detection |
| `dataflow-tracer` | Data flow tracing through systems |
| `codebase-explorer` | Quick exploration and Q&A |

Agents are routed automatically based on your question.

## Development

```bash
git clone https://github.com/jaykaycodes/codebase-analyzer-mcp.git
cd codebase-analyzer-mcp
bun install
bun run build         # Build dist/
bun run dev           # Watch mode
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

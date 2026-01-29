# Codebase Analyzer MCP

[![Claude Plugin](https://img.shields.io/badge/Claude-Plugin-blueviolet)](https://github.com/jkcorrea/codebase-analyzer-mcp)
[![npm](https://img.shields.io/npm/v/codebase-analyzer-mcp)](https://www.npmjs.com/package/codebase-analyzer-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Multi-layer codebase analysis with Gemini AI. Both an MCP server for Claude and a standalone CLI.

**Features:**
- Progressive disclosure - start cheap, drill down as needed
- Tree-sitter structural analysis (no LLM cost)
- Gemini semantic analysis (opt-in)
- Pattern detection, dataflow tracing
- Agent-optimized output
- **Standalone binary - no Node/Bun required**

## Installation

### Standalone Binary (Recommended)

Download the binary for your platform from [Releases](https://github.com/jkcorrea/codebase-analyzer-mcp/releases):

```bash
# macOS (Apple Silicon)
curl -L https://github.com/jkcorrea/codebase-analyzer-mcp/releases/latest/download/cba-macos-arm64 -o cba
chmod +x cba
sudo mv cba /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/jkcorrea/codebase-analyzer-mcp/releases/latest/download/cba-macos-x64 -o cba
chmod +x cba
sudo mv cba /usr/local/bin/

# Linux (x64)
curl -L https://github.com/jkcorrea/codebase-analyzer-mcp/releases/latest/download/cba-linux-x64 -o cba
chmod +x cba
sudo mv cba /usr/local/bin/

# Linux (ARM64)
curl -L https://github.com/jkcorrea/codebase-analyzer-mcp/releases/latest/download/cba-linux-arm64 -o cba
chmod +x cba
sudo mv cba /usr/local/bin/
```

### npm

```bash
npm install -g codebase-analyzer-mcp
```

### From Source (with Bun)

```bash
git clone https://github.com/jkcorrea/codebase-analyzer-mcp.git
cd codebase-analyzer-mcp
bun install && bun run build
```

## Configuration

Set your Gemini API key (required for semantic analysis):

```bash
export GEMINI_API_KEY=your_api_key_here
```

Get a key at https://aistudio.google.com/apikey

## CLI Usage

```bash
# Quick overview (surface depth - fast, free)
cba analyze . -d surface

# Standard analysis (includes structural)
cba analyze .

# Deep analysis with semantics (uses Gemini)
cba analyze . -d deep -s

# Analyze GitHub repo
cba analyze https://github.com/user/repo

# Focus on specific areas
cba analyze . --focus src/api

# Pattern detection
cba patterns .
cba patterns . --types singleton,factory,repository

# Data flow tracing
cba dataflow . "user login"
cba dataflow . "payment" --to database

# Show capabilities
cba capabilities
```

### Analysis Depths

| Depth | Speed | LLM Cost | Includes |
|-------|-------|----------|----------|
| `surface` | Fast | ~0 | Files, languages, entry points, modules |
| `standard` | Medium | Low | + symbols, imports, complexity metrics |
| `deep` | Slow | High | + semantic analysis, architecture insights |

## MCP Server Usage

Add to Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "/usr/local/bin/cba",
      "args": ["--mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

Or with npm install:

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "npx",
      "args": ["codebase-analyzer-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_repo` | Full analysis with progressive disclosure |
| `expand_section` | Drill into specific sections |
| `find_patterns` | Detect design/architecture patterns |
| `trace_dataflow` | Trace data flow through the system |
| `get_analysis_capabilities` | List available options |

## Output Structure

```json
{
  "analysisId": "analysis_xxx",
  "repositoryMap": {
    "name": "repo-name",
    "languages": [...],
    "fileCount": 42,
    "entryPoints": [...]
  },
  "summary": {
    "architectureType": "serverless",
    "primaryPatterns": ["repository", "factory"],
    "complexity": "medium"
  },
  "sections": [
    {
      "id": "module_src_api",
      "title": "API Module",
      "summary": "...",
      "canExpand": true,
      "expansionCost": { "detail": 500, "full": 2000 }
    }
  ],
  "forAgent": {
    "quickSummary": "...",
    "keyInsights": [...],
    "suggestedNextSteps": [...]
  }
}
```

## Claude Plugin

This package also works as a Claude Code plugin with agents, commands, and skills.

### Install as Plugin

```bash
# Direct install
claude /plugin install https://github.com/jkcorrea/codebase-analyzer-mcp

# Or add as marketplace first (if you want to browse/manage multiple plugins)
claude /plugin marketplace add https://github.com/jkcorrea/codebase-analyzer-mcp
claude /plugin install codebase-analyzer
```

### Plugin Commands

| Command | Description |
|---------|-------------|
| `/analyze` | Analyze a codebase |
| `/patterns` | Find design patterns |
| `/trace` | Trace data flow |
| `/explore` | Quick exploration |
| `/compare` | Compare repositories |

### Plugin Agents

| Agent | Purpose |
|-------|---------|
| `architecture-analyzer` | Full architecture analysis |
| `pattern-detective` | Pattern detection |
| `dataflow-tracer` | Data flow tracing |
| `codebase-explorer` | Quick exploration |

## Development

```bash
bun install
bun run dev           # Watch mode
bun run build         # Build TS + binary
bun run build:bin:all # Build all platform binaries
bun run cba ...       # Run CLI
```

## License

MIT

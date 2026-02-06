# Codebase Analyzer MCP

Multi-layer codebase analysis MCP server with Gemini AI.

## Philosophy

**Progressive Disclosure**: Start cheap (surface), reveal more on demand. Don't analyze everything upfront.

**Budget Awareness**: Track tokens. Surface is free, structural is cheap, semantic is expensive.

**Graceful Degradation**: Partial failures don't break analysis. Capture warnings, continue.

**Agent-First Design**: Output structured for AI agents - expandable sections, cost estimates, next steps.

## Quick Start

```bash
bun install && bun run build
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design.

## Key Paths

| Path | Purpose |
|------|---------|
| `src/mcp/server.ts` | MCP server entry |
| `src/mcp/tools/` | MCP tool definitions |
| `src/cli/index.ts` | CLI interface |
| `src/core/orchestrator.ts` | Analysis coordination |
| `src/core/layers/` | Analysis layers |
| `src/core/gemini.ts` | Gemini AI client |
| `src/core/cache.ts` | Analysis result cache |

## MCP Tools

| Tool | Purpose | Cost |
|------|---------|------|
| `analyze_repo` | Full analysis with expandable sections | Varies |
| `query_repo` | Ask questions about a codebase | Medium |
| `expand_section` | Drill into specific sections | Low |
| `read_files` | Read source files from cached analysis | None |
| `find_patterns` | Pattern detection | Medium |
| `trace_dataflow` | Data flow tracing | Medium |
| `get_analysis_capabilities` | List capabilities | None |

## Analysis Depth

| Depth | What It Does | LLM Cost |
|-------|--------------|----------|
| `surface` | File enumeration, languages, entry points | ~0 |
| `standard` | + structural analysis with Tree-sitter | Low |
| `deep` | + semantic analysis with Gemini | High |

## Adding a New MCP Tool

1. Create `src/mcp/tools/your-tool.ts` (schema + execute)
2. Export from `src/mcp/tools/index.ts`
3. Register in `src/mcp/server.ts`
4. Add CLI command in `src/cli/index.ts` (optional)
5. `bun run build`

## Environment

```bash
GEMINI_API_KEY=...  # Optional. Required for semantic analysis, patterns, dataflow.
```

Also reads from `~/.config/codebase-analyzer/config.json` as fallback:
```json
{"geminiApiKey": "your_key"}
```

## Releasing

Uses npm trusted publishing (OIDC) - no NPM_TOKEN secret needed.

1. Bump version: `npm version patch` (or minor/major)
2. Push with tags: `git push && git push --tags`

CI automatically publishes to npm when version changes on main.

## Key Learnings

### 2026-01-28: Source name extraction for GitHub URLs

When analyzing GitHub repos, temp clone directory name (cba-XXXXX) was shown instead of repo name. Fixed by extracting owner/repo from GitHub URLs before resolving to local path and passing `sourceName` through analysis chain.

**Pattern:** Preserve user-facing identifiers separately from internal paths.

### 2026-01-28: Property name consistency between types and usage

Multiple bugs from accessing wrong property names (l.name vs l.language, totalFiles vs fileCount).

**Pattern:** When adding new types, grep for all usages of old patterns and update together.

### 2026-02-05: Plugin vs MCP distribution

Claude Code plugin system adds complexity (agents, commands, skills, plugin.json) with marginal benefit for an MCP server. Env vars don't propagate to plugin MCP subprocesses, causing endless debugging. Simpler to ship as a plain MCP server with `npx`.

**Pattern:** Ship MCP servers as MCP servers, not plugins. Use plugins only when you need agents/commands/skills and don't need env vars.

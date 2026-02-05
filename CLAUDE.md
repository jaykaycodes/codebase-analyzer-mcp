# Codebase Analyzer MCP

Multi-layer codebase analysis with Gemini AI. Both an MCP server and a Claude plugin.

## Philosophy

**Progressive Disclosure**: Start cheap (surface), reveal more on demand. Don't analyze everything upfront.

**Budget Awareness**: Track tokens. Surface is free, structural is cheap, semantic is expensive.

**Graceful Degradation**: Partial failures don't break analysis. Capture warnings, continue.

**Agent-First Design**: Output structured for AI agents - expandable sections, cost estimates, next steps.

## Quick Start

```bash
pnpm install && pnpm build
```

## Plugin Components

| Component | Count | Purpose |
|-----------|-------|---------|
| Agents | 4 | Specialized analysis tasks |
| Commands | 1 | User-invocable actions |
| Skills | 1 | Context-loaded guidance |
| MCP Server | 1 | Tool interface for Claude |

### Agents

| Agent | Purpose |
|-------|---------|
| `architecture-analyzer` | Full codebase architecture analysis |
| `pattern-detective` | Design/anti-pattern detection |
| `dataflow-tracer` | Data flow tracing through systems |
| `codebase-explorer` | Quick exploration and Q&A |

### Commands

| Command | Usage |
|---------|-------|
| `/cba:analyze` | Analyze a codebase |

### Skills

| Skill | Purpose |
|-------|---------|
| `cba:codebase-analysis` | How to use the MCP tools |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design.

## Key Paths

| Path | Purpose |
|------|---------|
| `.claude-plugin/plugin.json` | Plugin metadata |
| `agents/` | Agent definitions |
| `commands/` | Slash commands |
| `skills/` | Context-loaded skills |
| `src/mcp/server.ts` | MCP server entry |
| `src/mcp/tools/` | MCP tool definitions |
| `src/cli/index.ts` | CLI interface |
| `src/core/orchestrator.ts` | Analysis coordination |
| `src/core/layers/` | Analysis layers |

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

## Adding Components

### Adding a New MCP Tool

1. Create `src/mcp/tools/your-tool.ts` (schema + execute)
2. Export from `src/mcp/tools/index.ts`
3. Register in `src/mcp/server.ts`
4. Add CLI command in `src/cli/index.ts` (optional)
5. `pnpm build`

### Adding an Agent

1. Create `agents/[category]/your-agent.md`
2. Use YAML frontmatter: name, description
3. Include examples in description
4. Update plugin.json description count

### Adding a Command

1. Create `commands/your-command.md`
2. Set `user-invocable: true` in frontmatter
3. Document usage, examples, workflow
4. Update plugin.json description count

### Adding a Skill

1. Create `skills/your-skill/SKILL.md`
2. Add references/ for detailed docs
3. Keep SKILL.md under 500 lines
4. Update plugin.json description count

## Environment

```bash
GEMINI_API_KEY=...  # Required for semantic analysis
```

## Releasing

Uses npm trusted publishing (OIDC) - no NPM_TOKEN secret needed.

1. Bump version: `npm version patch` (or minor/major)
2. Sync version to plugin.json: `bun run version:sync`
3. Push with tags: `git push && git push --tags`

CI automatically publishes to npm when version changes on main.

**Trusted publisher config:** npm package must be linked to `jaykaycodes/codebase-analyzer-mcp` in npm settings (Settings → Publishing access → Add GitHub Actions as publisher).

**Requirements:** npm >= 11.5.1 (CI updates npm automatically). See [npm trusted publishing docs](https://docs.npmjs.com/trusted-publishers/).

## Key Learnings

_This section captures learnings as we work on this repository._

### 2026-01-28: Source name extraction for GitHub URLs

When analyzing GitHub repos, temp clone directory name (cba-XXXXX) was shown instead of repo name. Fixed by extracting owner/repo from GitHub URLs before resolving to local path and passing `sourceName` through analysis chain.

**Pattern:** Preserve user-facing identifiers separately from internal paths.

### 2026-01-28: Property name consistency between types and usage

Multiple bugs from accessing wrong property names (l.name vs l.language, totalFiles vs fileCount).

**Pattern:** When adding new types, grep for all usages of old patterns and update together.

### 2026-01-28: Plugin architecture for agentic development

Adopted compound-engineering patterns: agents for specialized tasks, commands for user actions, skills for context-loaded guidance. Makes the repo self-documenting for Claude.

**Pattern:** Structure repos as plugins even for MCP servers - the documentation patterns apply.

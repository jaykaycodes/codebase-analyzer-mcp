# Agent Instructions

This repository is both an MCP server and a Claude plugin for multi-layer codebase analysis.

## Working Agreement

- **Branching:** Feature branches for non-trivial changes
- **Safety:** No destructive git commands, no deleting user data
- **Testing:** Run `pnpm build` after changes - TypeScript errors break everything
- **Architecture:** Respect layer separation (surface → structural → semantic)
- **Counts:** When adding agents/commands/skills, update plugin.json description

## Repository Structure

```
codebase-analyzer-mcp/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata
├── agents/
│   ├── analysis/             # Analysis agents
│   └── research/             # Research agents
├── commands/                 # Slash commands
├── skills/                   # Context-loaded skills
├── src/
│   ├── mcp/                  # MCP server + tools
│   ├── cli/                  # CLI interface
│   └── core/                 # Analysis engine
│       └── layers/           # Surface, structural, semantic
└── docs/                     # Documentation
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Gemini for semantic | Keep Claude context clean |
| Tree-sitter for parsing | Fast AST without LLM |
| Progressive disclosure | Minimize initial context cost |
| Plugin + MCP | Both distribution paths |

## Layer Responsibilities

**Surface Layer** (`src/core/layers/surface.ts`)
- File enumeration, language detection
- Entry points, module identification
- NO LLM calls

**Structural Layer** (`src/core/layers/structural.ts`)
- Tree-sitter parsing
- Symbol extraction
- Import/export mapping
- NO LLM calls

**Semantic Layer** (`src/core/layers/semantic.ts`)
- Gemini API calls
- Architecture detection
- Pattern recognition
- EXPENSIVE - opt-in only

## Code Patterns

**Partial failures:** Capture in `warnings[]` or `partialFailures[]`, don't throw

**Token budget:** Check before expensive operations, warn if exceeded

**Logging:** Use `logger` from `src/core/logger.ts`

## Plugin Component Guidelines

### Agents

- Place in `agents/[category]/` by purpose
- YAML frontmatter: `name`, `description` with examples
- Description explains when to use the agent
- Use haiku model for efficiency

### Commands

- Place in `commands/`
- Set `user-invocable: true`
- Document usage, options, examples
- Show workflow and implementation

### Skills

- Directory in `skills/[name]/`
- SKILL.md is entry point (<500 lines)
- references/ for detailed docs
- Description in third person

## Updating Plugin Counts

After adding/removing components:

```bash
# Count components
ls agents/**/*.md | wc -l    # agents
ls commands/*.md | wc -l      # commands
ls -d skills/*/ | wc -l       # skills

# Update description in .claude-plugin/plugin.json
```

Format: `"X agents, Y commands, Z skills"`

## Testing Checklist

- [ ] `pnpm build` succeeds
- [ ] `pnpm cba capabilities` returns JSON
- [ ] `pnpm cba analyze . -d surface -q` works
- [ ] New agent/command/skill follows patterns
- [ ] plugin.json counts match actual files

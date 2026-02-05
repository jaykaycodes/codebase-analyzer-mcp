# Streamline Plugin Surface Area

**Date:** 2026-02-05
**Status:** Design captured, ready for planning

## What We're Building

A simplified, productionized version of the codebase-analyzer Claude Code plugin. The current plugin exposes 19 components (7 tools, 5 commands, 4 agents, 3 skills) for what's essentially "understand a codebase." We're cutting this down to a focused surface that teaches users two primary tools while keeping power-user tools available but quiet.

## Why This Approach

The plugin tries too hard. Commands that wrap individual tools 1:1, agents that just call one tool each, dev-only skills shipped to end users. The result is overwhelming and confusing. A simpler "funnel" approach works better: one command, two primary tools, agents that handle routing.

## Key Decisions

### 1. Two primary MCP tools: `analyze_repo` + `query_repo`
- These are the only tools the skill doc, command, and guidance teach
- `analyze_repo`: "Show me the codebase" (structure, architecture, sections)
- `query_repo`: "Answer my question about this codebase" (AI-powered Q&A)
- All other tools (`expand_section`, `read_files`, `find_patterns`, `trace_dataflow`, `get_analysis_capabilities`) stay registered as MCP tools for power users, but are NOT highlighted in guidance

### 2. One command: `/cba:analyze`
- Single entry point for users
- Delete: `/cba:explore`, `/cba:compare`, `/cba:patterns`, `/cba:trace`
- Users with questions just ask naturally ("how does auth work in this repo?") — Claude routes to `query_repo` via the agents

### 3. Keep all 4 agents
- `cba:architecture-analyzer` — full analysis workflow
- `cba:pattern-detective` — pattern detection
- `cba:dataflow-tracer` — data flow tracing
- `cba:codebase-explorer` — quick exploration + Q&A
- These provide specialized prompts that improve quality. Claude's agent routing picks the right one based on user intent.

### 4. Delete dev-only components
- Delete `cba:add-mcp-tool` skill — dev-only, irrelevant to end users
- Delete `cba:debugging-analysis` skill — dev-only troubleshooting
- Delete `cba:compare` command — unimplemented stub
- Move useful dev guidance into CLAUDE.md if not already there

### 5. Simplify the codebase-analysis skill
- Teach only `analyze_repo` + `query_repo` as the primary workflow
- "Power User" section at the bottom mentioning the other tools exist
- Remove verbose workflow patterns — keep it to quick-start + one example flow

## Changes Summary

| Action | Component | Reason |
|--------|-----------|--------|
| **KEEP** | `analyze_repo` tool | Primary tool |
| **KEEP** | `query_repo` tool | Primary tool |
| **KEEP (quiet)** | `expand_section` tool | Power user, not taught |
| **KEEP (quiet)** | `read_files` tool | Power user, not taught |
| **KEEP (quiet)** | `find_patterns` tool | Power user, not taught |
| **KEEP (quiet)** | `trace_dataflow` tool | Power user, not taught |
| **KEEP (quiet)** | `get_analysis_capabilities` tool | Power user, not taught |
| **KEEP** | `/cba:analyze` command | Single entry point |
| **DELETE** | `/cba:explore` command | Redundant with query_repo |
| **DELETE** | `/cba:compare` command | Unimplemented stub |
| **DELETE** | `/cba:patterns` command | Redundant — agents handle this |
| **DELETE** | `/cba:trace` command | Redundant — agents handle this |
| **KEEP** | `cba:architecture-analyzer` agent | Specialized analysis |
| **KEEP** | `cba:pattern-detective` agent | Specialized analysis |
| **KEEP** | `cba:dataflow-tracer` agent | Specialized analysis |
| **KEEP** | `cba:codebase-explorer` agent | Quick exploration |
| **REWRITE** | `cba:codebase-analysis` skill | Simplify to 2 primary tools |
| **DELETE** | `cba:add-mcp-tool` skill | Dev-only |
| **DELETE** | `cba:debugging-analysis` skill | Dev-only |

## Post-Cleanup Surface

- **MCP tools:** 7 (2 primary, 5 quiet)
- **Commands:** 1
- **Agents:** 4
- **Skills:** 1

**End user sees:** `/cba:analyze`, learns `analyze_repo` + `query_repo`, agents handle the rest.

## Open Questions

- Should `capabilities.ts` only list the 2 primary tools, or all 7? (Leaning: all 7 since it's a discovery endpoint)
- Should the CLAUDE.md commands table only list `/cba:analyze`? (Leaning: yes, update to match)
- Should plugin.json description be updated to reflect the simpler surface? (Leaning: yes)

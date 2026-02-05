---
name: cba:codebase-analysis
description: How to analyze codebases using the codebase-analyzer MCP tools. Use when exploring repositories, understanding architecture, or answering questions about code.
---

# Codebase Analysis

## Quick Start

```
mcp__codebase-analyzer__analyze_repo(source: ".", depth: "standard")
```

## Primary Tools

### analyze_repo — Understand a codebase

```javascript
mcp__codebase-analyzer__analyze_repo({
  source: ".",           // Local path or GitHub URL
  depth: "standard",     // surface (fast/free) | standard (balanced) | deep (AI-powered)
  focus: ["src/api"],    // Optional: limit to specific paths
})
```

Returns `analysisId`, repository map, architecture summary, and expandable sections.

### query_repo — Ask questions about code

```javascript
mcp__codebase-analyzer__query_repo({
  source: ".",
  question: "how is authentication handled?"
})
```

Returns an answer with relevant files, confidence level, and follow-up suggestions. Reuses cached analysis for speed. Best with `GEMINI_API_KEY` set; falls back to keyword matching without it.

## Example Workflow

```javascript
// 1. Get the big picture
const analysis = analyze_repo({ source: ".", depth: "surface" });

// 2. Ask a specific question (reuses the cached analysis)
const answer = query_repo({ source: ".", question: "where is the API defined?" });

// 3. Done — answer includes relevant files and suggested follow-ups
```

## Power User Tools

These additional tools are available for advanced use cases. See [references/api-reference.md](./references/api-reference.md) for full documentation.

| Tool | What it does |
|------|-------------|
| `expand_section` | Drill into a specific section from `analyze_repo` results |
| `read_files` | Read source files using an `analysisId` (no re-clone needed) |
| `find_patterns` | Detect design patterns (singleton, factory, etc.) and anti-patterns |
| `trace_dataflow` | Trace data flow from an entry point through the system |
| `get_analysis_capabilities` | List supported languages, depths, and available tools |

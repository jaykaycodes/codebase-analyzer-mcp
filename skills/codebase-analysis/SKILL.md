---
name: codebase-analysis
description: This skill teaches how to effectively analyze codebases using the codebase-analyzer MCP tools. Use when exploring new repositories, understanding architecture, detecting patterns, or tracing data flow.
---

# Codebase Analysis

## Quick Start

Analyze any codebase with progressive disclosure:

```
mcp__codebase-analyzer__analyze_repo(source: ".", depth: "standard")
```

## Analysis Depths

| Depth | Speed | Cost | Use When |
|-------|-------|------|----------|
| `surface` | Fast | Free | Quick overview, file structure |
| `standard` | Medium | Low | Understanding architecture, symbols |
| `deep` | Slow | High | Full semantic analysis with AI |

**Rule of thumb:** Start with surface, upgrade if needed.

## Core Tools

### 1. Analyze Repository

```javascript
mcp__codebase-analyzer__analyze_repo({
  source: ".",                    // Local path or GitHub URL
  depth: "standard",              // surface | standard | deep
  focus: ["src/api"],             // Optional: focus areas
  exclude: ["node_modules"],      // Optional: exclude patterns
  tokenBudget: 800000,            // Optional: max tokens
  includeSemantics: false         // Optional: enable AI analysis
})
```

**Returns:**
- `repositoryMap`: Files, languages, structure
- `summary`: Architecture type, patterns, complexity
- `sections`: Expandable areas for drill-down
- `forAgent`: Quick summary and next steps

### 2. Expand Section

After analysis, drill into specific sections:

```javascript
mcp__codebase-analyzer__expand_section({
  analysisId: "analysis_xxx",     // From analyze_repo result
  sectionId: "module_src_api",    // Section ID to expand
  depth: "detail"                 // detail | full
})
```

### 3. Find Patterns

Detect design and architecture patterns:

```javascript
mcp__codebase-analyzer__find_patterns({
  source: ".",
  patternTypes: ["singleton", "factory", "repository"]  // Optional filter
})
```

**Available patterns:** singleton, factory, observer, strategy, decorator, adapter, facade, repository, dependency-injection, event-driven, pub-sub, middleware, mvc, mvvm, clean-architecture, hexagonal, cqrs, saga

### 4. Trace Dataflow

Follow data through the system:

```javascript
mcp__codebase-analyzer__trace_dataflow({
  source: ".",
  from: "user login",             // Entry point
  to: "database"                  // Optional destination
})
```

### 5. Get Capabilities

Check what's available:

```javascript
mcp__codebase-analyzer__get_analysis_capabilities()
```

## Workflow Patterns

### New Codebase Orientation

1. Run surface analysis
2. Review repository map and entry points
3. Expand interesting modules
4. Run pattern detection if architecture unclear

### Security Review

1. Trace dataflow from external inputs
2. Check for anti-patterns
3. Map trust boundaries

### Understanding Legacy Code

1. Deep analysis with semantics
2. Pattern detection for architecture
3. Expand each major module

## Guidelines

**DO:**
- Start cheap (surface), escalate if needed
- Use `focus` to limit scope for large repos
- Check `expansionCost` before expanding sections
- Use `forAgent.suggestedNextSteps`

**DON'T:**
- Run deep analysis on first request
- Ignore token budget warnings
- Expand all sections at once

## References

For detailed API documentation, see [references/api-reference.md](./references/api-reference.md).

# Architecture

## Overview

Multi-layer analysis system with progressive disclosure. Designed for AI agents to efficiently explore codebases without exhausting context windows.

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server / CLI                        │
├─────────────────────────────────────────────────────────────┤
│                      Orchestrator                           │
│  ┌─────────────┬─────────────────┬────────────────────┐    │
│  │   Surface   │   Structural    │     Semantic       │    │
│  │   (Fast)    │   (Tree-sitter) │     (Gemini)       │    │
│  └─────────────┴─────────────────┴────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│              Progressive Disclosure Builder                  │
└─────────────────────────────────────────────────────────────┘
```

## Analysis Layers

### Layer 0: Surface (Always Runs)
**Cost:** ~0 LLM tokens
**Source:** `src/core/layers/surface.ts`

Produces:
- Repository map (file tree, languages, sizes)
- Module identification
- Entry point detection
- Complexity score (0-100)

### Layer 1: Structural (Standard Depth)
**Cost:** Low (~parsing only)
**Source:** `src/core/layers/structural.ts`

Uses tree-sitter to extract:
- Symbols (functions, classes, types)
- Import/export relationships
- Complexity metrics

Runs in parallel batches (max 5 modules concurrent).

### Layer 2: Semantic (Deep Depth)
**Cost:** High (Gemini API calls)
**Source:** `src/core/layers/semantic.ts`

LLM-powered analysis:
- Architecture type detection
- Pattern recognition
- Cross-file relationship inference
- High-level insights

## Progressive Disclosure

Results are structured in expandable sections to minimize initial context cost.

```
Level 0: Repository Map (always included)
Level 1: Summary (architecture type, patterns, tech stack)
Level 2: Section Details (expand via expand_section tool)
Level 3: Full Section Data (complete analysis)
```

Each section includes `expansionCost` estimates so agents can make informed decisions.

## Orchestration Flow

```
orchestrateAnalysis()
  │
  ├── Phase 1: Surface Analysis
  │     └── Produces: RepositoryMap, ModuleIdentification[]
  │
  ├── Phase 2: Structural Analysis (parallel by module)
  │     ├── Load files per module
  │     ├── Parse with tree-sitter
  │     └── Produces: StructuralAnalysis[]
  │
  ├── Phase 3: Semantic Analysis (if depth=deep or includeSemantics)
  │     └── Produces: SemanticAnalysis
  │
  └── Phase 4: Synthesis
        └── buildAnalysisResult() → AnalysisResultV2
```

## Key Types

```typescript
// Main result type
interface AnalysisResultV2 {
  analysisId: string;
  repositoryMap: RepositoryMap;
  summary: AnalysisSummary;
  sections: ExpandableSection[];
  forAgent: AgentDigest;
}

// Expandable section for progressive disclosure
interface ExpandableSection {
  id: string;
  title: string;
  summary: string;
  canExpand: boolean;
  expansionCost: { detail: number; full: number };
}
```

## MCP Tools

| Tool | Purpose | Cost |
|------|---------|------|
| `analyze_repo` | Full analysis | Varies by depth |
| `expand_section` | Drill into section | Low |
| `find_patterns` | Pattern detection | Medium |
| `trace_dataflow` | Data flow tracing | Medium |
| `get_analysis_capabilities` | List capabilities | None |

## Caching

Results are cached in-memory by source path for `expand_section` operations.

**Source:** `src/core/cache.ts`

## Error Handling

- Partial failures are captured in `partialFailures[]`
- Analysis continues even if individual modules fail
- Warnings collected throughout for transparency

## Token Budget

Default: 800,000 tokens

Orchestrator tracks usage and warns when budget exceeded. Individual layers respect budget constraints.

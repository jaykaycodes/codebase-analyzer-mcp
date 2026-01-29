---
title: "Deep Codebase Analyzer v2: Multi-Agent Architecture with Marketplace Distribution"
type: feat
date: 2026-01-28
---

# Deep Codebase Analyzer v2

Transform codebase-analyzer-mcp from a simple single-LLM-call tool into a state-of-the-art, multi-agent codebase analysis system optimized for AI agent consumption with Claude marketplace distribution.

## Overview

The current tool loads an entire codebase and makes a single Gemini API call. While this works for small-to-medium repos, it produces shallow analysis, lacks progressive disclosure, and cannot handle large codebases gracefully.

The v2 architecture introduces:
1. **Multi-layer analysis** - Surface → Structural → Semantic layers with different cost/depth tradeoffs
2. **Parallel sub-agent analysis** - Orchestrator spawns sub-agents for different code paths
3. **Progressive disclosure** - Summary → Detail → Full with token-budget awareness
4. **Dynamic capability discovery** - Agents can discover available analysis types
5. **Marketplace distribution** - Package as Claude plugin for easy installation

## Problem Statement / Motivation

### Current Limitations

1. **Shallow Analysis** - Single LLM call can't deeply understand large codebases
2. **No Progressive Disclosure** - Returns everything or nothing, wasting tokens
3. **No Structural Understanding** - Pure LLM analysis misses AST-level insights
4. **Monolithic Architecture** - Can't parallelize analysis of independent modules
5. **Poor Distribution** - Requires manual npm install and MCP configuration

### Why This Matters

AI agents are increasingly used for codebase understanding. Leading tools (Cursor, Aider, Cody) use sophisticated multi-layer architectures. A "deeply awesome" tool for AI agent consumption needs:
- **Hybrid retrieval** - Structure-aware (AST) + semantic (embeddings) + lexical search
- **Token budget awareness** - Agents have limited context windows
- **Progressive depth** - Start shallow, drill deep on demand
- **Parallel analysis** - Faster results through concurrent sub-agent work

## Proposed Solution

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR LAYER                                 │
│  - Receives analysis request                                                │
│  - Determines appropriate depth/budget                                      │
│  - Spawns and coordinates sub-agents                                        │
│  - Aggregates results with progressive disclosure                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  SURFACE LAYER    │     │  STRUCTURAL LAYER │     │  SEMANTIC LAYER   │
│  (Fast, Cheap)    │     │  (Tree-sitter)    │     │  (Gemini + embed) │
│                   │     │                   │     │                   │
│  - File listing   │     │  - AST parsing    │     │  - Pattern recog  │
│  - Language detect│     │  - Symbol extract │     │  - Architecture   │
│  - Size/complexity│     │  - Call graphs    │     │  - Deep semantics │
│  - README extract │     │  - Dependency map │     │  - Cross-file     │
│  - Entry points   │     │  - Type hierarchy │     │    relationships  │
│                   │     │                   │     │                   │
│  Cost: ~0         │     │  Cost: Low        │     │  Cost: High       │
│  Time: <2s        │     │  Time: <10s       │     │  Time: <30s       │
└───────────────────┘     └───────────────────┘     └───────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROGRESSIVE DISCLOSURE OUTPUT                           │
│                                                                              │
│  Level 0: Repository Map (always)     - File tree, languages, entry points  │
│  Level 1: Summary (default)           - Architecture type, key patterns     │
│  Level 2: Detail (on request)         - Module deep dives, data models      │
│  Level 3: Full (on request)           - Complete code-level analysis        │
│                                                                              │
│  Each section has: { id, summary, canExpand, expansionCost }                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sub-Agent Architecture

Sub-agents are **parallel Gemini API calls** orchestrated by a coordinator function (not separate processes):

```typescript
// Orchestrator spawns sub-agents as parallel promises
async function orchestrateAnalysis(repo: RepoContext, options: AnalysisOptions) {
  // Phase 1: Surface scan (always runs, fast)
  const surface = await surfaceAnalysis(repo);

  // Phase 2: Structural analysis (parallel by module)
  const modules = surface.identifiedModules;
  const structuralResults = await Promise.all(
    modules.map(m => structuralSubAgent(m, options.structuralDepth))
  );

  // Phase 3: Semantic analysis (conditional, expensive)
  let semanticResults = null;
  if (options.includeSemantics && surface.complexity > SEMANTIC_THRESHOLD) {
    semanticResults = await semanticSubAgent(repo, structuralResults);
  }

  // Phase 4: Synthesis
  return synthesize(surface, structuralResults, semanticResults, options.budget);
}
```

### MCP Tool Design

Following agent-native principles: **tools are primitives, not workflows**.

```typescript
// Discovery tool - agents learn what's available
tool("get_analysis_capabilities", {}, async () => {
  return {
    layers: ["surface", "structural", "semantic"],
    tools: ["analyze_repo", "analyze_module", "find_patterns", "trace_dataflow", "expand_section"],
    models: AVAILABLE_MODELS,
    estimateCost: (repoSize) => /* token cost estimate */
  };
});

// Primary analysis - replaces current analyze_repo
tool("analyze_repo", {
  source: z.string(),
  depth: z.enum(["surface", "standard", "deep"]).default("standard"),
  focus: z.array(z.string()).optional(),
  tokenBudget: z.number().optional(),
  includeSemantics: z.boolean().default(false),
}, async (args) => { /* orchestrator logic */ });

// Progressive disclosure - drill into sections
tool("expand_section", {
  analysisId: z.string(),  // From previous analysis
  sectionId: z.string(),   // Section to expand
  depth: z.enum(["detail", "full"]).default("detail"),
}, async (args) => { /* targeted re-analysis */ });

// Targeted tools - for specific queries
tool("find_patterns", {
  source: z.string(),
  patternTypes: z.array(z.string()),  // ["singleton", "factory", "observer", etc.]
}, async (args) => { /* pattern-specific analysis */ });

tool("trace_dataflow", {
  source: z.string(),
  from: z.string(),  // Entry point
  to: z.string().optional(),  // Destination (if known)
}, async (args) => { /* data flow tracing */ });
```

### Output Schema with Progressive Disclosure

```typescript
interface AnalysisResult {
  // Metadata
  analysisId: string;           // For subsequent expand calls
  timestamp: string;
  source: string;
  tokenCost: number;

  // Always present: Repository map
  repositoryMap: {
    name: string;
    languages: LanguageBreakdown[];
    fileCount: number;
    estimatedTokens: number;
    entryPoints: string[];
    structure: DirectoryTree;
  };

  // Level 1: Summary (default)
  summary: {
    architectureType: string;   // "monolith", "microservices", "modular-monolith", etc.
    primaryPatterns: string[];
    techStack: string[];
    complexity: "low" | "medium" | "high";
  };

  // Expandable sections
  sections: ExpandableSection[];

  // Agent-optimized digest
  forAgent: {
    quickSummary: string;       // 2-3 sentences
    keyInsights: string[];      // Most important things
    suggestedNextSteps: string[];  // What to analyze deeper
  };
}

interface ExpandableSection {
  id: string;
  title: string;
  summary: string;              // Always present
  detail?: object;              // Present if expanded to detail
  full?: object;                // Present if expanded to full
  canExpand: boolean;
  expansionCost: {
    detail: number;             // Token cost to expand to detail
    full: number;               // Token cost to expand to full
  };
}
```

## Technical Approach

### Phase 1: Core Infrastructure (Foundation)

**Objective:** Establish multi-layer architecture and sub-agent orchestration.

#### Tasks

- [ ] Create orchestrator module (`src/core/orchestrator.ts`)
  - Coordinate multi-phase analysis
  - Spawn parallel sub-agents (Promise.all pattern)
  - Handle partial failures gracefully
  - Implement token budget tracking

- [ ] Implement surface layer (`src/core/layers/surface.ts`)
  - Fast file enumeration and language detection
  - README/documentation extraction
  - Entry point identification
  - Complexity estimation (file count, avg file size, nesting depth)

- [ ] Implement structural layer (`src/core/layers/structural.ts`)
  - Tree-sitter integration for AST parsing
  - Symbol extraction (functions, classes, types)
  - Call graph construction
  - Dependency mapping

- [ ] Create progressive disclosure system (`src/core/disclosure.ts`)
  - Section ID generation
  - Expansion cost estimation
  - Cache management for expanded sections

- [ ] Update types (`src/types.ts`)
  - New `AnalysisResult` interface with expandable sections
  - `AnalysisOptions` with depth/budget controls
  - Sub-agent result types

#### Files to Create/Modify

```
src/
├── core/
│   ├── orchestrator.ts       # NEW: Multi-agent orchestration
│   ├── disclosure.ts         # NEW: Progressive disclosure system
│   ├── cache.ts              # NEW: Analysis result caching
│   ├── layers/
│   │   ├── index.ts          # NEW: Layer exports
│   │   ├── surface.ts        # NEW: Surface analysis
│   │   ├── structural.ts     # NEW: Tree-sitter structural analysis
│   │   └── semantic.ts       # NEW: Deep semantic analysis
│   ├── analyzer.ts           # MODIFY: Use orchestrator
│   ├── gemini.ts             # MODIFY: Add retry logic, rate limiting
│   └── repo-loader.ts        # MODIFY: Add temp file cleanup
├── types.ts                  # MODIFY: New interfaces
└── mcp/
    └── server.ts             # MODIFY: New tools
```

#### Success Criteria

- [ ] Surface analysis completes in <2s for repos up to 10k files
- [ ] Structural analysis processes 100 files/second with Tree-sitter
- [ ] Orchestrator handles 5 parallel sub-agents without issues
- [ ] Token budget tracking accurate within 10%

#### Estimated Effort

Medium-high complexity. Tree-sitter integration is the main risk.

---

### Phase 2: Enhanced MCP Interface (Agent Ergonomics)

**Objective:** Create agent-native tool interface with capability discovery.

#### Tasks

- [ ] Implement capability discovery tool
  - Return available analysis types
  - Provide cost estimates
  - List supported languages

- [ ] Refactor `analyze_repo` tool
  - Add `depth` parameter (surface/standard/deep)
  - Add `tokenBudget` parameter
  - Add `includeSemantics` flag
  - Return progressive disclosure format

- [ ] Implement `expand_section` tool
  - Accept analysis ID and section ID
  - Support detail and full expansion levels
  - Use cached analysis state

- [ ] Add targeted analysis tools
  - `find_patterns` - Architecture pattern detection
  - `trace_dataflow` - Data flow analysis
  - `analyze_module` - Single module deep dive

- [ ] Implement streaming progress (if MCP supports)
  - Report phase completion
  - Estimated time remaining

#### Files to Create/Modify

```
src/mcp/
├── server.ts                 # MODIFY: New tools
├── tools/
│   ├── capabilities.ts       # NEW: get_analysis_capabilities
│   ├── analyze.ts            # NEW: Enhanced analyze_repo
│   ├── expand.ts             # NEW: expand_section
│   ├── patterns.ts           # NEW: find_patterns
│   └── dataflow.ts           # NEW: trace_dataflow
└── resources/
    └── analysis-cache.ts     # NEW: MCP resource for cached analyses
```

#### Success Criteria

- [ ] Agents can discover all available capabilities
- [ ] `expand_section` returns results in <5s using cache
- [ ] All tools have comprehensive Zod schemas with descriptions
- [ ] Error responses include actionable guidance

---

### Phase 3: Marketplace Distribution (Polish & Launch)

**Objective:** Package for Claude marketplace with proper documentation.

#### Tasks

- [ ] Create plugin manifest (`.claude-plugin/plugin.json`)
  ```json
  {
    "name": "codebase-analyzer",
    "version": "2.0.0",
    "description": "Deep codebase analysis with multi-agent architecture",
    "mcpServers": {
      "codebase-analyzer": {
        "command": "node",
        "args": ["${CLAUDE_PLUGIN_ROOT}/dist/mcp/server.js"],
        "env": {
          "GEMINI_API_KEY": "${GEMINI_API_KEY}"
        }
      }
    }
  }
  ```

- [ ] Create marketplace manifest (`.claude-plugin/marketplace.json`)

- [ ] Add installation documentation
  - API key setup instructions
  - Usage examples
  - Troubleshooting guide

- [ ] Implement security hardening
  - Sensitive file detection (.env, credentials)
  - Temp directory cleanup
  - Input sanitization

- [ ] Add telemetry opt-in (optional)
  - Usage analytics
  - Error reporting

- [ ] Update package.json for npm publishing
  - `publishConfig` for public access
  - Proper `files` array
  - Keywords for discoverability

#### Files to Create/Modify

```
.claude-plugin/
├── plugin.json               # NEW: Plugin manifest
└── marketplace.json          # NEW: Marketplace manifest
docs/
├── INSTALLATION.md           # NEW: Setup guide
├── USAGE.md                  # NEW: Usage examples
└── API.md                    # NEW: Tool reference
package.json                  # MODIFY: Publishing config
CHANGELOG.md                  # NEW: Version history
```

#### Success Criteria

- [ ] Plugin installs via `claude plugin install`
- [ ] Works out-of-box after setting GEMINI_API_KEY
- [ ] README has clear quickstart
- [ ] No sensitive data leakage in analysis output

---

## Alternative Approaches Considered

### 1. External Orchestration (LangChain/CrewAI)

**Approach:** Use LangChain or CrewAI for multi-agent orchestration.

**Pros:**
- Battle-tested multi-agent patterns
- Rich ecosystem of tools
- Handles complex agent communication

**Cons:**
- Heavy dependency for a focused tool
- Adds latency for simple analyses
- Different mental model than MCP

**Decision:** Rejected. Keep it simple with Promise.all-based orchestration. Can revisit if complexity grows.

### 2. Embedding-First Architecture

**Approach:** Pre-index all code with embeddings for retrieval-augmented analysis.

**Pros:**
- Fast retrieval once indexed
- Works well for large codebases
- Standard RAG pattern

**Cons:**
- Requires indexing step (slow for first use)
- Storage requirements
- Embeddings don't capture structure well

**Decision:** Hybrid approach. Use Tree-sitter for structure, embeddings optional for semantic layer.

### 3. Worker Thread Sub-Agents

**Approach:** Spawn actual worker threads for parallel analysis.

**Pros:**
- True parallelism
- Better resource isolation
- Can utilize multiple CPU cores

**Cons:**
- Complex message passing
- Memory overhead
- Harder to debug

**Decision:** Rejected for v2. Parallel API calls are simpler and Gemini is the bottleneck anyway.

## Acceptance Criteria

### Functional Requirements

- [ ] Multi-layer analysis (surface, structural, semantic) works correctly
- [ ] Progressive disclosure returns expandable sections
- [ ] `expand_section` tool retrieves cached analysis and expands requested section
- [ ] Token budget is respected with graceful degradation
- [ ] Tree-sitter parses top 10 languages correctly
- [ ] Sub-agent failures don't crash entire analysis
- [ ] Plugin installs from Claude marketplace

### Non-Functional Requirements

- [ ] Surface analysis: <2s for repos up to 10k files
- [ ] Standard analysis: <15s for typical repos (100-500 files)
- [ ] Deep analysis: <60s for complex repos
- [ ] Memory usage: <500MB for analysis of 1M token repos
- [ ] No sensitive data (API keys, passwords) in output
- [ ] Temp files cleaned up after analysis

### Quality Gates

- [ ] Unit tests for orchestrator, each layer, and disclosure system
- [ ] Integration tests for full analysis pipeline
- [ ] E2E test: analyze this repo and verify output structure
- [ ] Security review for sensitive file handling
- [ ] Documentation complete for all new tools

## Success Metrics

1. **Depth of Analysis** - Compare v1 vs v2 output on same repos; v2 should identify more patterns, have richer data models
2. **Token Efficiency** - Progressive disclosure should reduce average tokens used by 50% for simple queries
3. **Latency** - Standard analysis should complete in <15s (currently ~30s for large repos)
4. **Reliability** - <1% analysis failures on public GitHub repos

## Dependencies & Prerequisites

### Technical Dependencies

| Dependency | Purpose | Risk |
|------------|---------|------|
| tree-sitter | AST parsing | Low - mature library |
| tree-sitter-* grammars | Language support | Medium - need 10 grammars |
| @google/genai | Gemini API | Low - already using |
| zod | Schema validation | Low - already using |

### External Dependencies

- Gemini API access (user provides key)
- Claude marketplace approval (for distribution)

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tree-sitter grammar issues | Medium | Medium | Fallback to regex-based extraction |
| Gemini rate limiting | High | Medium | Implement retry with backoff, sub-agent pooling |
| Token budget exceeded | Medium | Low | Graceful degradation with partial results |
| Plugin approval delays | Low | Medium | Publish to npm as fallback |
| Sub-agent coordination bugs | Medium | High | Extensive testing, timeout/circuit breaker |

## Future Considerations

### v2.1 Potential Features

- **Incremental analysis** - Only re-analyze changed files
- **Custom prompts** - User-defined analysis prompts
- **Local embeddings** - Offline semantic search
- **Streaming output** - Results as sub-agents complete

### v3 Vision

- **Language-specific agents** - Python expert, TypeScript expert, etc.
- **Security analysis** - Vulnerability detection
- **Performance analysis** - Complexity metrics, potential bottlenecks
- **Interactive exploration** - Chat-based codebase exploration

## Documentation Plan

- [ ] Update README.md with v2 features
- [ ] Create INSTALLATION.md for marketplace users
- [ ] Create API.md documenting all tools
- [ ] Add examples/ directory with common usage patterns
- [ ] CHANGELOG.md following Keep a Changelog format

## References & Research

### Internal References

- Current analyzer: `src/core/analyzer.ts`
- Current MCP server: `src/mcp/server.ts`
- File filtering: `src/core/file-filter.ts`

### External References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Claude Plugin Marketplace Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- [Aider Repository Map](https://aider.chat/docs/repomap.html) - Inspiration for progressive disclosure
- [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

### Comparable Tools Studied

- Cursor - Agent mode, codebase embeddings
- Sourcegraph Cody - RAG across organization
- Aider - Repository map with graph ranking
- Continue - Hybrid retrieval with reranking

---

## Appendix: Open Questions

### Critical (Must Answer Before Implementation)

1. **Sub-agent failure handling** - Return partial results (recommended) or fail entire analysis?
   - **Recommendation:** Partial results with clear indication of what failed

2. **Tree-sitter language priority** - Which 10 languages for v2?
   - **Recommendation:** JS/TS, Python, Go, Rust, Java, C/C++, Ruby, PHP, C#, Swift

3. **Cache storage** - In-memory only, or persist to disk?
   - **Recommendation:** In-memory with 1-hour TTL, keyed by repo+commit hash

### Important (Should Answer During Phase 1)

4. **Semantic layer trigger** - Always opt-in, or automatic based on complexity?
   - **Recommendation:** Opt-in via `includeSemantics` flag

5. **Private repo auth** - Support explicit GitHub token, or rely on git config?
   - **Recommendation:** Rely on user's git config; document in INSTALLATION.md

### Nice-to-Have (Can Defer)

6. **Streaming output** - Worth implementing for long analyses?
7. **Analysis versioning** - Track analysis over time?
8. **Telemetry** - Collect usage data?

# API Reference

Complete reference for codebase-analyzer MCP tools.

## analyze_repo

Full architectural analysis with progressive disclosure.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `source` | string | Yes | - | Local path or GitHub URL |
| `depth` | enum | No | "standard" | surface, standard, deep |
| `focus` | string[] | No | - | Paths to focus on |
| `exclude` | string[] | No | - | Glob patterns to exclude |
| `tokenBudget` | number | No | 800000 | Max tokens for analysis |
| `includeSemantics` | boolean | No | false | Enable LLM analysis |

### Response

```typescript
{
  analysisId: string;           // Use for expand_section, read_files
  version: 2;
  timestamp: string;
  source: string;
  depth: "surface" | "standard" | "deep";
  tokenCost: number;
  durationMs: number;

  repositoryMap: {
    name: string;
    languages: Array<{
      language: string;
      fileCount: number;
      percentage: number;
      extensions: string[];
    }>;
    fileCount: number;
    totalSize: number;
    estimatedTokens: number;
    entryPoints: string[];
    structure: DirectoryNode;
    readme?: string;
  };

  summary: {
    architectureType: string;
    primaryPatterns: string[];
    techStack: string[];
    complexity: "low" | "medium" | "high";
  };

  sections: Array<{
    id: string;
    title: string;
    type: "module" | "pattern" | "datamodel" | "api" | "custom";
    summary: string;
    canExpand: boolean;
    expansionCost: {
      detail: number;
      full: number;
    };
  }>;

  forAgent: {
    quickSummary: string;
    keyInsights: string[];
    suggestedNextSteps: string[];
  };

  warnings?: string[];
  partialFailures?: Array<{
    layer: string;
    error: string;
  }>;
}
```

## expand_section

Expand a section from previous analysis.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `analysisId` | string | Yes | From analyze_repo result |
| `sectionId` | string | Yes | Section ID to expand |
| `depth` | enum | No | "detail" or "full" (default: detail) |

### Response

```typescript
{
  section: ExpandableSection | null;
  error?: string;
}
```

## find_patterns

Detect patterns in codebase.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Local path or GitHub URL |
| `patternTypes` | string[] | No | Filter to specific patterns |

### Available Pattern Types

**Design Patterns:**
- `singleton` - Single instance pattern
- `factory` - Object creation abstraction
- `observer` - Event subscription pattern
- `strategy` - Interchangeable algorithms
- `decorator` - Dynamic behavior extension
- `adapter` - Interface compatibility
- `facade` - Simplified interface
- `repository` - Data access abstraction
- `dependency-injection` - Inversion of control

**Architectural Patterns:**
- `event-driven` - Event-based architecture
- `pub-sub` - Publish-subscribe messaging
- `middleware` - Request processing chain
- `mvc` - Model-View-Controller
- `mvvm` - Model-View-ViewModel
- `clean-architecture` - Dependency rule layers
- `hexagonal` - Ports and adapters
- `cqrs` - Command Query Responsibility Segregation
- `saga` - Distributed transaction pattern

### Response

```typescript
{
  patterns: Array<{
    name: string;
    type: "architectural" | "design" | "anti-pattern";
    confidence: number;        // 0-1
    locations: string[];       // File paths
    description: string;
  }>;
  summary: string;
}
```

## trace_dataflow

Trace data flow through the system.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Local path or GitHub URL |
| `from` | string | Yes | Entry point (function, file, or description) |
| `to` | string | No | Destination to trace to |

### Response

```typescript
{
  entryPoint: string;
  destination?: string;
  steps: Array<{
    location: string;
    operation: string;
    dataShape?: string;
  }>;
  securityObservations: string[];
  recommendations: string[];
}
```

## read_files

Read specific files from a previously analyzed repository. Uses the cached clone so you don't need to re-analyze or re-clone.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `analysisId` | string | Yes | - | From analyze_repo or query_repo result |
| `paths` | string[] | Yes | - | Relative file paths (min 1, max 20) |
| `maxLines` | number | No | 500 | Max lines per file (max 2000) |

### Response

```typescript
{
  analysisId: string;
  files: Array<{
    path: string;
    content?: string;          // File content (if readable)
    lineCount?: number;        // Total lines in file
    truncated?: boolean;       // True if content was truncated
    error?: string;            // Error message (if not readable)
  }>;
}
```

### Notes

- Paths must be relative to the repository root
- Path traversal (../) is blocked for security
- Works with both local repos and GitHub clones
- Cache expires after 1 hour — re-run analyze_repo or query_repo if expired

## query_repo

Ask a question about a codebase and get an AI-powered answer with relevant file references.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Local path or GitHub URL |
| `question` | string | Yes | Question about the codebase |

### Response

```typescript
{
  answer: string;              // Detailed answer referencing code
  relevantFiles: Array<{
    path: string;              // Relative file path
    reason: string;            // Why this file is relevant
  }>;
  confidence: "high" | "medium" | "low";
  analysisId: string;          // Use for follow-up read_files
  suggestedFollowUps: string[];
}
```

### Notes

- Reuses cached analysis when available (fast for repeated queries on same repo)
- With `GEMINI_API_KEY`: AI-powered answer using structural analysis + file contents
- Without `GEMINI_API_KEY`: keyword-matching fallback with pointers to relevant files
- The `analysisId` enables follow-up `read_files` calls to examine code in detail

## get_analysis_capabilities

List available analysis options.

### Parameters

None.

### Response

```typescript
{
  layers: string[];
  depths: string[];
  supportedLanguages: string[];
  tools: Array<{
    name: string;
    description: string;
    parameters: string[];
  }>;
}
```

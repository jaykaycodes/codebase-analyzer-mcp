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
  analysisId: string;           // Use for expand_section
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

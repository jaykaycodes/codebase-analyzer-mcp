export interface LoadOptions {
  exclude?: string[];
  include?: string[];
  maxTokens?: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
}

export interface RepoContext {
  files: FileContent[];
  tokenCount: number;
  source: string;
}

export interface AnalyzeRepoInput {
  source: string;
  focus?: string[];
  exclude?: string[];
}

export interface ModuleInfo {
  path: string;
  purpose: string;
}

export interface DependencyInfo {
  name: string;
  purpose: string;
}

export interface DataModel {
  name: string;
  fields: string[];
  relationships: string[];
}

export interface ApiEndpoint {
  path: string;
  method: string;
  purpose: string;
}

export interface AnalyzeRepoOutput {
  architecture: {
    overview: string;
    patterns: string[];
    keyDecisions: string[];
    dataFlow: string;
  };
  structure: {
    entryPoints: string[];
    coreModules: ModuleInfo[];
    dependencies: DependencyInfo[];
  };
  models: {
    dataModels: DataModel[];
    apiEndpoints?: ApiEndpoint[];
  };
  patterns: {
    conventions: string[];
    stateManagement?: string;
    errorHandling?: string;
    testing?: string;
  };
  forAgent: {
    summary: string;
    keyInsights: string[];
    replicationGuide: string;
  };
}

export interface ExtractFeatureInput {
  source: string;
  feature: string;
}

export interface FeatureFile {
  path: string;
  role: string;
  keyCode?: string;
}

export interface ExtractFeatureOutput {
  feature: string;
  implementation: {
    files: FeatureFile[];
    dataFlow: string;
    dependencies: string[];
    patterns: string[];
  };
  forAgent: {
    summary: string;
    howToReplicate: string[];
  };
}

export interface QueryRepoInput {
  source: string;
  question: string;
}

export interface FileReference {
  file: string;
  lines?: string;
  snippet?: string;
}

export interface QueryRepoOutput {
  answer: string;
  references: FileReference[];
  confidence: "high" | "medium" | "low";
}

export interface CompareReposInput {
  sources: string[];
  aspect: string;
}

export interface RepoComparison {
  repo: string;
  approach: string;
  pros: string[];
  cons: string[];
  keyFiles: string[];
}

export interface CompareReposOutput {
  aspect: string;
  comparisons: RepoComparison[];
  recommendation: string;
}

export type OutputFormat = "json" | "markdown";

// ============================================================================
// V2 Types: Multi-Layer Analysis with Progressive Disclosure
// ============================================================================

/**
 * Analysis depth levels
 * - surface: Fast file enumeration, language detection, entry points (~0 LLM cost)
 * - standard: Surface + structural analysis with Tree-sitter (low LLM cost)
 * - deep: All layers including semantic analysis with Gemini (high LLM cost)
 */
export type AnalysisDepth = "surface" | "standard" | "deep";

/**
 * Options for v2 analysis
 */
export interface AnalysisOptions {
  depth?: AnalysisDepth;
  focus?: string[];
  exclude?: string[];
  tokenBudget?: number;
  includeSemantics?: boolean;
}

/**
 * Language breakdown in repository
 */
export interface LanguageBreakdown {
  language: string;
  fileCount: number;
  percentage: number;
  extensions: string[];
}

/**
 * Directory tree node for repository structure
 */
export interface DirectoryNode {
  name: string;
  type: "file" | "directory";
  children?: DirectoryNode[];
  language?: string;
  size?: number;
}

/**
 * Repository map - always present in analysis results
 */
export interface RepositoryMap {
  name: string;
  languages: LanguageBreakdown[];
  fileCount: number;
  totalSize: number;
  estimatedTokens: number;
  entryPoints: string[];
  structure: DirectoryNode;
  readme?: string;
}

/**
 * Expandable section with progressive disclosure
 */
export interface ExpandableSection {
  id: string;
  title: string;
  type: "module" | "pattern" | "datamodel" | "api" | "custom";
  summary: string;
  detail?: Record<string, unknown>;
  full?: Record<string, unknown>;
  canExpand: boolean;
  expansionCost: {
    detail: number;
    full: number;
  };
}

/**
 * Summary level analysis (Level 1)
 */
export interface AnalysisSummary {
  architectureType: string;
  primaryPatterns: string[];
  techStack: string[];
  complexity: "low" | "medium" | "high";
}

/**
 * Agent-optimized digest
 */
export interface AgentDigest {
  quickSummary: string;
  keyInsights: string[];
  suggestedNextSteps: string[];
}

/**
 * V2 Analysis Result with progressive disclosure
 */
export interface AnalysisResultV2 {
  // Metadata
  analysisId: string;
  version: 2;
  timestamp: string;
  source: string;
  depth: AnalysisDepth;
  tokenCost: number;
  durationMs: number;

  // Always present: Repository map (Level 0)
  repositoryMap: RepositoryMap;

  // Summary (Level 1) - default
  summary: AnalysisSummary;

  // Expandable sections (Levels 2-3)
  sections: ExpandableSection[];

  // Agent-optimized digest
  forAgent: AgentDigest;

  // Errors/warnings during analysis
  warnings?: string[];
  partialFailures?: {
    layer: string;
    error: string;
  }[];
}

// ============================================================================
// Layer-specific types
// ============================================================================

/**
 * Surface layer analysis result
 */
export interface SurfaceAnalysis {
  repositoryMap: RepositoryMap;
  identifiedModules: ModuleIdentification[];
  complexity: number; // 0-100 score
  estimatedAnalysisTime: {
    structural: number;
    semantic: number;
  };
}

/**
 * Module identification from surface scan
 */
export interface ModuleIdentification {
  path: string;
  name: string;
  type: "core" | "util" | "test" | "config" | "unknown";
  fileCount: number;
  primaryLanguage: string;
}

/**
 * Symbol extracted by structural analysis
 */
export interface ExtractedSymbol {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "constant" | "method";
  file: string;
  line: number;
  exported: boolean;
  parameters?: string[];
  returnType?: string;
}

/**
 * Import/dependency relationship
 */
export interface ImportRelation {
  from: string;
  to: string;
  importedNames: string[];
  isDefault: boolean;
  isType: boolean;
}

/**
 * Structural layer analysis result
 */
export interface StructuralAnalysis {
  modulePath: string;
  symbols: ExtractedSymbol[];
  imports: ImportRelation[];
  exports: string[];
  complexity: {
    cyclomaticComplexity: number;
    linesOfCode: number;
    functionCount: number;
    classCount: number;
  };
}

/**
 * Pattern detection result
 */
export interface DetectedPattern {
  name: string;
  type: "architectural" | "design" | "anti-pattern";
  confidence: number;
  locations: string[];
  description: string;
}

/**
 * Semantic layer analysis result
 */
export interface SemanticAnalysis {
  architectureType: string;
  patterns: DetectedPattern[];
  dataModels: DataModel[];
  apiEndpoints: ApiEndpoint[];
  crossFileRelationships: {
    from: string;
    to: string;
    relationship: string;
  }[];
  insights: string[];
}

// ============================================================================
// Orchestrator types
// ============================================================================

/**
 * Sub-agent task definition
 */
export interface SubAgentTask {
  id: string;
  type: "surface" | "structural" | "semantic";
  target: string;
  status: "pending" | "running" | "completed" | "failed";
  startTime?: number;
  endTime?: number;
  result?: unknown;
  error?: string;
}

/**
 * Orchestrator state for tracking analysis progress
 */
export interface OrchestratorState {
  analysisId: string;
  startTime: number;
  phase: "surface" | "structural" | "semantic" | "synthesis" | "complete";
  tasks: SubAgentTask[];
  tokenBudget: number;
  tokensUsed: number;
}

// ============================================================================
// Cache types
// ============================================================================

/**
 * Cache entry for analysis results
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  metadata: {
    source: string;
    commitHash?: string;
    depth: AnalysisDepth;
  };
}

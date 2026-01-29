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

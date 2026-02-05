/**
 * MCP Tools Index
 *
 * Exports all tool implementations for the MCP server.
 */

export {
  getCapabilitiesSchema,
  getCapabilities,
  formatCapabilitiesResponse,
  type CapabilitiesResponse,
} from "./capabilities.js";

export {
  analyzeRepoSchema,
  executeAnalyzeRepo,
  type AnalyzeRepoInput,
} from "./analyze.js";

export {
  expandSectionSchema,
  executeExpandSection,
  type ExpandSectionInput,
} from "./expand.js";

export {
  findPatternsSchema,
  executeFindPatterns,
  DETECTABLE_PATTERNS,
  type FindPatternsInput,
  type PatternType,
} from "./patterns.js";

export {
  traceDataflowSchema,
  executeTraceDataflow,
  type TraceDataflowInput,
} from "./dataflow.js";

export {
  readFilesSchema,
  executeReadFiles,
  type ReadFilesInput,
} from "./read-files.js";

export {
  queryRepoSchema,
  executeQueryRepo,
  type QueryRepoInput,
} from "./query.js";

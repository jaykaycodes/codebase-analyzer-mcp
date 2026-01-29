/**
 * Analysis Layers
 *
 * Multi-layer analysis architecture:
 * - Surface: Fast file enumeration and language detection (no LLM cost)
 * - Structural: Tree-sitter AST analysis (low LLM cost)
 * - Semantic: Deep Gemini analysis (high LLM cost)
 */

export { surfaceAnalysis, readReadmeContent } from "./surface.js";
export {
  structuralAnalysis,
  analyzeModulesStructurally,
  loadModuleFiles,
} from "./structural.js";
export { semanticAnalysis, quickSemanticHints } from "./semantic.js";

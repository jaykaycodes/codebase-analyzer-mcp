/**
 * Structural Layer Analysis
 *
 * Uses Tree-sitter (WASM) for AST parsing to extract:
 * - Symbols (functions, classes, types, interfaces)
 * - Import/export relationships
 * - Complexity metrics
 *
 * Falls back to regex-based extraction when grammar unavailable.
 */

import { readFile } from "fs/promises";
import { extname } from "path";
import type {
  ExtractedSymbol,
  ImportRelation,
  ModuleIdentification,
  StructuralAnalysis,
} from "../../types.js";

// Tree-sitter will be lazily initialized
import type { Parser as ParserType, Language } from "web-tree-sitter";
let ParserClass: typeof ParserType | null = null;
let parserInstance: ParserType | null = null;
const loadedLanguages = new Map<string, Language>();

// Language configuration
interface LanguageConfig {
  wasmUrl?: string;
  extensions: string[];
  symbolQueries: {
    functions?: string;
    classes?: string;
    interfaces?: string;
    types?: string;
    variables?: string;
  };
  importPattern?: RegExp;
  exportPattern?: RegExp;
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    extensions: [".ts", ".tsx"],
    symbolQueries: {
      functions: "(function_declaration name: (identifier) @name)",
      classes: "(class_declaration name: (type_identifier) @name)",
      interfaces: "(interface_declaration name: (type_identifier) @name)",
      types: "(type_alias_declaration name: (type_identifier) @name)",
    },
    importPattern: /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g,
    exportPattern: /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/g,
  },
  javascript: {
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    symbolQueries: {
      functions: "(function_declaration name: (identifier) @name)",
      classes: "(class_declaration name: (identifier) @name)",
    },
    importPattern: /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g,
    exportPattern: /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
  },
  python: {
    extensions: [".py", ".pyi"],
    symbolQueries: {
      functions: "(function_definition name: (identifier) @name)",
      classes: "(class_definition name: (identifier) @name)",
    },
    importPattern: /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g,
    exportPattern: /__all__\s*=\s*\[([^\]]+)\]/,
  },
  go: {
    extensions: [".go"],
    symbolQueries: {
      functions: "(function_declaration name: (identifier) @name)",
      types: "(type_declaration (type_spec name: (type_identifier) @name))",
    },
    importPattern: /import\s+(?:\(([^)]+)\)|"([^"]+)")/g,
  },
  rust: {
    extensions: [".rs"],
    symbolQueries: {
      functions: "(function_item name: (identifier) @name)",
      types: "(struct_item name: (type_identifier) @name)",
    },
    importPattern: /use\s+([^;]+);/g,
  },
  java: {
    extensions: [".java"],
    symbolQueries: {
      functions: "(method_declaration name: (identifier) @name)",
      classes: "(class_declaration name: (identifier) @name)",
      interfaces: "(interface_declaration name: (identifier) @name)",
    },
    importPattern: /import\s+(?:static\s+)?([^;]+);/g,
  },
  ruby: {
    extensions: [".rb", ".rake"],
    symbolQueries: {
      functions: "(method name: (identifier) @name)",
      classes: "(class name: (constant) @name)",
    },
    importPattern: /require(?:_relative)?\s+['"]([^'"]+)['"]/g,
  },
};

/**
 * Initialize Tree-sitter parser (lazy)
 */
async function initParser(): Promise<ParserType> {
  if (parserInstance) return parserInstance;

  if (!ParserClass) {
    const module = await import("web-tree-sitter");
    ParserClass = module.Parser;
    await ParserClass.init();
  }

  parserInstance = new ParserClass();
  return parserInstance;
}

/**
 * Get language configuration for a file extension
 */
function getLanguageConfig(ext: string): LanguageConfig | null {
  for (const [, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext.toLowerCase())) {
      return config;
    }
  }
  return null;
}

/**
 * Get language name for a file extension
 */
function getLanguageName(ext: string): string | null {
  for (const [name, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext.toLowerCase())) {
      return name;
    }
  }
  return null;
}

/**
 * Perform structural analysis on a module
 */
export async function structuralAnalysis(
  module: ModuleIdentification,
  files: Array<{ path: string; content: string }>
): Promise<StructuralAnalysis> {
  const symbols: ExtractedSymbol[] = [];
  const imports: ImportRelation[] = [];
  const exports: string[] = [];
  let totalLoc = 0;
  let totalFunctions = 0;
  let totalClasses = 0;

  for (const file of files) {
    const ext = extname(file.path).toLowerCase();

    // Handle Markdown files
    if (ext === ".md" || ext === ".mdx") {
      const mdSymbols = analyzeMarkdownFile(file.path, file.content);
      symbols.push(...mdSymbols);
      const lines = file.content.split("\n");
      totalLoc += lines.filter((l) => l.trim()).length;
      continue;
    }

    // Handle Shell files
    if (ext === ".sh" || ext === ".bash" || ext === ".zsh") {
      const shAnalysis = analyzeShellFile(file.path, file.content);
      symbols.push(...shAnalysis.symbols);
      imports.push(...shAnalysis.imports);
      const lines = file.content.split("\n");
      totalLoc += lines.filter((l) => l.trim() && !l.trim().startsWith("#")).length;
      totalFunctions += shAnalysis.symbols.filter((s) => s.type === "function").length;
      continue;
    }

    const config = getLanguageConfig(ext);

    if (!config) {
      // Skip files without language support
      continue;
    }

    // Extract using regex (more reliable than WASM loading in MCP context)
    const fileAnalysis = await analyzeFileWithRegex(file.path, file.content, config);

    symbols.push(...fileAnalysis.symbols);
    imports.push(...fileAnalysis.imports);
    exports.push(...fileAnalysis.exports);

    // Count metrics
    const lines = file.content.split("\n");
    totalLoc += lines.filter((l) => l.trim() && !l.trim().startsWith("//")).length;
    totalFunctions += fileAnalysis.symbols.filter(
      (s) => s.type === "function" || s.type === "method"
    ).length;
    totalClasses += fileAnalysis.symbols.filter((s) => s.type === "class").length;
  }

  // Estimate cyclomatic complexity based on code patterns
  const cyclomaticComplexity = estimateCyclomaticComplexity(
    files.map((f) => f.content).join("\n")
  );

  return {
    modulePath: module.path,
    symbols,
    imports,
    exports,
    complexity: {
      cyclomaticComplexity,
      linesOfCode: totalLoc,
      functionCount: totalFunctions,
      classCount: totalClasses,
    },
  };
}

/**
 * Analyze a single file using regex patterns
 */
async function analyzeFileWithRegex(
  filePath: string,
  content: string,
  config: LanguageConfig
): Promise<{
  symbols: ExtractedSymbol[];
  imports: ImportRelation[];
  exports: string[];
}> {
  const symbols: ExtractedSymbol[] = [];
  const imports: ImportRelation[] = [];
  const exports: string[] = [];
  const lines = content.split("\n");

  // Extract symbols using regex patterns
  const functionPattern = /(?:export\s+)?(?:async\s+)?(?:function|def|func|fn)\s+(\w+)/g;
  const classPattern = /(?:export\s+)?class\s+(\w+)/g;
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)/g;
  const typePattern = /(?:export\s+)?type\s+(\w+)/g;
  const constPattern = /(?:export\s+)?const\s+(\w+)\s*=/g;

  // Functions
  let match;
  while ((match = functionPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    symbols.push({
      name: match[1],
      type: "function",
      file: filePath,
      line,
      exported: match[0].startsWith("export"),
    });
  }

  // Classes
  while ((match = classPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    symbols.push({
      name: match[1],
      type: "class",
      file: filePath,
      line,
      exported: match[0].startsWith("export"),
    });
  }

  // Interfaces (TypeScript)
  while ((match = interfacePattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    symbols.push({
      name: match[1],
      type: "interface",
      file: filePath,
      line,
      exported: match[0].startsWith("export"),
    });
  }

  // Types (TypeScript)
  while ((match = typePattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    symbols.push({
      name: match[1],
      type: "type",
      file: filePath,
      line,
      exported: match[0].startsWith("export"),
    });
  }

  // Constants
  while ((match = constPattern.exec(content)) !== null) {
    const line = getLineNumber(content, match.index);
    // Only include exported constants or uppercase (likely important)
    if (match[0].startsWith("export") || match[1] === match[1].toUpperCase()) {
      symbols.push({
        name: match[1],
        type: "constant",
        file: filePath,
        line,
        exported: match[0].startsWith("export"),
      });
    }
  }

  // Extract imports
  if (config.importPattern) {
    const importRegex = new RegExp(config.importPattern.source, "g");
    while ((match = importRegex.exec(content)) !== null) {
      const importedNames: string[] = [];
      let modulePath = "";
      let isDefault = false;

      // Parse import statement based on language
      if (filePath.match(/\.(ts|tsx|js|jsx|mjs|cjs)$/)) {
        // JavaScript/TypeScript imports
        const namedImports = match[1];
        const defaultImport = match[2];
        modulePath = match[3] || "";

        if (namedImports) {
          importedNames.push(
            ...namedImports.split(",").map((s) => s.trim().split(" as ")[0].trim())
          );
        }
        if (defaultImport) {
          importedNames.push(defaultImport);
          isDefault = true;
        }
      } else if (filePath.endsWith(".py")) {
        // Python imports
        const fromModule = match[1] || "";
        const importList = match[2] || "";
        modulePath = fromModule || importList.split(",")[0]?.trim() || "";
        importedNames.push(
          ...importList.split(",").map((s) => s.trim().split(" as ")[0].trim())
        );
      } else {
        // Generic import
        modulePath = match[1] || match[0];
      }

      if (modulePath) {
        imports.push({
          from: filePath,
          to: modulePath,
          importedNames,
          isDefault,
          isType: match[0].includes("type "),
        });
      }
    }
  }

  // Extract exports
  if (config.exportPattern) {
    const exportRegex = new RegExp(config.exportPattern.source, "g");
    while ((match = exportRegex.exec(content)) !== null) {
      if (match[1]) {
        exports.push(match[1]);
      }
    }
  }

  // Also get exports from symbols
  for (const symbol of symbols) {
    if (symbol.exported && !exports.includes(symbol.name)) {
      exports.push(symbol.name);
    }
  }

  return { symbols, imports, exports };
}

/**
 * Analyze a Markdown file to extract headings, frontmatter, and cross-references
 */
function analyzeMarkdownFile(
  filePath: string,
  content: string
): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const lines = content.split("\n");

  // Extract YAML frontmatter keys
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") break;
      const keyMatch = lines[i].match(/^(\w[\w-]*):\s/);
      if (keyMatch) {
        symbols.push({
          name: `frontmatter:${keyMatch[1]}`,
          type: "variable",
          file: filePath,
          line: i + 1,
          exported: false,
        });
      }
    }
  }

  // Extract headings (H1 and H2 become symbols)
  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,2})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      symbols.push({
        name: headingMatch[2].trim(),
        type: level === 1 ? "class" : "function",
        file: filePath,
        line: i + 1,
        exported: false,
      });
    }
  }

  return symbols;
}

/**
 * Analyze a Shell script to extract functions, constants, and source imports
 */
function analyzeShellFile(
  filePath: string,
  content: string
): { symbols: ExtractedSymbol[]; imports: ImportRelation[] } {
  const symbols: ExtractedSymbol[] = [];
  const imports: ImportRelation[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Function definitions: "function name {" or "name() {"
    const funcMatch = line.match(/^(?:function\s+)?(\w+)\s*\(\)\s*\{/) ||
      line.match(/^function\s+(\w+)\s*\{/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        type: "function",
        file: filePath,
        line: i + 1,
        exported: false,
      });
      continue;
    }

    // Uppercase variable assignments (likely constants)
    const constMatch = line.match(/^([A-Z][A-Z0-9_]+)=/);
    if (constMatch) {
      symbols.push({
        name: constMatch[1],
        type: "constant",
        file: filePath,
        line: i + 1,
        exported: false,
      });
      continue;
    }

    // Source imports: source "file" / . "file"
    const sourceMatch = line.match(/^(?:source|\.) +["']?([^"'\s]+)["']?/);
    if (sourceMatch) {
      imports.push({
        from: filePath,
        to: sourceMatch[1],
        importedNames: [],
        isDefault: false,
        isType: false,
      });
    }
  }

  return { symbols, imports };
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/**
 * Estimate cyclomatic complexity from code content
 */
function estimateCyclomaticComplexity(content: string): number {
  let complexity = 1; // Base complexity

  // Count decision points
  const patterns = [
    /\bif\b/g,
    /\belse\s+if\b/g,
    /\bwhile\b/g,
    /\bfor\b/g,
    /\bcase\b/g,
    /\bcatch\b/g,
    /\?\s*[^:]/g, // Ternary operators
    /&&/g,
    /\|\|/g,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Analyze multiple modules in parallel
 */
export async function analyzeModulesStructurally(
  modules: ModuleIdentification[],
  repoPath: string,
  fileContents: Map<string, string>
): Promise<StructuralAnalysis[]> {
  const results: StructuralAnalysis[] = [];

  // Process modules in parallel batches
  const BATCH_SIZE = 5;
  for (let i = 0; i < modules.length; i += BATCH_SIZE) {
    const batch = modules.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (module) => {
        // Get files for this module
        const moduleFiles: Array<{ path: string; content: string }> = [];

        for (const [filePath, content] of fileContents.entries()) {
          if (filePath.startsWith(module.path + "/") || filePath === module.path) {
            moduleFiles.push({ path: filePath, content });
          }
        }

        if (moduleFiles.length === 0) {
          return null;
        }

        try {
          return await structuralAnalysis(module, moduleFiles);
        } catch (error) {
          console.error(`Structural analysis failed for ${module.path}:`, error);
          return null;
        }
      })
    );

    results.push(...(batchResults.filter(Boolean) as StructuralAnalysis[]));
  }

  return results;
}

/**
 * Load file contents for a module
 */
export async function loadModuleFiles(
  repoPath: string,
  filePaths: string[]
): Promise<Map<string, string>> {
  const contents = new Map<string, string>();
  const MAX_FILE_SIZE = 100000; // 100KB limit per file

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf-8");
        if (content.length <= MAX_FILE_SIZE) {
          contents.set(filePath, content);
        }
      } catch {
        // Skip files that can't be read
      }
    })
  );

  return contents;
}

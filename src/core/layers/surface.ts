/**
 * Surface Layer Analysis
 *
 * Fast, zero-LLM-cost analysis that provides:
 * - File enumeration and language detection
 * - README/documentation extraction
 * - Entry point identification
 * - Complexity estimation
 *
 * Target: Complete in <2s for repos up to 10k files
 */

import { glob } from "glob";
import { readFile, stat } from "fs/promises";
import { basename, dirname, extname, join, relative } from "path";
import type {
  DirectoryNode,
  LanguageBreakdown,
  ModuleIdentification,
  RepositoryMap,
  SurfaceAnalysis,
} from "../../types.js";
import {
  getDefaultIgnorePatterns,
  isPriorityDirectory,
  isPriorityFile,
} from "../file-filter.js";

// Language detection by extension
const LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".pyi": "Python",
  ".rb": "Ruby",
  ".rake": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".swift": "Swift",
  ".m": "Objective-C",
  ".h": "C/C++",
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".hpp": "C++",
  ".cs": "C#",
  ".php": "PHP",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".sql": "SQL",
  ".prisma": "Prisma",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
};

// Entry point patterns by ecosystem
const ENTRY_POINT_PATTERNS = [
  // JavaScript/TypeScript
  "src/index.ts",
  "src/index.js",
  "src/main.ts",
  "src/main.js",
  "index.ts",
  "index.js",
  "main.ts",
  "main.js",
  "app.ts",
  "app.js",
  "server.ts",
  "server.js",
  // Python
  "main.py",
  "__main__.py",
  "app.py",
  "wsgi.py",
  "asgi.py",
  "manage.py",
  // Go
  "main.go",
  "cmd/*/main.go",
  // Rust
  "src/main.rs",
  "src/lib.rs",
  // Ruby
  "config.ru",
  "bin/rails",
  // Java
  "**/Main.java",
  "**/Application.java",
];

// Module type patterns
const MODULE_TYPE_PATTERNS: Record<string, RegExp[]> = {
  core: [/^src\/core/, /^src\/lib/, /^lib\//, /^pkg\//, /^internal\//],
  util: [/utils?\//, /helpers?\//, /common\//, /shared\//],
  test: [/tests?\//, /specs?\//, /__tests__\//, /\.test\./, /\.spec\./],
  config: [/config\//, /\.config\./, /settings\//],
};

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  language: string;
  extension: string;
}

/**
 * Perform surface-level analysis of a repository
 */
export async function surfaceAnalysis(
  repoPath: string,
  options: { exclude?: string[]; sourceName?: string } = {}
): Promise<SurfaceAnalysis> {
  const startTime = Date.now();

  // Get all files
  const ignorePatterns = [...getDefaultIgnorePatterns(), ...(options.exclude || [])];
  const files = await glob("**/*", {
    cwd: repoPath,
    nodir: true,
    ignore: ignorePatterns,
    absolute: false,
  });

  // Gather file info in parallel (batched for performance)
  const fileInfos = await gatherFileInfo(repoPath, files);

  // Build repository map
  const repositoryMap = buildRepositoryMap(repoPath, fileInfos, options.sourceName);

  // Identify modules
  const identifiedModules = identifyModules(fileInfos);

  // Calculate complexity score
  const complexity = calculateComplexity(fileInfos, identifiedModules);

  // Estimate analysis times
  const estimatedAnalysisTime = estimateAnalysisTimes(fileInfos, complexity);

  const duration = Date.now() - startTime;
  console.error(`Surface analysis completed in ${duration}ms for ${files.length} files`);

  return {
    repositoryMap,
    identifiedModules,
    complexity,
    estimatedAnalysisTime,
  };
}

/**
 * Gather file information in parallel batches
 */
async function gatherFileInfo(repoPath: string, files: string[]): Promise<FileInfo[]> {
  const BATCH_SIZE = 100;
  const results: FileInfo[] = [];

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (relativePath) => {
        try {
          const fullPath = join(repoPath, relativePath);
          const stats = await stat(fullPath);
          const ext = extname(relativePath).toLowerCase();
          const language = LANGUAGE_MAP[ext] || "Other";

          return {
            path: fullPath,
            relativePath,
            size: stats.size,
            language,
            extension: ext,
          };
        } catch {
          return null;
        }
      })
    );

    results.push(...(batchResults.filter(Boolean) as FileInfo[]));
  }

  return results;
}

/**
 * Build repository map from file info
 */
function buildRepositoryMap(repoPath: string, files: FileInfo[], sourceName?: string): RepositoryMap {
  // Use provided source name, or extract from path
  const name = sourceName || basename(repoPath);

  // Language breakdown
  const languageCounts = new Map<string, { count: number; extensions: Set<string> }>();
  for (const file of files) {
    if (file.language !== "Other") {
      const existing = languageCounts.get(file.language) || {
        count: 0,
        extensions: new Set(),
      };
      existing.count++;
      existing.extensions.add(file.extension);
      languageCounts.set(file.language, existing);
    }
  }

  const totalCodeFiles = Array.from(languageCounts.values()).reduce(
    (sum, v) => sum + v.count,
    0
  );
  const languages: LanguageBreakdown[] = Array.from(languageCounts.entries())
    .map(([language, data]) => ({
      language,
      fileCount: data.count,
      percentage: Math.round((data.count / totalCodeFiles) * 100),
      extensions: Array.from(data.extensions),
    }))
    .sort((a, b) => b.fileCount - a.fileCount);

  // Total size and estimated tokens
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const estimatedTokens = Math.ceil(totalSize / 4); // ~4 chars per token

  // Find entry points
  const entryPoints = findEntryPoints(files);

  // Build directory structure
  const structure = buildDirectoryTree(files);

  // Extract README
  const readme = extractReadme(repoPath, files);

  return {
    name,
    languages,
    fileCount: files.length,
    totalSize,
    estimatedTokens,
    entryPoints,
    structure,
    readme,
  };
}

/**
 * Find entry point files
 */
function findEntryPoints(files: FileInfo[]): string[] {
  const entryPoints: string[] = [];

  for (const file of files) {
    // Check against entry point patterns
    for (const pattern of ENTRY_POINT_PATTERNS) {
      if (pattern.includes("*")) {
        // Simple glob match
        const regex = new RegExp(
          "^" + pattern.replace(/\*/g, "[^/]+").replace(/\//g, "\\/") + "$"
        );
        if (regex.test(file.relativePath)) {
          entryPoints.push(file.relativePath);
          break;
        }
      } else if (
        file.relativePath === pattern ||
        file.relativePath.endsWith("/" + pattern)
      ) {
        entryPoints.push(file.relativePath);
        break;
      }
    }
  }

  // Also check for package.json main/bin fields (detected later in structural)
  return [...new Set(entryPoints)].slice(0, 10); // Limit to 10 entry points
}

/**
 * Build directory tree from files
 */
function buildDirectoryTree(files: FileInfo[]): DirectoryNode {
  const root: DirectoryNode = {
    name: ".",
    type: "directory",
    children: [],
  };

  // Build tree from file paths
  for (const file of files) {
    const parts = file.relativePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        current.children = current.children || [];
        current.children.push({
          name: part,
          type: "file",
          language: file.language,
          size: file.size,
        });
      } else {
        current.children = current.children || [];
        let child = current.children.find(
          (c) => c.name === part && c.type === "directory"
        );
        if (!child) {
          child = { name: part, type: "directory", children: [] };
          current.children.push(child);
        }
        current = child;
      }
    }
  }

  // Sort children: directories first, then files, alphabetically
  const sortChildren = (node: DirectoryNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  // Collapse single-child directories for cleaner view
  const collapseTree = (node: DirectoryNode): DirectoryNode => {
    if (node.children) {
      node.children = node.children.map(collapseTree);

      // If this directory has only one child directory, merge them
      while (
        node.children &&
        node.children.length === 1 &&
        node.children[0].type === "directory" &&
        node.name !== "."
      ) {
        const child: DirectoryNode = node.children[0];
        node.name = `${node.name}/${child.name}`;
        node.children = child.children;
      }
    }
    return node;
  };

  return collapseTree(root);
}

/**
 * Extract README content
 */
function extractReadme(repoPath: string, files: FileInfo[]): string | undefined {
  const readmeFile = files.find(
    (f) =>
      f.relativePath.toLowerCase() === "readme.md" ||
      f.relativePath.toLowerCase() === "readme"
  );

  if (readmeFile && readmeFile.size < 50000) {
    // Don't read huge READMEs synchronously
    try {
      // This will be read async in the actual implementation
      // For now, we just note it exists
      return `README found at ${readmeFile.relativePath}`;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Identify modules/packages in the repository
 */
function identifyModules(files: FileInfo[]): ModuleIdentification[] {
  const modules = new Map<
    string,
    {
      files: FileInfo[];
      type: "core" | "util" | "test" | "config" | "unknown";
    }
  >();

  for (const file of files) {
    // Get the top-level directory
    const parts = file.relativePath.split("/");
    if (parts.length < 2) continue;

    const modulePath = parts[0];

    // Determine module type
    let moduleType: "core" | "util" | "test" | "config" | "unknown" = "unknown";
    for (const [type, patterns] of Object.entries(MODULE_TYPE_PATTERNS)) {
      if (patterns.some((p) => p.test(file.relativePath))) {
        moduleType = type as typeof moduleType;
        break;
      }
    }

    // Priority directories are core
    if (isPriorityDirectory(modulePath)) {
      moduleType = "core";
    }

    const existing = modules.get(modulePath) || { files: [], type: moduleType };
    existing.files.push(file);
    if (moduleType !== "unknown" && existing.type === "unknown") {
      existing.type = moduleType;
    }
    modules.set(modulePath, existing);
  }

  // Convert to array and calculate stats
  return Array.from(modules.entries())
    .map(([path, data]) => {
      const languageCounts = new Map<string, number>();
      for (const file of data.files) {
        languageCounts.set(
          file.language,
          (languageCounts.get(file.language) || 0) + 1
        );
      }

      const primaryLanguage =
        Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ||
        "Unknown";

      return {
        path,
        name: path,
        type: data.type,
        fileCount: data.files.length,
        primaryLanguage,
      };
    })
    .filter((m) => m.fileCount > 0)
    .sort((a, b) => {
      // Sort by type priority then file count
      const typePriority = { core: 0, util: 1, config: 2, unknown: 3, test: 4 };
      const typeOrder =
        typePriority[a.type] - typePriority[b.type];
      if (typeOrder !== 0) return typeOrder;
      return b.fileCount - a.fileCount;
    });
}

/**
 * Calculate overall complexity score (0-100)
 */
function calculateComplexity(
  files: FileInfo[],
  modules: ModuleIdentification[]
): number {
  let score = 0;

  // File count factor (up to 30 points)
  const fileCountScore = Math.min(30, files.length / 100);
  score += fileCountScore;

  // Module count factor (up to 20 points)
  const moduleScore = Math.min(20, modules.length * 2);
  score += moduleScore;

  // Language diversity (up to 20 points)
  const languages = new Set(files.map((f) => f.language));
  const langScore = Math.min(20, languages.size * 4);
  score += langScore;

  // Average file size (up to 15 points)
  const avgSize = files.reduce((sum, f) => sum + f.size, 0) / files.length;
  const sizeScore = Math.min(15, avgSize / 1000);
  score += sizeScore;

  // Nesting depth (up to 15 points)
  const maxDepth = Math.max(...files.map((f) => f.relativePath.split("/").length));
  const depthScore = Math.min(15, maxDepth * 2);
  score += depthScore;

  return Math.round(Math.min(100, score));
}

/**
 * Estimate analysis times based on repository characteristics
 */
function estimateAnalysisTimes(
  files: FileInfo[],
  complexity: number
): { structural: number; semantic: number } {
  // Base times in milliseconds
  const baseStructural = 1000;
  const baseSemantic = 5000;

  // Scale by file count (structural is mostly local processing)
  const structuralTime = baseStructural + files.length * 10;

  // Semantic time scales with complexity and file count
  const semanticTime =
    baseSemantic + files.length * 50 + complexity * 100;

  return {
    structural: Math.round(structuralTime),
    semantic: Math.round(semanticTime),
  };
}

/**
 * Read README content asynchronously
 */
export async function readReadmeContent(
  repoPath: string,
  files: FileInfo[]
): Promise<string | undefined> {
  const readmeFile = files.find(
    (f) =>
      f.relativePath.toLowerCase() === "readme.md" ||
      f.relativePath.toLowerCase() === "readme"
  );

  if (readmeFile && readmeFile.size < 50000) {
    try {
      const content = await readFile(join(repoPath, readmeFile.relativePath), "utf-8");
      return content;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

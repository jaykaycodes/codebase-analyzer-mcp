const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/coverage/**",
  "**/__pycache__/**",
  "**/.pytest_cache/**",
  "**/venv/**",
  "**/.venv/**",
  "**/vendor/**",
  "**/*.min.js",
  "**/*.min.css",
  "**/*.map",
  "**/*.lock",
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/Cargo.lock",
  "**/Gemfile.lock",
  "**/poetry.lock",
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.ico",
  "**/*.svg",
  "**/*.woff",
  "**/*.woff2",
  "**/*.ttf",
  "**/*.eot",
  "**/*.mp3",
  "**/*.mp4",
  "**/*.webm",
  "**/*.pdf",
  "**/*.zip",
  "**/*.tar",
  "**/*.gz",
  "**/*.exe",
  "**/*.dll",
  "**/*.so",
  "**/*.dylib",
  "**/.DS_Store",
  "**/Thumbs.db",
];

const DEFAULT_INCLUDE_EXTENSIONS = [
  // JavaScript/TypeScript
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  // Python
  ".py",
  ".pyi",
  // Ruby
  ".rb",
  ".rake",
  ".gemspec",
  // Go
  ".go",
  // Rust
  ".rs",
  // Swift/Objective-C
  ".swift",
  ".m",
  ".h",
  // Java/Kotlin
  ".java",
  ".kt",
  ".kts",
  // C/C++
  ".c",
  ".cpp",
  ".cc",
  ".hpp",
  // Shell
  ".sh",
  ".bash",
  ".zsh",
  // Config/Data
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".env.example",
  // Markup/Docs
  ".md",
  ".mdx",
  ".rst",
  // Web
  ".html",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".vue",
  ".svelte",
  // Database
  ".sql",
  ".prisma",
  // Config files (no extension)
  "Dockerfile",
  "Makefile",
  "Rakefile",
  "Gemfile",
  "Procfile",
];

const PRIORITY_FILES = [
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "setup.py",
  "Cargo.toml",
  "go.mod",
  "Gemfile",
  "build.gradle",
  "pom.xml",
  "README.md",
  "README",
  ".env.example",
  "docker-compose.yml",
  "docker-compose.yaml",
];

const PRIORITY_DIRECTORIES = [
  "src",
  "lib",
  "app",
  "pages",
  "components",
  "api",
  "routes",
  "controllers",
  "models",
  "services",
  "utils",
  "helpers",
  "core",
  "pkg",
  "internal",
  "cmd",
];

export function getDefaultIgnorePatterns(): string[] {
  return [...DEFAULT_IGNORE_PATTERNS];
}

export function getDefaultIncludeExtensions(): string[] {
  return [...DEFAULT_INCLUDE_EXTENSIONS];
}

export function isPriorityFile(filename: string): boolean {
  return PRIORITY_FILES.some(
    (pf) => filename === pf || filename.endsWith(`/${pf}`)
  );
}

export function isPriorityDirectory(dirPath: string): boolean {
  const parts = dirPath.split("/");
  return parts.some((part) => PRIORITY_DIRECTORIES.includes(part));
}

export function shouldIncludeFile(
  filePath: string,
  customInclude?: string[],
  customExclude?: string[]
): boolean {
  const filename = filePath.split("/").pop() || "";
  const ext = filename.includes(".") ? `.${filename.split(".").pop()}` : "";

  const excludePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...(customExclude || []),
  ];
  for (const pattern of excludePatterns) {
    if (matchGlobPattern(filePath, pattern)) {
      return false;
    }
  }

  if (customInclude && customInclude.length > 0) {
    return customInclude.some((pattern) => matchGlobPattern(filePath, pattern));
  }

  if (PRIORITY_FILES.includes(filename)) {
    return true;
  }

  return DEFAULT_INCLUDE_EXTENSIONS.includes(ext);
}

function matchGlobPattern(path: string, pattern: string): boolean {
  const regexPattern = pattern
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/{{GLOBSTAR}}/g, ".*")
    .replace(/\./g, "\\.");

  const regex = new RegExp(`^${regexPattern}$|/${regexPattern}$|^${regexPattern}/|/${regexPattern}/`);
  return regex.test(path);
}

export function prioritizeFiles(
  files: Array<{ path: string; size: number }>
): Array<{ path: string; size: number; priority: number }> {
  return files
    .map((file) => {
      let priority = 0;

      if (isPriorityFile(file.path)) {
        priority += 100;
      }

      if (isPriorityDirectory(file.path)) {
        priority += 50;
      }

      const depth = file.path.split("/").length;
      priority -= depth * 2;

      if (file.path.includes("test") || file.path.includes("spec")) {
        priority -= 30;
      }

      if (file.path.includes("example") || file.path.includes("demo")) {
        priority -= 20;
      }

      return { ...file, priority };
    })
    .sort((a, b) => b.priority - a.priority);
}

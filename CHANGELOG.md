# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v1.0.0.html).

## [1.0.0] - 2026-01-29

Initial release.

### Features

- **Multi-layer analysis architecture**
  - Surface layer: Fast file enumeration, language detection, entry points (no LLM cost)
  - Structural layer: Tree-sitter parsing, symbol extraction, import mapping (no LLM cost)
  - Semantic layer: Gemini-powered architecture detection and pattern recognition (opt-in)

- **Progressive disclosure**
  - Expandable sections with cost estimates
  - `expand_section` tool to drill into specific areas
  - Token budget tracking and warnings

- **MCP tools**
  - `analyze_repo` - Full analysis with progressive disclosure
  - `expand_section` - Drill into sections from previous analysis
  - `find_patterns` - Detect design and architecture patterns
  - `trace_dataflow` - Trace data flow through the system
  - `get_analysis_capabilities` - List available options

- **Claude plugin**
  - 4 agents: architecture-analyzer, pattern-detective, dataflow-tracer, codebase-explorer
  - 5 commands: /analyze, /patterns, /trace, /explore, /compare
  - 3 skills: codebase-analysis, add-mcp-tool, debugging-analysis

- **CLI**
  - Standalone binary (no Node/Bun required)
  - `--mcp` flag to run as MCP server
  - Verbose mode with spinner and progress output
  - Quiet mode for scripting
  - Markdown output format option

- **Distribution**
  - npm package with `cba` and `codebase-analyzer` CLI commands
  - Standalone binaries for macOS (arm64, x64), Linux (x64, arm64), Windows (x64)

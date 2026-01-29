# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-28

### Added

- **Multi-layer analysis architecture**
  - Surface layer: Fast file enumeration, language detection, entry points (no LLM cost)
  - Structural layer: Tree-sitter parsing, symbol extraction, import mapping (no LLM cost)
  - Semantic layer: Gemini-powered architecture detection and pattern recognition (opt-in)

- **Progressive disclosure**
  - Expandable sections with cost estimates
  - `expand_section` tool to drill into specific areas
  - Token budget tracking and warnings

- **New MCP tools**
  - `analyze_repo` - Full analysis with progressive disclosure
  - `expand_section` - Drill into sections from previous analysis
  - `find_patterns` - Detect design and architecture patterns
  - `trace_dataflow` - Trace data flow through the system
  - `get_analysis_capabilities` - List available options

- **Claude plugin structure**
  - 4 agents: architecture-analyzer, pattern-detective, dataflow-tracer, codebase-explorer
  - 5 commands: /analyze, /patterns, /trace, /explore, /compare
  - 3 skills: codebase-analysis, add-mcp-tool, debugging-analysis

- **CLI improvements**
  - Verbose mode with spinner and progress output
  - Quiet mode for scripting
  - Markdown output format option

### Changed

- Complete rewrite from v1 monolithic analyzer to multi-layer architecture
- Analysis output now uses `AnalysisResultV2` format with sections
- GitHub URL analysis now shows repo name instead of temp directory

### Removed

- v1 tools: `extract_feature`, `query_repo` (replaced by patterns/dataflow)
- v1 analyzer with single Gemini call
- Direct Gemini analysis without layer separation

## [1.0.0] - 2026-01-27

### Added

- Initial release
- Gemini-powered codebase analysis
- MCP server with analyze_repo, extract_feature, query_repo, compare_repos tools
- CLI interface

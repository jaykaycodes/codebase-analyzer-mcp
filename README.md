# Codebase Analyzer MCP

An MCP server that uses Gemini's 1M+ token context to analyze codebases and produce agent-optimized output for informing feature development.

## Installation

```bash
npm install
npm run build
```

## Configuration

Set your Gemini API key:

```bash
export GEMINI_API_KEY=your_api_key_here
```

Get a key at https://aistudio.google.com/apikey

## MCP Server Usage

Add to your Claude Code MCP configuration (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "codebase-analyzer": {
      "command": "node",
      "args": ["/path/to/codebase-analyzer-mcp/dist/mcp/server.js"],
      "env": {
        "GEMINI_API_KEY": "your_api_key"
      }
    }
  }
}
```

### Available Tools

#### `analyze_repo`

Full architectural analysis of a repository.

```
source: string       - Local path or GitHub URL
focus?: string[]     - Optional areas to focus on
exclude?: string[]   - Patterns to exclude
```

#### `extract_feature`

Analyze how a specific feature is implemented.

```
source: string       - Local path or GitHub URL
feature: string      - Description of the feature
```

#### `query_repo`

Ask arbitrary questions about a codebase.

```
source: string       - Local path or GitHub URL
question: string     - The question to ask
```

#### `compare_repos`

Compare how multiple repos approach the same problem.

```
sources: string[]    - Multiple repo paths/URLs
aspect: string       - What to compare
```

## CLI Usage

```bash
# Full repo analysis
cba analyze ./path/to/repo
cba analyze https://github.com/user/repo

# Extract specific feature
cba feature ./repo "how user authentication works"

# Query repo
cba query ./repo "what database ORM is used and why"

# Compare repos
cba compare ./repo1 ./repo2 --aspect "state management"

# Output formats
cba analyze ./repo --format json      # Structured JSON (default)
cba analyze ./repo --format markdown  # Human-readable markdown
```

## Output Structure

The analyzer produces agent-optimized output including:

- **Architecture**: Overview, patterns, key decisions, data flow
- **Structure**: Entry points, core modules, dependencies
- **Models**: Data models, API endpoints
- **Patterns**: Conventions, state management, error handling, testing
- **For Agent**: Summary, key insights, replication guide

## Development

```bash
npm run dev    # Watch mode
npm run build  # Production build
```

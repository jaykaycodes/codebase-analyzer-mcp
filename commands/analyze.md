---
name: analyze
description: Analyze a codebase with progressive disclosure
user-invocable: true
---

# Analyze Codebase

Analyze a repository using multi-layer progressive disclosure.

## Usage

```
/analyze [source] [options]
```

**Arguments:**
- `source` - Local path or GitHub URL (default: current directory)

**Options:**
- `--depth surface|standard|deep` - Analysis depth (default: standard)
- `--focus <paths>` - Focus on specific modules
- `--semantics` - Include LLM-powered semantic analysis

## Examples

```bash
# Analyze current directory
/analyze

# Analyze with surface depth (fast)
/analyze --depth surface

# Analyze specific GitHub repo
/analyze https://github.com/user/repo

# Focus on specific module
/analyze --focus src/api

# Deep analysis with semantics
/analyze --depth deep --semantics
```

## Workflow

1. **Parse arguments** from user input
2. **Run analysis** using architecture-analyzer agent
3. **Present results** with expandable sections
4. **Offer drill-down** into specific areas

## Implementation

```javascript
// Extract source and options from args
const source = args.source || ".";
const depth = args.depth || "standard";
const focus = args.focus;
const semantics = args.semantics || false;

// Use architecture-analyzer agent
Task("architecture-analyzer", {
  prompt: `Analyze ${source} at ${depth} depth${focus ? `, focusing on ${focus}` : ""}${semantics ? " with semantic analysis" : ""}`
});
```

## Output

Returns structured analysis with:
- Repository map (languages, structure, entry points)
- Summary (architecture type, patterns, complexity)
- Expandable sections for deeper exploration
- Agent hints (insights, suggested next steps)

After analysis, offer to expand specific sections or run pattern detection.

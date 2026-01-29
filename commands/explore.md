---
name: explore
description: Quick exploration of a codebase structure
user-invocable: true
---

# Explore Codebase

Quick, lightweight exploration of a codebase - faster than full analysis.

## Usage

```
/explore [source] [question]
```

**Arguments:**
- `source` - Local path or GitHub URL (default: current directory)
- `question` - Optional specific question about the codebase

## Examples

```bash
# Quick overview of current directory
/explore

# Explore specific repo
/explore https://github.com/user/repo

# Ask specific question
/explore . "where is authentication handled?"

# Find specific functionality
/explore "how does email sending work?"
```

## Workflow

1. **Run surface analysis** (fast, no LLM cost)
2. **Answer question** if provided
3. **Present structure** and key files
4. **Suggest areas** to explore further

## Implementation

```javascript
const source = args.source || ".";
const question = args.question;

Task("codebase-explorer", {
  prompt: question
    ? `Explore ${source} and answer: ${question}`
    : `Give me a quick overview of ${source}`
});
```

## Output

Returns quick overview with:
- Tech stack and primary language
- Directory structure with purposes
- Key entry points
- Answer to specific question (if asked)
- Suggestions for deeper exploration

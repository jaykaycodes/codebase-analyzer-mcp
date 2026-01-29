---
name: patterns
description: Detect design and architecture patterns in a codebase
user-invocable: true
---

# Find Patterns

Detect design patterns, architectural patterns, and anti-patterns in a codebase.

## Usage

```
/patterns [source] [options]
```

**Arguments:**
- `source` - Local path or GitHub URL (default: current directory)

**Options:**
- `--types <patterns>` - Specific patterns to look for
- `--anti` - Focus on anti-patterns

## Available Patterns

**Design Patterns:**
- singleton, factory, observer, strategy, decorator
- adapter, facade, repository, dependency-injection

**Architectural Patterns:**
- event-driven, pub-sub, middleware, mvc, mvvm
- clean-architecture, hexagonal, cqrs, saga

## Examples

```bash
# Find all patterns in current directory
/patterns

# Look for specific patterns
/patterns --types singleton,factory,repository

# Find anti-patterns
/patterns --anti

# Analyze GitHub repo
/patterns https://github.com/user/repo
```

## Workflow

1. **Parse arguments** from user input
2. **Run detection** using pattern-detective agent
3. **Present findings** with confidence levels
4. **Map locations** for each pattern

## Implementation

```javascript
const source = args.source || ".";
const types = args.types?.split(",");
const antiPatterns = args.anti || false;

Task("pattern-detective", {
  prompt: `Find ${antiPatterns ? "anti-patterns" : "patterns"} in ${source}${types ? ` focusing on ${types.join(", ")}` : ""}`
});
```

## Output

Returns pattern analysis with:
- Detected patterns with confidence scores
- File locations for each pattern
- Anti-pattern warnings
- Recommendations for improvement

---
name: compare
description: Compare how multiple repositories approach the same problem
user-invocable: true
---

# Compare Repositories

Compare how different codebases approach the same problem or aspect.

## Usage

```
/compare <repos...> --aspect <aspect>
```

**Arguments:**
- `repos` - Two or more repository paths or URLs

**Options:**
- `--aspect <aspect>` - What to compare (required)

## Examples

```bash
# Compare authentication approaches
/compare ./app1 ./app2 --aspect authentication

# Compare state management
/compare https://github.com/user/repo1 https://github.com/user/repo2 --aspect "state management"

# Compare API design
/compare ./rest-api ./graphql-api --aspect "API design"

# Compare error handling
/compare ./project-a ./project-b ./project-c --aspect "error handling"
```

## Workflow

1. **Analyze each repo** at surface level
2. **Focus on aspect** specified
3. **Compare approaches** side by side
4. **Identify pros/cons** of each
5. **Provide recommendation**

## Implementation

```javascript
const repos = args.repos;
const aspect = args.aspect;

// Use MCP tool directly
mcp__codebase-analyzer__compare_repos({
  sources: repos,
  aspect: aspect
});
```

## Output

Returns comparison with:
- Approach summary for each repo
- Pros and cons
- Key files implementing the aspect
- Recommendation for best approach

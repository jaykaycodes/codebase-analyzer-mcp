---
name: debugging-analysis
description: This skill helps troubleshoot issues with codebase analysis - failed analyses, incorrect results, performance problems, and Gemini API errors. Use when analysis isn't working as expected.
---

# Debugging Analysis Issues

## Common Issues

### 1. Analysis Fails Immediately

**Symptom:** Error on startup, no analysis runs

**Check:**
```bash
# Verify build
pnpm build

# Check for TypeScript errors
pnpm tsc --noEmit

# Test CLI works
pnpm cba capabilities
```

**Common causes:**
- TypeScript compilation errors
- Missing dependencies (`pnpm install`)
- Syntax error in recent changes

### 2. Gemini API Errors

**Symptom:** Semantic analysis fails with API error

**Check:**
```bash
# Verify API key is set
echo $GEMINI_API_KEY

# Test with explicit key
GEMINI_API_KEY=your-key pnpm cba analyze . -d deep -s
```

**Common causes:**
- Missing `GEMINI_API_KEY` environment variable
- Invalid or expired API key
- Rate limiting (wait and retry)
- Network issues

**Fix:** Set API key:
```bash
export GEMINI_API_KEY=your-key-here
```

### 3. Analysis Returns Empty Results

**Symptom:** Analysis completes but sections are empty

**Check:**
```bash
# Run with verbose output
pnpm cba analyze . -v

# Check surface analysis
pnpm cba analyze . -d surface
```

**Common causes:**
- All files excluded by patterns
- Repository is empty or only has ignored files
- Focus filter matches nothing

**Debug:**
```typescript
// In orchestrator.ts, check modulesToAnalyze
console.log("Modules to analyze:", modulesToAnalyze);
```

### 4. Wrong Repository Name

**Symptom:** Shows temp directory name instead of repo name

**Check:** Ensure `sourceName` is passed through:
1. `extractSourceName()` in analyze.ts or cli/index.ts
2. Passed to `orchestrateAnalysis()` options
3. Passed to `surfaceAnalysis()` options
4. Used in `buildRepositoryMap()`

### 5. Structural Analysis Slow

**Symptom:** Takes too long on large repos

**Check:**
```bash
# See batch progress
pnpm cba analyze . -v
```

**Tune:**
- Reduce `MAX_PARALLEL_STRUCTURAL` in orchestrator.ts
- Use `--focus` to limit modules
- Increase `--exclude` patterns

### 6. Property Access Errors

**Symptom:** `Cannot read properties of undefined`

**Debug:**
```typescript
// Add defensive checks
const value = result?.property?.nested ?? defaultValue;
```

**Common pattern:** Type definition doesn't match actual usage
- Check `src/types.ts` for correct property names
- Grep for usages of old property names

## Debug Mode

Enable verbose logging:

```bash
# CLI
pnpm cba analyze . -v

# Programmatic
logger.setVerbose(true);
```

This shows:
- Surface analysis progress
- Structural batch progress
- Semantic analysis calls
- Timing information

## Log Categories

The logger uses categories for filtering:

```typescript
logger.surface("message");     // Surface layer
logger.structural("message");  // Structural layer
logger.semantic("message");    // Semantic layer
logger.orchestrator("message"); // Orchestration
logger.error("category", "message"); // Errors
```

## Testing Individual Layers

### Surface Only
```bash
pnpm cba analyze . -d surface
```

### Structural Without Semantic
```bash
pnpm cba analyze . -d standard
```

### With Semantic
```bash
pnpm cba analyze . -d deep -s
```

## Inspecting Cache

Analysis results are cached for `expand_section`:

```typescript
// In orchestrator.ts
import { analysisCache } from "./cache.js";

// Check cache
const cached = analysisCache.getByAnalysisId(analysisId);
console.log("Cached result:", cached);
```

## Gemini Retry Logic

The Gemini client in `src/core/gemini.ts` has retry logic:

```typescript
// Check retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
```

If retries fail, check:
- API quotas
- Request payload size
- Network connectivity

## Performance Profiling

For slow analyses:

```bash
# Time the analysis
time pnpm cba analyze . -d standard -q

# Profile with Node
node --prof dist/cli/index.js analyze .
```

## Checklist for Issues

- [ ] `pnpm build` succeeds
- [ ] `pnpm cba capabilities` returns JSON
- [ ] Surface analysis works (`-d surface`)
- [ ] Standard analysis works (`-d standard`)
- [ ] Semantic analysis works (if API key set)
- [ ] Verbose mode shows progress (`-v`)
- [ ] No TypeScript errors (`pnpm tsc --noEmit`)

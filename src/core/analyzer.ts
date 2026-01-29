import type {
  AnalyzeRepoInput,
  AnalyzeRepoOutput,
  ExtractFeatureInput,
  ExtractFeatureOutput,
  QueryRepoInput,
  QueryRepoOutput,
  CompareReposInput,
  CompareReposOutput,
} from "../types.js";
import { loadRepo, formatRepoForPrompt } from "./repo-loader.js";
import { generateJsonWithGemini } from "./gemini.js";

const ANALYZE_REPO_PROMPT = `You are an expert software architect analyzing a codebase. Your goal is to produce a comprehensive analysis that another AI agent can use to understand and replicate the architecture.

Analyze the following codebase and provide a detailed JSON response.

<codebase>
{CODEBASE}
</codebase>

{FOCUS_SECTION}

Respond with a JSON object matching this exact structure:
{
  "architecture": {
    "overview": "2-3 paragraph high-level description of the system architecture",
    "patterns": ["list of architectural patterns used, e.g., MVC, microservices, event-driven"],
    "keyDecisions": ["important architectural decisions made and why"],
    "dataFlow": "description of how data flows through the system"
  },
  "structure": {
    "entryPoints": ["main entry point files"],
    "coreModules": [{"path": "path/to/module", "purpose": "what this module does"}],
    "dependencies": [{"name": "dependency-name", "purpose": "why it's used"}]
  },
  "models": {
    "dataModels": [{"name": "ModelName", "fields": ["field1", "field2"], "relationships": ["relates to X"]}],
    "apiEndpoints": [{"path": "/api/endpoint", "method": "GET", "purpose": "what it does"}]
  },
  "patterns": {
    "conventions": ["naming conventions", "file organization patterns"],
    "stateManagement": "how state is managed (if applicable)",
    "errorHandling": "error handling approach",
    "testing": "testing approach and patterns"
  },
  "forAgent": {
    "summary": "1-2 paragraph executive summary for quick agent consumption",
    "keyInsights": ["most important things to know about this codebase"],
    "replicationGuide": "step-by-step guide to recreate this architecture from scratch"
  }
}`;

const EXTRACT_FEATURE_PROMPT = `You are an expert software engineer analyzing how a specific feature is implemented in a codebase.

<codebase>
{CODEBASE}
</codebase>

Analyze how this feature is implemented: "{FEATURE}"

Respond with a JSON object matching this exact structure:
{
  "feature": "the feature being analyzed",
  "implementation": {
    "files": [{"path": "path/to/file", "role": "what role this file plays", "keyCode": "key code snippet if relevant"}],
    "dataFlow": "how data flows for this feature",
    "dependencies": ["external dependencies used"],
    "patterns": ["design patterns used"]
  },
  "forAgent": {
    "summary": "1-2 paragraph summary of how the feature works",
    "howToReplicate": ["step 1", "step 2", "step-by-step instructions to build this feature"]
  }
}`;

const QUERY_REPO_PROMPT = `You are an expert software engineer answering questions about a codebase.

<codebase>
{CODEBASE}
</codebase>

Question: {QUESTION}

Respond with a JSON object matching this exact structure:
{
  "answer": "detailed answer to the question",
  "references": [{"file": "path/to/file", "lines": "10-20", "snippet": "relevant code snippet"}],
  "confidence": "high" | "medium" | "low"
}

Base your confidence on:
- "high": answer is directly supported by code in the codebase
- "medium": answer is inferred from patterns but not explicitly shown
- "low": answer requires assumptions or the codebase doesn't clearly address this`;

const COMPARE_REPOS_PROMPT = `You are an expert software architect comparing how different codebases approach the same problem.

You will analyze multiple codebases and compare their approaches to: "{ASPECT}"

{CODEBASES}

Respond with a JSON object matching this exact structure:
{
  "aspect": "the aspect being compared",
  "comparisons": [
    {
      "repo": "repository name/identifier",
      "approach": "description of how this repo handles the aspect",
      "pros": ["advantages of this approach"],
      "cons": ["disadvantages of this approach"],
      "keyFiles": ["relevant files"]
    }
  ],
  "recommendation": "which approach is recommended and why, considering different use cases"
}`;

export async function analyzeRepo(
  input: AnalyzeRepoInput
): Promise<AnalyzeRepoOutput> {
  const context = await loadRepo(input.source, {
    exclude: input.exclude,
  });

  const codebaseContent = formatRepoForPrompt(context);

  let focusSection = "";
  if (input.focus && input.focus.length > 0) {
    focusSection = `\nFocus your analysis particularly on these areas:\n${input.focus.map((f) => `- ${f}`).join("\n")}\n`;
  }

  const prompt = ANALYZE_REPO_PROMPT
    .replace("{CODEBASE}", codebaseContent)
    .replace("{FOCUS_SECTION}", focusSection);

  return generateJsonWithGemini<AnalyzeRepoOutput>(prompt, {
    maxOutputTokens: 16384,
  });
}

export async function extractFeature(
  input: ExtractFeatureInput
): Promise<ExtractFeatureOutput> {
  const context = await loadRepo(input.source);
  const codebaseContent = formatRepoForPrompt(context);

  const prompt = EXTRACT_FEATURE_PROMPT
    .replace("{CODEBASE}", codebaseContent)
    .replace("{FEATURE}", input.feature);

  return generateJsonWithGemini<ExtractFeatureOutput>(prompt, {
    maxOutputTokens: 8192,
  });
}

export async function queryRepo(
  input: QueryRepoInput
): Promise<QueryRepoOutput> {
  const context = await loadRepo(input.source);
  const codebaseContent = formatRepoForPrompt(context);

  const prompt = QUERY_REPO_PROMPT
    .replace("{CODEBASE}", codebaseContent)
    .replace("{QUESTION}", input.question);

  return generateJsonWithGemini<QueryRepoOutput>(prompt, {
    maxOutputTokens: 4096,
  });
}

export async function compareRepos(
  input: CompareReposInput
): Promise<CompareReposOutput> {
  const contexts = await Promise.all(
    input.sources.map((source) => loadRepo(source))
  );

  const codebasesContent = contexts
    .map(
      (ctx, i) =>
        `=== CODEBASE ${i + 1}: ${ctx.source} ===\n\n${formatRepoForPrompt(ctx)}`
    )
    .join("\n\n");

  const prompt = COMPARE_REPOS_PROMPT
    .replace("{ASPECT}", input.aspect)
    .replace("{CODEBASES}", codebasesContent);

  return generateJsonWithGemini<CompareReposOutput>(prompt, {
    maxOutputTokens: 8192,
  });
}

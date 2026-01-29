import type {
  AnalyzeRepoOutput,
  ExtractFeatureOutput,
  QueryRepoOutput,
  CompareReposOutput,
  OutputFormat,
} from "../types.js";

export function formatAnalyzeOutput(
  output: AnalyzeRepoOutput,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(output, null, 2);
  }

  const lines: string[] = [
    "# Codebase Analysis",
    "",
    "## Architecture Overview",
    "",
    output.architecture.overview,
    "",
    "### Patterns",
    ...output.architecture.patterns.map((p) => `- ${p}`),
    "",
    "### Key Decisions",
    ...output.architecture.keyDecisions.map((d) => `- ${d}`),
    "",
    "### Data Flow",
    output.architecture.dataFlow,
    "",
    "## Structure",
    "",
    "### Entry Points",
    ...output.structure.entryPoints.map((e) => `- \`${e}\``),
    "",
    "### Core Modules",
    ...output.structure.coreModules.map(
      (m) => `- **\`${m.path}\`**: ${m.purpose}`
    ),
    "",
    "### Dependencies",
    ...output.structure.dependencies.map((d) => `- **${d.name}**: ${d.purpose}`),
    "",
    "## Data Models",
    "",
    ...output.models.dataModels.flatMap((m) => [
      `### ${m.name}`,
      "**Fields:**",
      ...m.fields.map((f) => `- ${f}`),
      "**Relationships:**",
      ...m.relationships.map((r) => `- ${r}`),
      "",
    ]),
  ];

  if (output.models.apiEndpoints?.length) {
    lines.push(
      "## API Endpoints",
      "",
      ...output.models.apiEndpoints.map(
        (e) => `- \`${e.method} ${e.path}\`: ${e.purpose}`
      ),
      ""
    );
  }

  lines.push(
    "## Patterns & Conventions",
    "",
    ...output.patterns.conventions.map((c) => `- ${c}`)
  );

  if (output.patterns.stateManagement) {
    lines.push("", `**State Management:** ${output.patterns.stateManagement}`);
  }
  if (output.patterns.errorHandling) {
    lines.push("", `**Error Handling:** ${output.patterns.errorHandling}`);
  }
  if (output.patterns.testing) {
    lines.push("", `**Testing:** ${output.patterns.testing}`);
  }

  lines.push(
    "",
    "---",
    "",
    "## For Agent Consumption",
    "",
    "### Summary",
    output.forAgent.summary,
    "",
    "### Key Insights",
    ...output.forAgent.keyInsights.map((i) => `- ${i}`),
    "",
    "### Replication Guide",
    output.forAgent.replicationGuide
  );

  return lines.join("\n");
}

export function formatFeatureOutput(
  output: ExtractFeatureOutput,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(output, null, 2);
  }

  const lines: string[] = [
    `# Feature Analysis: ${output.feature}`,
    "",
    "## Implementation",
    "",
    "### Files",
    ...output.implementation.files.map((f) => {
      const parts = [`- **\`${f.path}\`**: ${f.role}`];
      if (f.keyCode) {
        parts.push("  ```", `  ${f.keyCode}`, "  ```");
      }
      return parts.join("\n");
    }),
    "",
    "### Data Flow",
    output.implementation.dataFlow,
    "",
    "### Dependencies",
    ...output.implementation.dependencies.map((d) => `- ${d}`),
    "",
    "### Patterns Used",
    ...output.implementation.patterns.map((p) => `- ${p}`),
    "",
    "---",
    "",
    "## For Agent Consumption",
    "",
    "### Summary",
    output.forAgent.summary,
    "",
    "### How to Replicate",
    ...output.forAgent.howToReplicate.map((step, i) => `${i + 1}. ${step}`),
  ];

  return lines.join("\n");
}

export function formatQueryOutput(
  output: QueryRepoOutput,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(output, null, 2);
  }

  const lines: string[] = [
    "# Query Response",
    "",
    `**Confidence:** ${output.confidence}`,
    "",
    "## Answer",
    "",
    output.answer,
    "",
  ];

  if (output.references.length > 0) {
    lines.push("## References", "");
    for (const ref of output.references) {
      let refLine = `- \`${ref.file}\``;
      if (ref.lines) {
        refLine += ` (lines ${ref.lines})`;
      }
      lines.push(refLine);
      if (ref.snippet) {
        lines.push("  ```", `  ${ref.snippet}`, "  ```");
      }
    }
  }

  return lines.join("\n");
}

export function formatCompareOutput(
  output: CompareReposOutput,
  format: OutputFormat
): string {
  if (format === "json") {
    return JSON.stringify(output, null, 2);
  }

  const lines: string[] = [
    `# Comparison: ${output.aspect}`,
    "",
  ];

  for (const comp of output.comparisons) {
    lines.push(
      `## ${comp.repo}`,
      "",
      "### Approach",
      comp.approach,
      "",
      "### Pros",
      ...comp.pros.map((p) => `- ${p}`),
      "",
      "### Cons",
      ...comp.cons.map((c) => `- ${c}`),
      "",
      "### Key Files",
      ...comp.keyFiles.map((f) => `- \`${f}\``),
      ""
    );
  }

  lines.push(
    "---",
    "",
    "## Recommendation",
    "",
    output.recommendation
  );

  return lines.join("\n");
}

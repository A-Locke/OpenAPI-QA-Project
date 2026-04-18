import Anthropic from '@anthropic-ai/sdk';
import type { DriftReport } from '@specguard/drift-core';
import { SemanticDriftAnalysisSchema, SemanticDriftAnalysis } from './schemas';

// Cached: system instructions never change between calls
const SYSTEM_INSTRUCTIONS = `You are a senior API engineer analyzing OpenAPI schema drift between an upstream API and an internal wrapper contract.

Given a drift report and the upstream spec for context, assess each warning and return a structured JSON analysis.

Severity rules:
- critical  : a field the wrapper ACTIVELY uses was removed or changed in a breaking way (runtime error or wrong data)
- warning   : a field changed that MIGHT affect wrapper behavior depending on input
- info      : field not exposed by wrapper, type widening that is safe, cosmetic rename
- none      : the report contains no warnings

Return ONLY a JSON object — no prose, no markdown fences — matching exactly:
{
  "overallSeverity": "critical" | "warning" | "info" | "none",
  "summary": "2-3 sentence executive summary for a PR description",
  "analyses": [
    {
      "path": "<field path from warning>",
      "type": "<drift type from warning>",
      "isBreaking": true | false,
      "semanticImpact": "what breaks at runtime if unaddressed",
      "suggestion": "concrete action: update normalizer / update internal spec / ignore"
    }
  ],
  "suggestedActions": ["top 1-5 prioritized actions"]
}

Focus only on warnings with severity="warning" in the input — skip INFO items in analyses to keep output concise.`;

/**
 * Sends a drift report to Claude for semantic analysis.
 *
 * Prompt caching strategy:
 * - Block 1 (system instructions) — ephemeral cache; rarely changes
 * - Block 2 (upstream spec content) — ephemeral cache; changes only on upstream release
 * - Dynamic part (drift report JSON) — not cached; unique per run
 *
 * This means repeated calls with the same upstream spec (e.g. in CI) will hit
 * the cache on blocks 1+2 and only pay for the dynamic diff tokens.
 */
export async function analyzeDrift(
  driftReport: DriftReport,
  upstreamSpecContent: string,
): Promise<SemanticDriftAnalysis> {
  // Short-circuit: nothing to analyze
  if (driftReport.summary.warnings === 0 && driftReport.summary.info === 0) {
    return {
      overallSeverity: 'none',
      summary: 'No drift detected between the upstream spec and the internal contract.',
      analyses: [],
      suggestedActions: [],
    };
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_INSTRUCTIONS,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: `UPSTREAM SPEC (reference — do not treat as the internal contract):\n\n${upstreamSpecContent}`,
        cache_control: { type: 'ephemeral' },
      },
    // cache_control is accepted by the API but not yet on TextBlockParam in the SDK's
    // main type namespace — it lives in the beta types. Cast through unknown to satisfy
    // the compiler while preserving the runtime behaviour.
    ] as unknown as Anthropic.Messages.TextBlockParam[],
    messages: [
      {
        role: 'user',
        content: `Analyze this drift report and return the JSON analysis:\n\n${JSON.stringify(driftReport, null, 2)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  return parseJsonResponse(text, SemanticDriftAnalysisSchema);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function parseJsonResponse<T>(raw: string, schema: { parse: (v: unknown) => T }): T {
  // Strip markdown code fences if the model wraps the output anyway
  const stripped = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  return schema.parse(JSON.parse(stripped));
}

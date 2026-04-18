import Anthropic from '@anthropic-ai/sdk';
import type { DriftWarning } from '@specguard/drift-core';
import { AiTestCasesResponseSchema, AiTestCase } from './schemas';

// Cached: system instructions are static
const SYSTEM_INSTRUCTIONS = `You are a senior QA engineer specializing in API contract testing.

Given an OpenAPI spec and optional upstream drift warnings, generate ADDITIONAL test cases that go beyond the obvious happy-path and basic negative tests that a mechanical spec parser would produce.

Focus on:
- Boundary values the spec allows but are rarely tested (min/max, empty arrays, single-element arrays)
- Unicode and special characters in string fields (hashtags with emoji, profiles with dashes)
- Combinations of valid inputs that might interact unexpectedly (all four input types at once)
- Stateful polling scenarios (run still running, run failed, run succeeded)
- Scenarios triggered by known drift warnings (if provided) — e.g. if a field type changed, test inputs relying on that field
- Security-adjacent inputs: unusually long strings, null characters in identifiers

Rules:
- Only generate test cases for paths that exist in the spec
- expectedStatus must match what the spec documents for that input scenario
- Resolve all path parameters — use mock IDs that the server will recognise
  (run-valid-abc123=200 results, run-running-def456=running, run-failed-ghi789=failed)
- Return 5-10 cases — quality over quantity
- id must start with "ai-" and be kebab-case

Return ONLY a JSON object — no prose, no markdown fences:
{
  "testCases": [
    {
      "id": "ai-kebab-case-id",
      "description": "human-readable description",
      "method": "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
      "path": "/resolved/path",
      "body": { ... } or null,
      "expectedStatus": 200,
      "rationale": "one sentence — why this edge case matters"
    }
  ]
}`;

/**
 * Generates AI-proposed edge-case test cases from an OpenAPI spec.
 *
 * Prompt caching strategy:
 * - Block 1 (system instructions) — ephemeral cache
 * - Block 2 (internal spec content) — ephemeral cache; rarely changes
 * - Dynamic part (drift warnings or empty message) — not cached
 *
 * All returned cases are Zod-validated against AiTestCaseSchema before
 * the caller receives them. Invalid cases are dropped with a warning rather
 * than crashing the run.
 */
export async function generateAiTestCases(
  internalSpecContent: string,
  driftWarnings: DriftWarning[] = [],
): Promise<AiTestCase[]> {
  const client = new Anthropic();

  const dynamicContent = driftWarnings.length > 0
    ? `Generate edge-case tests. Also consider these upstream drift warnings that may hint at fragile areas:\n\n${JSON.stringify(driftWarnings, null, 2)}`
    : 'Generate edge-case tests for this spec.';

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
        text: `INTERNAL API SPEC (this is the contract to test against):\n\n${internalSpecContent}`,
        cache_control: { type: 'ephemeral' },
      },
    // cache_control is accepted by the API but not yet on TextBlockParam in the SDK's
    // main type namespace — it lives in the beta types. Cast through unknown to satisfy
    // the compiler while preserving the runtime behaviour.
    ] as unknown as Anthropic.Messages.TextBlockParam[],
    messages: [
      {
        role: 'user',
        content: dynamicContent,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';

  try {
    const stripped = text
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();
    const raw = JSON.parse(stripped);
    const parsed = AiTestCasesResponseSchema.parse(raw);
    return parsed.testCases;
  } catch (err) {
    // AI output failed validation — log and return empty rather than crashing the run
    console.warn(
      `[ai-test-generator] Failed to parse AI response: ${(err as Error).message}`,
    );
    return [];
  }
}

import { generateAiTestCases as generate } from '@specguard/ai-drift-analyzer';
import type { DriftWarning } from '@specguard/drift-core';
import { TestCase } from '../types';

/**
 * Calls the AI test generator and converts the AI-specific `AiTestCase` shape
 * into the runner's `TestCase` type.
 *
 * Failures inside the generator (invalid JSON from model, validation errors)
 * are caught internally and return an empty array — the deterministic spec-driven
 * cases are always the primary test set and this is an additive enhancement.
 */
export async function generateAiCases(
  internalSpecContent: string,
  driftWarnings: DriftWarning[] = [],
): Promise<TestCase[]> {
  const aiCases = await generate(internalSpecContent, driftWarnings);

  return aiCases.map((c) => ({
    id: c.id,
    description: c.description,
    method: c.method,
    path: c.path,
    body: c.body ?? undefined,
    expectedStatus: c.expectedStatus,
    // AI cases don't carry a validated response schema — status-code check is sufficient
    responseSchema: undefined,
    source: 'ai-generated' as const,
    rationale: c.rationale,
  }));
}

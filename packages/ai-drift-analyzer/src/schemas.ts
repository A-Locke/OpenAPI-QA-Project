import { z } from 'zod';

// ── Drift analysis output ─────────────────────────────────────────────────

export const WarningAnalysisSchema = z.object({
  /** Dot-path matching the source DriftWarning.path */
  path: z.string(),
  /** Matches DriftWarning.type */
  type: z.string(),
  /** True when the change will cause runtime errors or data loss in the wrapper */
  isBreaking: z.boolean(),
  /** Plain-English description of what breaks at runtime if unaddressed */
  semanticImpact: z.string(),
  /** Concrete action: update normalizer, update internal spec, ignore, etc. */
  suggestion: z.string(),
});

export const SemanticDriftAnalysisSchema = z.object({
  /**
   * Overall severity roll-up:
   * - critical  : at least one breaking change in a field the wrapper actively uses
   * - warning   : potential impact but no confirmed breakage
   * - info      : all items are informational (field suppression, benign widening)
   * - none      : no drift warnings present
   */
  overallSeverity: z.enum(['critical', 'warning', 'info', 'none']),
  /** 2-3 sentence executive summary suitable for a PR description or Slack post */
  summary: z.string(),
  /** Per-warning breakdown (may omit INFO items to keep output concise) */
  analyses: z.array(WarningAnalysisSchema),
  /** Ordered list of top recommended actions (max 5) */
  suggestedActions: z.array(z.string()),
});

export type WarningAnalysis = z.infer<typeof WarningAnalysisSchema>;
export type SemanticDriftAnalysis = z.infer<typeof SemanticDriftAnalysisSchema>;

// ── AI test case output ───────────────────────────────────────────────────

export const AiTestCaseSchema = z.object({
  /** Unique kebab-case identifier — prefixed "ai-" to distinguish from spec-driven cases */
  id: z.string(),
  /** Human-readable test description */
  description: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  /** Resolved path — no {param} placeholders */
  path: z.string(),
  /** Request body (POST/PUT/PATCH), or undefined for GET/DELETE */
  body: z.unknown().optional(),
  /** HTTP status code the spec documents for this input */
  expectedStatus: z.number().int().min(100).max(599),
  /** One-sentence justification for why this edge case matters */
  rationale: z.string(),
});

export const AiTestCasesResponseSchema = z.object({
  testCases: z.array(AiTestCaseSchema),
});

export type AiTestCase = z.infer<typeof AiTestCaseSchema>;

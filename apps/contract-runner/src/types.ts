/** Category of a test result — used for report grouping */
export type ResultCategory =
  | 'passed'
  | 'contract_violation'   // response does not match internal spec schema
  | 'upstream_drift'       // upstream schema changed vs internal expectations
  | 'infrastructure_error'; // network/timeout/unexpected status

export interface TestCase {
  id: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  expectedStatus: number;
  /** The JSON Schema to validate the response body against */
  responseSchema?: Record<string, unknown>;
  /** Origin of the test case — spec-driven (default) or AI-generated */
  source?: 'spec-driven' | 'ai-generated';
  /** One-sentence justification for AI-generated cases */
  rationale?: string;
}

export interface TestResult {
  testId: string;
  description: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus?: number;
  durationMs: number;
  category: ResultCategory;
  passed: boolean;
  errors: string[];
  responseBody?: unknown;
}

export interface RunnerOptions {
  spec: string;
  baseUrl: string;
  output: string;
  timeoutMs: number;
  upstreamSpec?: string;
  failOnViolation: boolean;
  /** When true, call Claude to generate additional edge-case tests. Requires ANTHROPIC_API_KEY. */
  aiTestGen?: boolean;
}

export interface ReportSummary {
  total: number;
  passed: number;
  contractViolations: number;
  upstreamDriftWarnings: number;
  infrastructureErrors: number;
}

export interface TestReport {
  timestamp: string;
  specPath: string;
  baseUrl: string;
  summary: ReportSummary;
  results: TestResult[];
  driftWarnings?: import('@specguard/drift-core').DriftWarning[];
}

import { fetch } from 'undici';
import { loadSpec, resolveRefs } from '@specguard/openapi-utils';
import { detectDrift } from '@specguard/drift-core';
import { generateTestCases } from './generators/testCases';
import { validateStatusCode, validateResponseBody } from './validator';
import { buildSummary, writeJsonReport, printSummary } from './reporter';
import { TestCase, TestResult, RunnerOptions, TestReport, ResultCategory } from './types';

/**
 * Orchestrates the full contract test run:
 * 1. Load + resolve internal OpenAPI spec
 * 2. Run upstream drift detection (if configured)
 * 3. Generate test cases from spec
 * 4. Execute each test against the target server
 * 5. Validate responses against spec schemas
 * 6. Build and output report
 */
export async function run(options: RunnerOptions): Promise<TestReport> {
  console.log(`\nLoading spec: ${options.spec}`);
  const rawSpec = await loadSpec(options.spec);
  const spec = resolveRefs(rawSpec);

  // ── Drift detection ────────────────────────────────────────────────────
  let driftWarnings: Awaited<ReturnType<typeof detectDrift>>['warnings'] = [];

  if (options.upstreamSpec) {
    console.log(`Running drift detection against: ${options.upstreamSpec}`);
    try {
      const driftReport = await detectDrift(options.upstreamSpec, options.spec);
      driftWarnings = driftReport.warnings;
      console.log(
        `Drift check complete: ${driftReport.summary.warnings} warnings, ` +
        `${driftReport.summary.info} info`
      );
    } catch (err) {
      console.warn('Drift detection failed:', (err as Error).message);
    }
  }

  // ── Test generation ────────────────────────────────────────────────────
  const testCases = generateTestCases(spec);
  console.log(`Generated ${testCases.length} test cases\n`);

  // ── Test execution ─────────────────────────────────────────────────────
  const results: TestResult[] = [];

  for (const tc of testCases) {
    const result = await executeTest(tc, options.baseUrl, options.timeoutMs);
    results.push(result);
  }

  // ── Report ─────────────────────────────────────────────────────────────
  const summary = buildSummary(results, driftWarnings);

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    specPath: options.spec,
    baseUrl: options.baseUrl,
    summary,
    results,
    driftWarnings,
  };

  printSummary(report);
  await writeJsonReport(report, options.output);

  return report;
}

// ── Test execution ────────────────────────────────────────────────────────

async function executeTest(
  tc: TestCase,
  baseUrl: string,
  timeoutMs: number
): Promise<TestResult> {
  const url = `${baseUrl.replace(/\/$/, '')}${tc.path}`;
  const start = Date.now();

  const result: TestResult = {
    testId: tc.id,
    description: tc.description,
    method: tc.method,
    path: tc.path,
    expectedStatus: tc.expectedStatus,
    durationMs: 0,
    category: 'passed',
    passed: true,
    errors: [],
  };

  try {
    const res = await fetch(url, {
      method: tc.method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: tc.body !== undefined ? JSON.stringify(tc.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    result.durationMs = Date.now() - start;
    result.actualStatus = res.status;

    // Parse response body
    let responseBody: unknown = null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        responseBody = await res.json();
      } catch {
        // Non-JSON body — treat as empty
      }
    }
    result.responseBody = responseBody;

    // ── Status code validation ────────────────────────────────────────
    const statusValidation = validateStatusCode(res.status, tc.expectedStatus);
    if (!statusValidation.valid) {
      result.errors.push(...statusValidation.errors);
      result.category = categorizeError(res.status, tc.expectedStatus);
      result.passed = false;
    }

    // ── Schema validation (only for success responses with a schema) ───
    if (
      statusValidation.valid &&
      tc.responseSchema &&
      responseBody !== null
    ) {
      const schemaValidation = validateResponseBody(responseBody, tc.responseSchema);
      if (!schemaValidation.valid) {
        result.errors.push(...schemaValidation.errors);
        result.category = 'contract_violation';
        result.passed = false;
      }
    }
  } catch (err) {
    result.durationMs = Date.now() - start;
    result.errors.push((err as Error).message);
    result.category = 'infrastructure_error';
    result.passed = false;
  }

  const icon = result.passed ? '✓' : '✗';
  const label = result.passed ? 'PASS' : result.category.toUpperCase().replace('_', ' ');
  console.log(`  ${icon} [${label}] ${tc.description} (${result.durationMs}ms)`);

  return result;
}

/**
 * Classifies a status code mismatch as either a contract violation or an
 * infrastructure error. 5xx from the server during a positive test is an
 * infrastructure error; unexpected 4xx or schema mismatches are violations.
 */
function categorizeError(
  actual: number,
  expected: number
): ResultCategory {
  if (actual >= 500) return 'infrastructure_error';
  if (expected >= 200 && expected < 300 && actual >= 400) return 'contract_violation';
  return 'contract_violation';
}

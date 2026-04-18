import { OpenAPISpec, getRequestBodySchema, getResponseSchema } from '@specguard/openapi-utils';
import { TestCase } from '../types';

/**
 * Generates positive and negative test cases from the internal OpenAPI spec.
 *
 * Positive tests: valid inputs that should return the documented success status.
 * Negative tests: invalid/missing inputs that should return 400 or 404.
 */
export function generateTestCases(spec: OpenAPISpec): TestCase[] {
  const cases: TestCase[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // OpenAPI response keys are strings ("200", "202"); parse to number for TestCase
      const successStatusStr = getFirstSuccessStatus(operation.responses);
      const successStatus = successStatusStr ? parseInt(successStatusStr, 10) : 200;
      const responseSchema = successStatusStr
        ? (getResponseSchema(spec, path, method, successStatusStr) as Record<string, unknown> | undefined)
        : undefined;

      // ── Positive tests ─────────────────────────────────────────────────
      const positiveCases = buildPositiveCases(
        path, method.toUpperCase() as TestCase['method'],
        operation, spec, successStatus, responseSchema
      );
      cases.push(...positiveCases);

      // ── Negative tests ─────────────────────────────────────────────────
      const negativeCases = buildNegativeCases(
        path, method.toUpperCase() as TestCase['method'], operation
      );
      cases.push(...negativeCases);
    }
  }

  return cases;
}

// ── Positive test builders ────────────────────────────────────────────────

function buildPositiveCases(
  path: string,
  method: TestCase['method'],
  operation: NonNullable<OpenAPISpec['paths'][string]['get']>,
  spec: OpenAPISpec,
  expectedStatus: number,
  responseSchema: Record<string, unknown> | undefined
): TestCase[] {
  const cases: TestCase[] = [];

  if (method === 'POST' && path === '/scrape/tiktok') {
    // Use the documented examples from the spec where available
    const examples = getExamples(spec, path, method);

    if (examples.length > 0) {
      for (const ex of examples) {
        cases.push({
          id: `POST /scrape/tiktok [${ex.name}]`,
          description: `POST /scrape/tiktok — ${ex.summary ?? ex.name}`,
          method: 'POST',
          path: '/scrape/tiktok',
          body: ex.value,
          expectedStatus,
          responseSchema,
        });
      }
    } else {
      // Fallback fixtures if spec has no examples
      cases.push(
        {
          id: 'POST /scrape/tiktok [hashtag]',
          description: 'POST /scrape/tiktok — scrape by hashtag',
          method: 'POST',
          path: '/scrape/tiktok',
          body: { hashtags: ['trending'], resultsPerPage: 5 },
          expectedStatus,
          responseSchema,
        },
        {
          id: 'POST /scrape/tiktok [profile]',
          description: 'POST /scrape/tiktok — scrape by profile',
          method: 'POST',
          path: '/scrape/tiktok',
          body: { profiles: ['testuser'], resultsPerPage: 5 },
          expectedStatus,
          responseSchema,
        }
      );
    }
    return cases;
  }

  if (method === 'GET' && path.includes('{runId}')) {
    const resolvedPath = path.replace('{runId}', 'run-valid-abc123');
    const errSchema = getResponseSchema(spec, path, 'get', '200') as
      | Record<string, unknown>
      | undefined;
    cases.push({
      id: 'GET /scrape/results/:runId [valid]',
      description: 'GET /scrape/results/:runId — valid run ID returns results',
      method: 'GET',
      path: resolvedPath,
      expectedStatus: 200,
      responseSchema: errSchema,
    });
    return cases;
  }

  if (method === 'GET' && path === '/health') {
    cases.push({
      id: 'GET /health',
      description: 'GET /health — liveness probe',
      method: 'GET',
      path: '/health',
      expectedStatus: 200,
      responseSchema,
    });
    return cases;
  }

  // Generic fallback for other endpoints
  const resolvedPath = resolvePathParams(path);
  cases.push({
    id: `${method} ${path} [positive]`,
    description: `${method} ${path} — generic positive test`,
    method,
    path: resolvedPath,
    expectedStatus,
    responseSchema,
  });

  return cases;
}

// ── Negative test builders ────────────────────────────────────────────────

function buildNegativeCases(
  path: string,
  method: TestCase['method'],
  _operation: NonNullable<OpenAPISpec['paths'][string]['get']>
): TestCase[] {
  const cases: TestCase[] = [];

  if (method === 'POST' && path === '/scrape/tiktok') {
    cases.push(
      {
        id: 'POST /scrape/tiktok [empty-body]',
        description: 'POST /scrape/tiktok — empty body should return 400',
        method: 'POST',
        path: '/scrape/tiktok',
        body: {},
        expectedStatus: 400,
      },
      {
        id: 'POST /scrape/tiktok [wrong-type]',
        description: 'POST /scrape/tiktok — resultsPerPage as string should return 400',
        method: 'POST',
        path: '/scrape/tiktok',
        // The wrapper validates types via Zod — string for integer field should fail
        body: { hashtags: ['test'], resultsPerPage: 'not-a-number' },
        expectedStatus: 400,
      },
      {
        id: 'POST /scrape/tiktok [out-of-range]',
        description: 'POST /scrape/tiktok — resultsPerPage below minimum should return 400',
        method: 'POST',
        path: '/scrape/tiktok',
        body: { hashtags: ['test'], resultsPerPage: 0 },
        expectedStatus: 400,
      }
    );
    return cases;
  }

  if (method === 'GET' && path.includes('{runId}')) {
    cases.push({
      id: 'GET /scrape/results/:runId [not-found]',
      description: 'GET /scrape/results/:runId — unknown runId should return 404',
      method: 'GET',
      path: '/scrape/results/nonexistent-run-xyz',
      expectedStatus: 404,
    });
  }

  return cases;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getFirstSuccessStatus(
  responses: Record<string, unknown>
): string | undefined {
  return Object.keys(responses).find(
    (s) => s !== 'default' && parseInt(s, 10) >= 200 && parseInt(s, 10) < 300
  );
}

interface ExampleEntry {
  name: string;
  summary?: string;
  value: unknown;
}

function getExamples(spec: OpenAPISpec, path: string, method: string): ExampleEntry[] {
  const operation = (spec.paths[path] as Record<string, unknown>)?.[method] as
    | Record<string, unknown>
    | undefined;
  if (!operation) return [];

  const requestBody = operation.requestBody as Record<string, unknown> | undefined;
  const content = requestBody?.content as Record<string, unknown> | undefined;
  const jsonContent = content?.['application/json'] as Record<string, unknown> | undefined;
  const examples = jsonContent?.examples as Record<string, unknown> | undefined;

  if (!examples) return [];

  return Object.entries(examples).map(([name, ex]) => ({
    name,
    summary: (ex as Record<string, unknown>).summary as string | undefined,
    value: (ex as Record<string, unknown>).value,
  }));
}

function resolvePathParams(path: string): string {
  return path.replace(/\{[^}]+\}/g, 'test-value');
}

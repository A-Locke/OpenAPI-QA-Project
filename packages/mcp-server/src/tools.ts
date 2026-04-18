import { readFile } from 'node:fs/promises';
import { detectDrift } from '@specguard/drift-core';

// ── Tool definitions (MCP ListTools response) ─────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: 'get_drift_report',
    description:
      'Compare the upstream Apify Actor spec against the internal wrapper contract and return a structured drift report (field removals, type changes, constraint changes, suppressed fields).',
    inputSchema: {
      type: 'object',
      properties: {
        upstreamSpecPath: {
          type: 'string',
          description: 'Absolute or relative path to the upstream spec (actor-openapi.json)',
        },
        internalSpecPath: {
          type: 'string',
          description: 'Absolute or relative path to the internal wrapper spec (openapi.yaml)',
        },
      },
      required: ['upstreamSpecPath', 'internalSpecPath'],
    },
  },
  {
    name: 'get_spec',
    description:
      'Read and return the contents of a spec file (upstream or internal). Useful for inspecting schemas, paths, and examples.',
    inputSchema: {
      type: 'object',
      properties: {
        specPath: {
          type: 'string',
          description: 'Absolute or relative path to the spec file',
        },
      },
      required: ['specPath'],
    },
  },
  {
    name: 'analyze_drift_semantics',
    description:
      'Run drift detection and return the full drift report plus the upstream spec content. ' +
      'Use the returned data to perform semantic analysis: for each warning assess whether it is breaking, ' +
      'explain the runtime impact, and suggest a concrete fix. Then give an overall severity and a 2-3 sentence summary.',
    inputSchema: {
      type: 'object',
      properties: {
        upstreamSpecPath: {
          type: 'string',
          description: 'Path to the upstream spec',
        },
        internalSpecPath: {
          type: 'string',
          description: 'Path to the internal wrapper spec',
        },
      },
      required: ['upstreamSpecPath', 'internalSpecPath'],
    },
  },
  {
    name: 'generate_ai_test_cases',
    description:
      'Return the internal API spec content and any upstream drift warnings. ' +
      'Use the returned data to generate 5-10 edge-case and boundary test cases that go beyond what a ' +
      'mechanical spec parser produces — boundary values, unicode inputs, error conditions, and scenarios ' +
      'suggested by the drift warnings. Return each case with: id (ai- prefix), description, method, ' +
      'resolved path, body, expectedStatus, and a one-sentence rationale.',
    inputSchema: {
      type: 'object',
      properties: {
        internalSpecPath: {
          type: 'string',
          description: 'Path to the internal wrapper spec',
        },
        upstreamSpecPath: {
          type: 'string',
          description:
            'Optional path to the upstream spec — when provided, drift warnings are included as hints for the generator',
        },
      },
      required: ['internalSpecPath'],
    },
  },
] as const;

// ── Tool handlers ────────────────────────────────────────────────────────

export type ToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

export async function handleTool(
  name: ToolName,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'get_drift_report':
      return handleGetDriftReport(args);
    case 'get_spec':
      return handleGetSpec(args);
    case 'analyze_drift_semantics':
      return handleAnalyzeDrift(args);
    case 'generate_ai_test_cases':
      return handleGenerateTestCases(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Individual handlers ───────────────────────────────────────────────────

async function handleGetDriftReport(args: Record<string, unknown>): Promise<string> {
  const upstreamSpecPath = requireString(args, 'upstreamSpecPath');
  const internalSpecPath = requireString(args, 'internalSpecPath');

  const report = await detectDrift(upstreamSpecPath, internalSpecPath);
  return JSON.stringify(report, null, 2);
}

async function handleGetSpec(args: Record<string, unknown>): Promise<string> {
  const specPath = requireString(args, 'specPath');
  // loadSpec returns the parsed object — return raw file content for readability
  const content = await readFile(specPath, 'utf-8');
  return content;
}

async function handleAnalyzeDrift(args: Record<string, unknown>): Promise<string> {
  const upstreamSpecPath = requireString(args, 'upstreamSpecPath');
  const internalSpecPath = requireString(args, 'internalSpecPath');

  const [driftReport, upstreamSpecContent] = await Promise.all([
    detectDrift(upstreamSpecPath, internalSpecPath),
    readFile(upstreamSpecPath, 'utf-8'),
  ]);

  // Return the raw data — the MCP host (Claude) performs the semantic analysis.
  return JSON.stringify({ driftReport, upstreamSpecContent }, null, 2);
}

async function handleGenerateTestCases(args: Record<string, unknown>): Promise<string> {
  const internalSpecPath = requireString(args, 'internalSpecPath');
  const upstreamSpecPath = args['upstreamSpecPath'] as string | undefined;

  const internalSpecContent = await readFile(internalSpecPath, 'utf-8');

  let driftWarnings: Awaited<ReturnType<typeof detectDrift>>['warnings'] = [];
  if (upstreamSpecPath) {
    const driftReport = await detectDrift(upstreamSpecPath, internalSpecPath);
    driftWarnings = driftReport.warnings;
  }

  // Return the raw data — the MCP host (Claude) generates the test cases.
  return JSON.stringify({ internalSpecContent, driftWarnings }, null, 2);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function requireString(args: Record<string, unknown>, key: string): string {
  const val = args[key];
  if (typeof val !== 'string' || val.trim() === '') {
    throw new Error(`Missing or empty required argument: ${key}`);
  }
  return val;
}

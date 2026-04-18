import { loadSpec, getSchema, OpenAPISpec, SchemaObject } from '@specguard/openapi-utils';
import { compareSchemas, DriftWarning } from './comparator';

export interface DriftReport {
  timestamp: string;
  upstreamSpecPath: string;
  internalSpecPath: string;
  warnings: DriftWarning[];
  summary: {
    total: number;
    warnings: number;
    info: number;
    byType: Partial<Record<DriftWarning['type'], number>>;
  };
}

/**
 * Loads the upstream actor spec and the internal wrapper spec, then compares
 * the request and response schemas to surface drift between them.
 *
 * This function never modifies either spec file.
 */
export async function detectDrift(
  upstreamSpecPath: string,
  internalSpecPath: string
): Promise<DriftReport> {
  const [upstreamSpec, internalSpec] = await Promise.all([
    loadSpec(upstreamSpecPath),
    loadSpec(internalSpecPath),
  ]);

  const warnings: DriftWarning[] = [
    ...compareInputSchemas(upstreamSpec, internalSpec),
    ...compareRunSchemas(upstreamSpec, internalSpec),
  ];

  const summary = buildSummary(warnings);

  return {
    timestamp: new Date().toISOString(),
    upstreamSpecPath,
    internalSpecPath,
    warnings,
    summary,
  };
}

// ── Schema comparisons ──────────────────────────────────────────────────────

/**
 * Compares the upstream actor's inputSchema against the internal ScrapeRequest schema.
 *
 * The wrapper intentionally exposes only a subset of upstream fields.
 * Drift warnings fire when:
 * - a field the wrapper exposes is removed or renamed in upstream
 * - a field type changes in upstream that could break normalization
 */
function compareInputSchemas(
  upstream: OpenAPISpec,
  internal: OpenAPISpec
): DriftWarning[] {
  const upstreamInput = getSchema(upstream, 'inputSchema');
  const internalRequest = getSchema(internal, 'ScrapeRequest');

  if (!upstreamInput || !internalRequest) {
    return [{
      type: 'FIELD_REMOVED_FROM_UPSTREAM',
      severity: 'warning',
      path: 'inputSchema',
      message: 'Could not locate inputSchema in upstream spec or ScrapeRequest in internal spec.',
    }];
  }

  return compareSchemas(upstreamInput, internalRequest, 'ScrapeRequest');
}

/**
 * Compares the upstream actor's runsResponseSchema.data against the internal
 * ScrapeInitResponse schema.
 *
 * Note: The wrapper maps run metadata fields (id → runId, startedAt, status).
 * Only those mapped fields are compared.
 */
function compareRunSchemas(
  upstream: OpenAPISpec,
  internal: OpenAPISpec
): DriftWarning[] {
  const upstreamRunFull = getSchema(upstream, 'runsResponseSchema');
  const internalInit = getSchema(internal, 'ScrapeInitResponse');

  if (!upstreamRunFull || !internalInit) return [];

  // The upstream run schema nests fields under `data`
  const upstreamRunData = (
    upstreamRunFull.properties?.['data'] as SchemaObject | undefined
  );
  if (!upstreamRunData) return [];

  // Build a synthetic upstream schema with only the fields the wrapper maps.
  // Only include a property if it actually exists in the upstream data schema
  // so the comparison is meaningful rather than noisy.
  const mappedProperties: Record<string, SchemaObject> = {};
  const upstreamProps = upstreamRunData.properties ?? {};
  // upstream field `id` maps to wrapper field `runId`
  if (upstreamProps['id']) mappedProperties['runId'] = upstreamProps['id'];
  if (upstreamProps['status']) mappedProperties['status'] = upstreamProps['status'];
  if (upstreamProps['startedAt']) mappedProperties['startedAt'] = upstreamProps['startedAt'];

  const mappedUpstreamFields: SchemaObject = {
    type: 'object',
    properties: mappedProperties,
  };

  return compareSchemas(mappedUpstreamFields, internalInit, 'ScrapeInitResponse');
}

// ── Summary ─────────────────────────────────────────────────────────────────

function buildSummary(warnings: DriftWarning[]): DriftReport['summary'] {
  const byType: Partial<Record<DriftWarning['type'], number>> = {};
  let warnCount = 0;
  let infoCount = 0;

  for (const w of warnings) {
    byType[w.type] = (byType[w.type] ?? 0) + 1;
    if (w.severity === 'warning') warnCount++;
    else infoCount++;
  }

  return {
    total: warnings.length,
    warnings: warnCount,
    info: infoCount,
    byType,
  };
}

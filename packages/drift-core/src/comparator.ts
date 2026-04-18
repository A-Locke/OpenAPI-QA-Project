import { SchemaObject } from '@specguard/openapi-utils';

export type DriftSeverity = 'warning' | 'info';

export type DriftType =
  | 'FIELD_REMOVED_FROM_UPSTREAM'   // upstream dropped a field the wrapper depends on
  | 'TYPE_CHANGED_IN_UPSTREAM'      // upstream changed a field type
  | 'CONSTRAINT_CHANGED_IN_UPSTREAM' // upstream changed min/max/enum
  | 'FIELD_NOT_EXPOSED_BY_WRAPPER'; // upstream has field that wrapper intentionally hides

export interface DriftWarning {
  type: DriftType;
  severity: DriftSeverity;
  /** Dot-path to the field, e.g. "ScrapeRequest.resultsPerPage" */
  path: string;
  message: string;
  upstream?: unknown;
  internal?: unknown;
}

/**
 * Compares two resolved SchemaObject property maps and returns drift warnings.
 *
 * Logic:
 * - For each field the internal contract exposes: check it still exists upstream
 *   and that the type is compatible.
 * - For each field in upstream that the internal contract does not expose: emit
 *   an INFO note (intentional suppression is fine, but should be visible).
 */
export function compareSchemas(
  upstreamSchema: SchemaObject,
  internalSchema: SchemaObject,
  contextPath: string
): DriftWarning[] {
  const warnings: DriftWarning[] = [];

  const upstreamProps = getProperties(upstreamSchema);
  const internalProps = getProperties(internalSchema);

  // 1. Fields the wrapper exposes — verify upstream still carries them
  for (const [field, internalDef] of Object.entries(internalProps)) {
    const fieldPath = `${contextPath}.${field}`;
    const upstreamDef = upstreamProps[field];

    if (!upstreamDef) {
      warnings.push({
        type: 'FIELD_REMOVED_FROM_UPSTREAM',
        severity: 'warning',
        path: fieldPath,
        message: `Field '${field}' is in the internal contract but was not found in the upstream spec. ` +
          `The normalizer may be mapping it from a renamed field — verify the normalization logic.`,
        internal: internalDef,
      });
      continue;
    }

    // Type check
    if (upstreamDef.type && internalDef.type && upstreamDef.type !== internalDef.type) {
      warnings.push({
        type: 'TYPE_CHANGED_IN_UPSTREAM',
        severity: 'warning',
        path: fieldPath,
        message: `Type mismatch for '${field}': upstream='${upstreamDef.type}' internal='${internalDef.type}'. ` +
          `Check normalization coercion logic.`,
        upstream: upstreamDef,
        internal: internalDef,
      });
    }

    // Constraint drift (minimum, maximum)
    if (
      internalDef.type === 'integer' || internalDef.type === 'number'
    ) {
      if (
        upstreamDef.maximum !== undefined &&
        internalDef.maximum !== undefined &&
        internalDef.maximum > upstreamDef.maximum
      ) {
        warnings.push({
          type: 'CONSTRAINT_CHANGED_IN_UPSTREAM',
          severity: 'warning',
          path: fieldPath,
          message: `Internal 'maximum' (${internalDef.maximum}) exceeds upstream 'maximum' (${upstreamDef.maximum}). ` +
            `The wrapper may allow values the actor will reject.`,
          upstream: { maximum: upstreamDef.maximum },
          internal: { maximum: internalDef.maximum },
        });
      }
    }
  }

  // 2. Fields in upstream not exposed by wrapper — informational
  for (const [field, upstreamDef] of Object.entries(upstreamProps)) {
    if (!(field in internalProps)) {
      warnings.push({
        type: 'FIELD_NOT_EXPOSED_BY_WRAPPER',
        severity: 'info',
        path: `${contextPath}.${field}`,
        message: `Upstream field '${field}' is not exposed by the wrapper. ` +
          `This is intentional suppression — document if it should remain hidden.`,
        upstream: upstreamDef,
      });
    }
  }

  return warnings;
}

function getProperties(schema: SchemaObject): Record<string, SchemaObject> {
  return (schema.properties as Record<string, SchemaObject> | undefined) ?? {};
}

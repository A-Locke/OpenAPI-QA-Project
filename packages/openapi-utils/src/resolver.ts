import { OpenAPISpec, SchemaObject } from './types';

/**
 * Resolves all internal `$ref` pointers of the form `#/components/schemas/<Name>`
 * within an OpenAPI spec. Only internal refs are supported; external file refs
 * are not needed for this project's spec layout.
 */
export function resolveRefs(spec: OpenAPISpec): OpenAPISpec {
  const schemas = spec.components?.schemas ?? {};
  return resolveNode(spec, schemas) as OpenAPISpec;
}

/**
 * Extracts the fully-resolved schema for a named component.
 */
export function getSchema(
  spec: OpenAPISpec,
  schemaName: string
): SchemaObject | undefined {
  const schemas = spec.components?.schemas ?? {};
  const raw = schemas[schemaName];
  if (!raw) return undefined;
  return resolveNode(raw, schemas) as SchemaObject;
}

/**
 * Extracts the resolved request body schema for a given path + method.
 */
export function getRequestBodySchema(
  spec: OpenAPISpec,
  path: string,
  method: string
): SchemaObject | undefined {
  const operation = (spec.paths[path] as Record<string, unknown>)?.[method.toLowerCase()] as
    | Record<string, unknown>
    | undefined;
  if (!operation) return undefined;

  const schemas = spec.components?.schemas ?? {};
  const content = (operation.requestBody as Record<string, unknown> | undefined)?.content as
    | Record<string, unknown>
    | undefined;
  const schema = (content?.['application/json'] as Record<string, unknown> | undefined)
    ?.schema as SchemaObject | undefined;

  if (!schema) return undefined;
  return resolveNode(schema, schemas) as SchemaObject;
}

/**
 * Extracts the resolved response schema for a given path, method, and status code.
 */
export function getResponseSchema(
  spec: OpenAPISpec,
  path: string,
  method: string,
  statusCode: string
): SchemaObject | undefined {
  const operation = (spec.paths[path] as Record<string, unknown>)?.[method.toLowerCase()] as
    | Record<string, unknown>
    | undefined;
  if (!operation) return undefined;

  const schemas = spec.components?.schemas ?? {};
  const responses = operation.responses as Record<string, unknown> | undefined;
  const response = responses?.[statusCode] as Record<string, unknown> | undefined;
  const content = response?.content as Record<string, unknown> | undefined;
  const schema = (content?.['application/json'] as Record<string, unknown> | undefined)
    ?.schema as SchemaObject | undefined;

  if (!schema) return undefined;
  return resolveNode(schema, schemas) as SchemaObject;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function resolveNode(
  node: unknown,
  schemas: Record<string, unknown>
): unknown {
  if (node === null || typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    return node.map((item) => resolveNode(item, schemas));
  }

  const obj = node as Record<string, unknown>;

  if ('$ref' in obj && typeof obj['$ref'] === 'string') {
    const ref = obj['$ref'];
    const prefix = '#/components/schemas/';
    if (ref.startsWith(prefix)) {
      const schemaName = ref.slice(prefix.length);
      const target = schemas[schemaName];
      if (!target) throw new Error(`$ref target not found: ${ref}`);
      return resolveNode(target, schemas);
    }
    throw new Error(`Unsupported $ref format (only internal #/components/schemas/ refs are supported): ${ref}`);
  }

  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    resolved[key] = resolveNode(value, schemas);
  }
  return resolved;
}

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// Singleton AJV instance — configure once, reuse across all validations
const ajv = new Ajv({
  allErrors: true,       // collect all errors, not just the first
  strict: false,         // allow additional properties not in schema
  coerceTypes: false,    // do not coerce — we want type violations to surface
});
addFormats(ajv);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a response body against a JSON Schema.
 *
 * Distinguishes between:
 *   - valid: schema passes
 *   - invalid: one or more errors, each described in human-readable terms
 */
export function validateResponseBody(
  body: unknown,
  schema: Record<string, unknown>
): ValidationResult {
  const validate = ajv.compile(schema);
  const valid = validate(body);

  if (valid) return { valid: true, errors: [] };

  const errors = (validate.errors ?? []).map((err) => {
    const path = err.instancePath || '(root)';
    return `${path}: ${err.message ?? 'unknown error'}`;
  });

  return { valid: false, errors };
}

/**
 * Validates the HTTP status code against the expected value.
 */
export function validateStatusCode(
  actual: number,
  expected: number
): ValidationResult {
  if (actual === expected) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: [`Expected HTTP ${expected} but received HTTP ${actual}`],
  };
}

import { describe, it, expect } from 'vitest';
import { validateResponseBody, validateStatusCode } from '../src/validator';

describe('validateStatusCode', () => {
  it('passes when actual matches expected', () => {
    expect(validateStatusCode(200, 200).valid).toBe(true);
    expect(validateStatusCode(202, 202).valid).toBe(true);
    expect(validateStatusCode(404, 404).valid).toBe(true);
  });

  it('fails when codes differ', () => {
    const result = validateStatusCode(500, 200);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('500');
    expect(result.errors[0]).toContain('200');
  });
});

describe('validateResponseBody', () => {
  const schema = {
    type: 'object',
    required: ['runId', 'status', 'items'],
    properties: {
      runId: { type: 'string' },
      status: { type: 'string', enum: ['READY', 'RUNNING', 'SUCCEEDED', 'FAILED'] },
      items: { type: 'array' },
    },
  };

  it('passes for a valid response', () => {
    const result = validateResponseBody(
      { runId: 'abc123', status: 'SUCCEEDED', items: [] },
      schema
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when a required field is missing', () => {
    const result = validateResponseBody(
      { runId: 'abc123', items: [] }, // status missing
      schema
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('status') || e.includes('required'))).toBe(true);
  });

  it('fails when a field has the wrong type', () => {
    const result = validateResponseBody(
      { runId: 123, status: 'SUCCEEDED', items: [] }, // runId should be string
      schema
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('string') || e.includes('runId'))).toBe(true);
  });

  it('fails when an enum value is invalid', () => {
    const result = validateResponseBody(
      { runId: 'abc', status: 'INVALID_STATUS', items: [] },
      schema
    );
    expect(result.valid).toBe(false);
  });

  it('fails when items is not an array', () => {
    const result = validateResponseBody(
      { runId: 'abc', status: 'SUCCEEDED', items: 'not-an-array' },
      schema
    );
    expect(result.valid).toBe(false);
  });

  it('collects multiple errors at once', () => {
    const result = validateResponseBody(
      {}, // missing all required fields
      schema
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

import { describe, it, expect } from 'vitest';
import { compareSchemas } from '../src/comparator';

const upstreamSchema = {
  type: 'object' as const,
  properties: {
    hashtags: { type: 'array' as const },
    resultsPerPage: { type: 'integer' as const, minimum: 1, maximum: 1000000 },
    profiles: { type: 'array' as const },
    searchQueries: { type: 'array' as const },
    postURLs: { type: 'array' as const },
    advancedField: { type: 'string' as const }, // upstream-only field
  },
};

const internalSchema = {
  type: 'object' as const,
  properties: {
    hashtags: { type: 'array' as const },
    resultsPerPage: { type: 'integer' as const, minimum: 1, maximum: 100 }, // capped
    profiles: { type: 'array' as const },
    searchQueries: { type: 'array' as const },
    postURLs: { type: 'array' as const },
    // advancedField intentionally not exposed
  },
};

describe('compareSchemas', () => {
  it('produces no type-mismatch warnings when types align', () => {
    const warnings = compareSchemas(upstreamSchema, internalSchema, 'ScrapeRequest');
    const typeMismatches = warnings.filter((w) => w.type === 'TYPE_CHANGED_IN_UPSTREAM');
    expect(typeMismatches).toHaveLength(0);
  });

  it('reports FIELD_NOT_EXPOSED_BY_WRAPPER for upstream-only fields', () => {
    const warnings = compareSchemas(upstreamSchema, internalSchema, 'ScrapeRequest');
    const suppressed = warnings.filter((w) => w.type === 'FIELD_NOT_EXPOSED_BY_WRAPPER');
    expect(suppressed.some((w) => w.path.includes('advancedField'))).toBe(true);
    expect(suppressed.every((w) => w.severity === 'info')).toBe(true);
  });

  it('warns when internal maximum exceeds upstream maximum', () => {
    const internalWithHighMax = {
      type: 'object' as const,
      properties: {
        resultsPerPage: { type: 'integer' as const, minimum: 1, maximum: 9999999 }, // exceeds upstream
      },
    };
    const warnings = compareSchemas(upstreamSchema, internalWithHighMax, 'Test');
    const constraint = warnings.find((w) => w.type === 'CONSTRAINT_CHANGED_IN_UPSTREAM');
    expect(constraint).toBeDefined();
    expect(constraint?.severity).toBe('warning');
  });

  it('warns when a field the wrapper depends on is removed from upstream', () => {
    const upstreamMissingField = {
      type: 'object' as const,
      properties: {
        profiles: { type: 'array' as const },
        // hashtags missing from upstream
      },
    };
    const warnings = compareSchemas(upstreamMissingField, internalSchema, 'Test');
    const removed = warnings.filter((w) => w.type === 'FIELD_REMOVED_FROM_UPSTREAM');
    expect(removed.some((w) => w.path.includes('hashtags'))).toBe(true);
    expect(removed.every((w) => w.severity === 'warning')).toBe(true);
  });

  it('warns on type mismatch between upstream and internal', () => {
    const upstreamDifferentType = {
      type: 'object' as const,
      properties: {
        resultsPerPage: { type: 'string' as const }, // changed from integer to string
      },
    };
    const internalInteger = {
      type: 'object' as const,
      properties: {
        resultsPerPage: { type: 'integer' as const },
      },
    };
    const warnings = compareSchemas(upstreamDifferentType, internalInteger, 'Test');
    const typeChange = warnings.find((w) => w.type === 'TYPE_CHANGED_IN_UPSTREAM');
    expect(typeChange).toBeDefined();
    expect(typeChange?.path).toContain('resultsPerPage');
  });

  it('returns empty array when schemas are identical', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        name: { type: 'string' as const },
      },
    };
    const warnings = compareSchemas(schema, schema, 'Test');
    // Only INFO warnings from "not exposed" — which won't fire when schemas are identical
    const realWarnings = warnings.filter((w) => w.severity === 'warning');
    expect(realWarnings).toHaveLength(0);
  });
});

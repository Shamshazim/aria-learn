import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as shared from '..';

import { findLooseObjects } from './strictness';

/**
 * X-05: no schema this package exports may accept a field nobody validated.
 *
 * The list is not written down — it is read from the package's own exports, so a schema added
 * tomorrow is covered the moment it is exported. That is the point: a hand-kept list of
 * "schemas that must be strict" is the list that goes stale on the day it matters.
 */
describe('every exported schema', () => {
  const schemas = exportedSchemas();

  it('covers the protocol, so an empty result would not pass by accident', () => {
    expect(schemas.length).toBeGreaterThan(20);
  });

  it.each(schemas)('rejects unknown fields: %s', (_name, schema) => {
    expect(findLooseObjects(schema)).toEqual([]);
  });
});

describe('the audit itself', () => {
  it('finds a loose object nested inside a union inside an array', () => {
    const schema = z.strictObject({
      rows: z.array(z.union([z.strictObject({ a: z.string() }), z.object({ b: z.string() })])),
    });

    expect(findLooseObjects(schema)).toEqual([{ path: 'rows[]|1', keys: ['b'] }]);
  });

  it('sees through optional, nullable and default wrappers', () => {
    expect(findLooseObjects(z.strictObject({ a: z.object({}).optional().nullable() }))).toEqual([
      { path: 'a', keys: [] },
    ]);
  });

  it('is quiet about a record of unknown, which is a value and not a shape', () => {
    expect(findLooseObjects(z.strictObject({ params: z.record(z.string(), z.unknown()) }))).toEqual(
      [],
    );
  });

  it('terminates on a schema that refers to itself', () => {
    const node: z.ZodType = z.lazy(() => z.strictObject({ children: z.array(node).optional() }));

    expect(findLooseObjects(node)).toEqual([]);
  });
});

function exportedSchemas(): readonly (readonly [string, z.ZodType])[] {
  const entries: readonly (readonly [string, unknown])[] = Object.entries(shared);
  return entries
    .flatMap(([name, value]) => (value instanceof z.ZodType ? [[name, value] as const] : []))
    .sort(([left], [right]) => left.localeCompare(right));
}

import { describe, expect, it } from 'vitest';

import { MOVE_KINDS, SKILL_EVIDENCE_MOVE_KINDS, tutorMoveSchema } from '../moves.schema';

import type { z } from 'zod';

/**
 * The list callers read must be the list the schemas enforce (X-05).
 *
 * `SKILL_EVIDENCE_MOVE_KINDS` exists so a caller can decide whether `skillId` belongs on the
 * move it is building. That decision is only safe while the list matches the schemas, and a
 * list maintained by hand beside fourteen schemas in four files does not stay matching — so
 * it is derived here and compared, rather than trusted.
 */
describe('the moves that carry skillId', () => {
  it('are exactly the ones the schemas declare it on', () => {
    expect([...SKILL_EVIDENCE_MOVE_KINDS].sort()).toEqual(kindsDeclaring('skillId').sort());
  });

  it('is a real subset, so neither an empty nor an everything list would pass', () => {
    expect(SKILL_EVIDENCE_MOVE_KINDS.length).toBeGreaterThan(0);
    expect(SKILL_EVIDENCE_MOVE_KINDS.length).toBeLessThan(MOVE_KINDS.length);
  });
});

function kindsDeclaring(field: string): string[] {
  return optionsOf(tutorMoveSchema)
    .filter((option) => Object.keys(shapeOf(option)).includes(field))
    .map((option) => literalOf(shapeOf(option).kind));
}

function optionsOf(schema: z.ZodType): readonly z.ZodType[] {
  const options: unknown = (schema.def as { options?: unknown }).options;
  if (!Array.isArray(options)) throw new Error('tutorMoveSchema is no longer a union');
  return options as readonly z.ZodType[];
}

function shapeOf(schema: z.ZodType): Readonly<Record<string, unknown>> {
  const shape: unknown = (schema.def as { shape?: unknown }).shape;
  if (typeof shape !== 'object' || shape === null) throw new Error('a move option has no shape');
  return shape as Readonly<Record<string, unknown>>;
}

function literalOf(node: unknown): string {
  const values: unknown = (node as { def?: { values?: unknown } }).def?.values;
  const first: unknown = Array.isArray(values) ? values[0] : undefined;
  if (typeof first !== 'string') throw new Error('a move option has no literal kind');
  return first;
}

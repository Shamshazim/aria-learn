import type { z } from 'zod';

/**
 * Walks a schema and reports every object in it that would accept an unknown field (X-05).
 *
 * The acceptance criterion is "every HTTP and data-channel schema is strict", and the only
 * way to hold that as the protocol grows is to check it mechanically. A reviewer cannot see
 * the difference between `z.object` and `z.strictObject` in a diff of forty schemas; this
 * can, and it sees the ones nested four levels inside a discriminated union too.
 *
 * Why it matters beyond tidiness: an ignored field is a field nobody validated. A transcript
 * carrying `{"text": "...", "systemPrompt": "..."}` should fail at the boundary rather than
 * be quietly dropped and leave us guessing which layer was supposed to have caught it.
 */
export type LooseObject = Readonly<{
  /** Where in the schema tree it sits, e.g. `turn.event.alternatives[]`. */
  path: string;
  /** The keys it declares, which is usually enough to recognise it in the source. */
  keys: readonly string[];
}>;

/**
 * Zod's own internals, narrowed to the parts a walk needs.
 *
 * Reaching into `def` is deliberate and confined to this file: zod exposes no public
 * reflection API, and the alternative — a hand-maintained list of "schemas that must be
 * strict" — is exactly the list that goes stale. If a zod upgrade changes these shapes, this
 * file fails loudly in one place rather than silently passing everything.
 */
type SchemaDef = Readonly<{
  type: string;
  shape?: Readonly<Record<string, unknown>>;
  catchall?: unknown;
  options?: readonly unknown[];
  element?: unknown;
  innerType?: unknown;
  valueType?: unknown;
  keyType?: unknown;
  items?: readonly unknown[];
  left?: unknown;
  right?: unknown;
  in?: unknown;
  out?: unknown;
  getter?: () => unknown;
}>;

/** A child schema and the path it sits at. */
type Branch = readonly [unknown, string];

const NEVER = 'never';

/**
 * How to get from a wrapper to what it wraps. Anything not listed here — `optional`,
 * `nullable`, `default`, `catch`, `readonly`, `nonoptional`, the branded wrappers — carries
 * the schema it decorates as `innerType`, which is the fallback below.
 */
const BRANCHES: Readonly<Record<string, (def: SchemaDef, path: string) => readonly Branch[]>> = {
  union: (def, path) =>
    (def.options ?? []).map((option, index) => [option, `${path}|${String(index)}`]),
  array: (def, path) => [[def.element, `${path}[]`]],
  tuple: (def, path) => (def.items ?? []).map((item, index) => [item, `${path}[${String(index)}]`]),
  record: (def, path) => [
    [def.keyType, `${path}{key}`],
    [def.valueType, path],
  ],
  map: (def, path) => [
    [def.keyType, `${path}{key}`],
    [def.valueType, path],
  ],
  intersection: (def, path) => [
    [def.left, path],
    [def.right, path],
  ],
  pipe: (def, path) => [
    [def.in, path],
    [def.out, path],
  ],
  lazy: (def, path) => [[def.getter?.(), path]],
};

export function findLooseObjects(schema: z.ZodType, rootPath = ''): readonly LooseObject[] {
  return walk(schema, rootPath, new Set());
}

function walk(node: unknown, path: string, seen: Set<unknown>): readonly LooseObject[] {
  const def = defOf(node);
  if (def === null || seen.has(node)) return [];
  seen.add(node);
  if (def.type === 'object') return objectFindings(def, path, seen);
  const branches = BRANCHES[def.type]?.(def, path) ?? [[def.innerType, path] as const];
  return branches.flatMap(([child, childPath]) => walk(child, childPath, seen));
}

function objectFindings(def: SchemaDef, path: string, seen: Set<unknown>): readonly LooseObject[] {
  const shape = def.shape ?? {};
  const nested = Object.entries(shape).flatMap(([key, value]) =>
    walk(value, path === '' ? key : `${path}.${key}`, seen),
  );
  if (defOf(def.catchall)?.type === NEVER) return nested;
  return [{ path: path === '' ? '(root)' : path, keys: Object.keys(shape) }, ...nested];
}

function defOf(node: unknown): SchemaDef | null {
  if (typeof node !== 'object' || node === null) return null;
  const def: unknown = (node as { def?: unknown }).def;
  if (typeof def !== 'object' || def === null) return null;
  const type: unknown = (def as { type?: unknown }).type;
  return typeof type === 'string' ? (def as SchemaDef) : null;
}

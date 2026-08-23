import type { QueryResultRow } from 'pg';

/**
 * The only database surface the rest of the service is allowed to see.
 *
 * A `Pool` and a pooled client both satisfy it, which is the point: a repository written
 * against `Queryable` runs unchanged inside a transaction or outside one, and nothing above
 * the repository layer ever learns which it got (CODE-STANDARDS §3.1, §4).
 */
export type Queryable = {
  // The row type is an assertion about what this SQL returns — the driver cannot know it,
  // and the mapper is what validates it. That is exactly what the rule warns about, and it
  // is the deliberate shape of the boundary.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<R extends QueryResultRow>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[]; rowCount: number | null }>;
};

/**
 * A `Queryable` that is known to be a single connection, so statements on it share one
 * session. `withTransaction` hands one of these to its callback.
 */
export type TransactionalQueryable = Queryable & { readonly __transaction?: never };

/** Rows are shaped by SQL, so every row type is snake_case and stays inside a mapper. */
export type DbRow = QueryResultRow;

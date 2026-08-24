import { mapDatabaseError } from './errors';

import type { DbRow, Queryable } from './types';

/**
 * The one place a repository touches the driver.
 *
 * Every query goes through it so that no repository has to remember to translate a driver
 * error, and so `operation` — a stable label, never the SQL and never the parameters — is
 * what reaches the log (CODE-STANDARDS §5).
 */
// The row type is an assertion about what this SQL returns — the driver cannot know it,
// and the mapper is what validates it. That is exactly what the rule warns about, and it
// is the deliberate shape of the boundary.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export async function runQuery<R extends DbRow>(options: {
  db: Queryable;
  operation: string;
  sql: string;
  params?: readonly unknown[];
}): Promise<{ rows: R[]; rowCount: number | null }> {
  const { db, operation, sql, params } = options;
  try {
    return await db.query<R>(sql, params);
  } catch (error) {
    throw mapDatabaseError(error, operation);
  }
}

/**
 * The public surface of the database layer. Nothing above `repositories/` imports anything
 * from `db/` that is not re-exported here (CODE-STANDARDS §4).
 */
export { createPool, verifyConnection, closePool } from './pool';
export { withTransaction, withClientTransaction } from './transaction';
export { runMigrations, planMigrations } from './migrate';
export type { AppliedMigration, MigrationOutcome, MigrateDeps } from './migrate';
export { loadMigrationFiles, checksumOf, MigrationError, MIGRATIONS_DIR } from './migration-files';
export type { MigrationFile } from './migration-files';
export { runQuery } from './run-query';
export { mapDatabaseError, isDatabaseError, SQL_STATES } from './errors';
export type { Queryable, TransactionalQueryable, DbRow } from './types';

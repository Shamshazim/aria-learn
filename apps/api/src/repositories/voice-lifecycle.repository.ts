import { runQuery } from '@/db/run-query';
import { withTransaction } from '@/db/transaction';
import type { Queryable } from '@/db/types';

import type { Pool } from 'pg';

export type VoiceLifecycleRepository = Readonly<{
  exclusive<T>(studentId: string, operation: (db: Queryable) => Promise<T>): Promise<T>;
}>;

export function createVoiceLifecycleRepository(pool: Pool): VoiceLifecycleRepository {
  return {
    exclusive: (studentId, operation) =>
      withTransaction(pool, async (tx) => {
        await runQuery({
          db: tx,
          operation: 'voiceLifecycle.lock',
          sql: 'SELECT pg_advisory_xact_lock(hashtext($1))',
          params: [`voice:${studentId}`],
        });
        return operation(tx);
      }),
  };
}

import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

import type { QueryResultRow } from 'pg';

const rowSchema = z.object({
  id: z.string(),
  storage_key: z.string(),
  processor_refs: z.record(z.string(), z.string()),
});
type AudioRow = QueryResultRow & z.infer<typeof rowSchema>;

export type RetainedAudioReference = Readonly<{
  id: string;
  storageKey: string;
  processorRefs: Readonly<Record<string, string>>;
}>;

export type RetainedAudioRepository = Readonly<{
  listExpired(at: Date): Promise<readonly RetainedAudioReference[]>;
  listForStudent(studentId: string): Promise<readonly RetainedAudioReference[]>;
  markDeleted(ids: readonly string[], at: Date): Promise<void>;
}>;

export function createRetainedAudioRepository(db: Queryable): RetainedAudioRepository {
  return {
    listExpired: (at) => list(db, 'ra.expires_at <= $1', [at]),
    listForStudent: (studentId) =>
      list(db, 's.student_id = $1', [studentId], 'JOIN session s ON s.id = ra.session_id'),
    markDeleted: async (ids, at) => {
      if (ids.length === 0) return;
      await runQuery<QueryResultRow>({
        db,
        operation: 'retainedAudio.markDeleted',
        sql: `UPDATE retained_child_audio SET deleted_at = $2
              WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        params: [[...ids], at],
      });
    },
  };
}

async function list(
  db: Queryable,
  condition: string,
  params: readonly unknown[],
  join = '',
): Promise<readonly RetainedAudioReference[]> {
  const result = await runQuery<AudioRow>({
    db,
    operation: 'retainedAudio.listForDeletion',
    sql: `SELECT ra.id, ra.storage_key, ra.processor_refs
          FROM retained_child_audio ra ${join}
          WHERE ${condition} AND ra.deleted_at IS NULL`,
    params,
  });
  return result.rows.map((raw) => {
    const row = rowSchema.parse(raw);
    return { id: row.id, storageKey: row.storage_key, processorRefs: row.processor_refs };
  });
}

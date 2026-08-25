import { z } from 'zod';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { VoiceConsent } from '@/types/voice';

import type { QueryResultRow } from 'pg';

const rowSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  student_id: z.string(),
  status: z.enum(['granted', 'withdrawn']),
  processor_categories: z.array(z.string()),
  retain_reading_audio: z.boolean(),
  verification_reference: z.string(),
  verified_at: z.coerce.date(),
  withdrawn_at: z.coerce.date().nullable(),
});

type VoiceConsentRow = QueryResultRow & z.infer<typeof rowSchema>;

export type VoiceConsentRepository = Readonly<{
  findGranted(studentId: string): Promise<VoiceConsent | null>;
  grant(
    input: Readonly<{
      id: string;
      parentId: string;
      studentId: string;
      processorCategories: readonly string[];
      retainReadingAudio: boolean;
      verificationReference: string;
      at: Date;
    }>,
  ): Promise<VoiceConsent>;
  withdraw(studentId: string, at: Date): Promise<boolean>;
}>;

export function createVoiceConsentRepository(db: Queryable): VoiceConsentRepository {
  return {
    findGranted: (studentId) => findGranted(db, studentId),
    grant: (input) => grant(db, input),
    withdraw: (studentId, at) => withdraw(db, studentId, at),
  };
}

async function findGranted(db: Queryable, studentId: string): Promise<VoiceConsent | null> {
  const result = await runQuery<VoiceConsentRow>({
    db,
    operation: 'voiceConsent.findGranted',
    sql: `SELECT id, parent_id, student_id, status, processor_categories,
                 retain_reading_audio, verification_reference, verified_at, withdrawn_at
          FROM voice_consent WHERE student_id = $1 AND status = 'granted'`,
    params: [studentId],
  });
  return result.rows[0] === undefined ? null : toConsent(result.rows[0]);
}

async function grant(
  db: Queryable,
  input: Parameters<VoiceConsentRepository['grant']>[0],
): Promise<VoiceConsent> {
  const result = await runQuery<VoiceConsentRow>({
    db,
    operation: 'voiceConsent.grant',
    sql: `INSERT INTO voice_consent
            (id, parent_id, student_id, status, processor_categories,
            retain_reading_audio, verification_reference, verified_at, withdrawn_at)
          VALUES ($1, $2, $3, 'granted', $4, $5, $6, $7, NULL)
          ON CONFLICT (student_id) DO UPDATE SET
            parent_id = EXCLUDED.parent_id, status = 'granted',
            processor_categories = EXCLUDED.processor_categories,
            retain_reading_audio = EXCLUDED.retain_reading_audio,
            verification_reference = EXCLUDED.verification_reference,
            verified_at = EXCLUDED.verified_at, withdrawn_at = NULL
          RETURNING id, parent_id, student_id, status, processor_categories,
                    retain_reading_audio, verification_reference, verified_at, withdrawn_at`,
    params: [
      input.id,
      input.parentId,
      input.studentId,
      [...input.processorCategories],
      input.retainReadingAudio,
      input.verificationReference,
      input.at,
    ],
  });
  const row = result.rows[0];
  if (row === undefined) throw new Error('voiceConsent.grant returned no row');
  return toConsent(row);
}

async function withdraw(db: Queryable, studentId: string, at: Date): Promise<boolean> {
  const result = await runQuery<QueryResultRow>({
    db,
    operation: 'voiceConsent.withdraw',
    sql: `UPDATE voice_consent SET status = 'withdrawn', withdrawn_at = $2
          WHERE student_id = $1 AND status = 'granted'`,
    params: [studentId, at],
  });
  return result.rowCount === 1;
}

function toConsent(raw: VoiceConsentRow): VoiceConsent {
  const row = rowSchema.parse(raw);
  return {
    id: row.id,
    parentId: row.parent_id,
    studentId: row.student_id,
    status: row.status,
    processorCategories: row.processor_categories,
    retainReadingAudio: row.retain_reading_audio,
    verificationReference: row.verification_reference,
    verifiedAt: row.verified_at,
    withdrawnAt: row.withdrawn_at,
  };
}

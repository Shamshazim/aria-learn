import { z } from 'zod';

import type { Band } from '@aria/shared';
import { BRIDGE_BUCKETS, type BridgeBucket } from '@aria/voice';

import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';

import type { QueryResultRow } from 'pg';

const rowSchema = z.object({
  id: z.string(),
  content_hash: z.string(),
  intent_bucket: z.enum(BRIDGE_BUCKETS),
  written_text: z.string(),
  spoken_text: z.string(),
  storage_key: z.string(),
});
type SpeechAssetRow = QueryResultRow & z.infer<typeof rowSchema>;

/** The `purpose` column value every bridge clip carries; nothing else in the table is one. */
export const BRIDGE_PURPOSE = 'bridge';

export type SpeechAssetRecord = Readonly<{
  id: string;
  contentHash: string;
  bucket: BridgeBucket;
  writtenText: string;
  spokenText: string;
  storageKey: string;
}>;

export type SpeechAssetDraft = Readonly<{
  id: string;
  contentHash: string;
  voice: string;
  band: Band;
  bucket: BridgeBucket;
  writtenText: string;
  spokenText: string;
  storageKey: string;
}>;

export type SpeechAssetRepository = Readonly<{
  /** Every approved bridge clip for one band and one voice, which is all a session can play. */
  listApprovedBridges(
    input: Readonly<{ band: Band; voice: string }>,
  ): Promise<readonly SpeechAssetRecord[]>;
  findByHash(
    input: Readonly<{ contentHash: string; voice: string }>,
  ): Promise<SpeechAssetRecord | null>;
  findById(id: string): Promise<SpeechAssetRecord | null>;
  /** Inserts only what is not already there, so re-running the synthesiser costs nothing. */
  insertIfAbsent(draft: SpeechAssetDraft): Promise<boolean>;
}>;

const COLUMNS = 'id, content_hash, intent_bucket, written_text, spoken_text, storage_key';

export function createSpeechAssetRepository(db: Queryable): SpeechAssetRepository {
  return {
    listApprovedBridges: async ({ band, voice }) => {
      const result = await runQuery<SpeechAssetRow>({
        db,
        operation: 'speechAsset.listApprovedBridges',
        sql: `SELECT ${COLUMNS} FROM speech_asset
              WHERE purpose = $1 AND band = $2 AND voice = $3 AND review_status = 'approved'
                AND intent_bucket IS NOT NULL
              ORDER BY created_at, id`,
        params: [BRIDGE_PURPOSE, band, voice],
      });
      // A row whose bucket this build does not know about is left out rather than throwing:
      // one bad row must not cost every other clip in the band its voice.
      return result.rows.flatMap((raw) => {
        const row = rowSchema.safeParse(raw);
        return row.success ? [toRecord(row.data)] : [];
      });
    },
    findByHash: ({ contentHash, voice }) =>
      findOne(db, 'speechAsset.findByHash', 'content_hash = $1 AND voice = $2', [
        contentHash,
        voice,
      ]),
    findById: (id) => findOne(db, 'speechAsset.findById', 'id = $1', [id]),
    insertIfAbsent: async (draft) => {
      // `ON CONFLICT DO NOTHING` against the table's own `(content_hash, voice)` key is what
      // makes the synthesiser idempotent: the database decides, not a read the script raced.
      const result = await runQuery<QueryResultRow>({
        db,
        operation: 'speechAsset.insertIfAbsent',
        sql: `INSERT INTO speech_asset (id, content_hash, voice, band, purpose, intent_bucket,
                written_text, spoken_text, storage_key)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (content_hash, voice) DO NOTHING`,
        params: [
          draft.id,
          draft.contentHash,
          draft.voice,
          draft.band,
          BRIDGE_PURPOSE,
          draft.bucket,
          draft.writtenText,
          draft.spokenText,
          draft.storageKey,
        ],
      });
      return result.rowCount === 1;
    },
  };
}

async function findOne(
  db: Queryable,
  operation: string,
  condition: string,
  params: readonly unknown[],
): Promise<SpeechAssetRecord | null> {
  const result = await runQuery<SpeechAssetRow>({
    db,
    operation,
    sql: `SELECT ${COLUMNS} FROM speech_asset WHERE ${condition}`,
    params,
  });
  const first = result.rows[0];
  return first === undefined ? null : toRecord(rowSchema.parse(first));
}

function toRecord(row: z.infer<typeof rowSchema>): SpeechAssetRecord {
  return {
    id: row.id,
    contentHash: row.content_hash,
    bucket: row.intent_bucket,
    writtenText: row.written_text,
    spokenText: row.spoken_text,
    storageKey: row.storage_key,
  };
}

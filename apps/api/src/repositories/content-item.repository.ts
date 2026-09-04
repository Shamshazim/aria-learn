import type { ContentDraft, ContentItem, ContentLookup } from '@/content/types';
import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import { toContentItem, type ContentItemRow } from '@/mappers/content-item.mapper';

const COLUMNS = `id, kind, skill_code, band, body, quality_score, source_model,
  prompt_name, prompt_version, personalised_for, verified_at, times_used, created_at`;

export type ContentItemRepository = Readonly<{
  insert(draft: ContentDraft, personalisedFor: string | null): Promise<ContentItem>;
  findEligible(input: ContentLookup): Promise<ContentItem | null>;
  markUsed(id: string): Promise<void>;
  /** P2H-10: what the shareable bank already holds, so generation tops up rather than duplicates. */
  listContentHashes(
    input: Readonly<{ skillCode: string; band: string; kind: string }>,
  ): Promise<readonly string[]>;
  /**
   * The prompts of the newest items this child could be served for a skill, so a prompted
   * generation can be told what not to write again.
   */
  listPrompts(input: ContentLookup, limit: number): Promise<readonly string[]>;
}>;

export function createContentItemRepository(dependencies: {
  db: Queryable;
  ids: IdGenerator;
  clock: Clock;
}): ContentItemRepository {
  return {
    insert: (draft, owner) => insert(dependencies, draft, owner),
    findEligible: (input) => findEligible(dependencies.db, input),
    markUsed: (id) => markUsed(dependencies.db, id),
    listContentHashes: (input) => listContentHashes(dependencies.db, input),
    listPrompts: (input, limit) => listPrompts(dependencies.db, input, limit),
  };
}

async function insert(
  dependencies: Parameters<typeof createContentItemRepository>[0],
  draft: ContentDraft,
  owner: string | null,
): Promise<ContentItem> {
  const { rows } = await runQuery<ContentItemRow>({
    db: dependencies.db,
    operation: 'contentItem.insert',
    sql: `INSERT INTO content_item
          (id, kind, skill_code, band, body, quality_score, source_model,
           prompt_name, prompt_version, personalised_for, verified_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
          RETURNING ${COLUMNS}`,
    params: [
      dependencies.ids.next(),
      draft.kind,
      draft.skillCode,
      draft.band,
      JSON.stringify(draft.body),
      draft.qualityScore ?? null,
      draft.sourceModel ?? null,
      draft.promptName ?? null,
      draft.promptVersion ?? null,
      owner,
      dependencies.clock.now(),
    ],
  });
  const row = rows[0];
  if (row === undefined) throw new Error('contentItem.insert returned no row');
  return toContentItem(row);
}

/**
 * Excluded by prompt as well as by id: the bank holds items generated before it was told what
 * to avoid, so the same question can sit there under several ids, and a child who has just
 * answered it must not be handed the twin.
 */
async function findEligible(db: Queryable, input: ContentLookup): Promise<ContentItem | null> {
  const { rows } = await runQuery<ContentItemRow>({
    db,
    operation: 'contentItem.findEligible',
    sql: `SELECT ${COLUMNS} FROM content_item
          WHERE skill_code = $1 AND band = $2 AND kind = $3
            AND (personalised_for IS NULL OR personalised_for = $4)
            AND NOT (id = ANY($5::uuid[]))
            AND (body->>'prompt' IS NULL OR body->>'prompt' NOT IN
                 (SELECT seen.body->>'prompt' FROM content_item seen
                  WHERE seen.id = ANY($5::uuid[]) AND seen.body->>'prompt' IS NOT NULL))
          ORDER BY (personalised_for = $4) DESC, times_used ASC, created_at ASC
          LIMIT 1`,
    params: [input.skillCode, input.band, input.kind, input.studentId, input.excludeIds ?? []],
  });
  return rows[0] === undefined ? null : toContentItem(rows[0]);
}

async function markUsed(db: Queryable, id: string): Promise<void> {
  await runQuery({
    db,
    operation: 'contentItem.markUsed',
    sql: 'UPDATE content_item SET times_used = times_used + 1 WHERE id = $1',
    params: [id],
  });
}

async function listContentHashes(
  db: Queryable,
  input: Readonly<{ skillCode: string; band: string; kind: string }>,
): Promise<readonly string[]> {
  const { rows } = await runQuery<{ contentHash: string | null }>({
    db,
    operation: 'contentItem.listContentHashes',
    sql: `SELECT body->>'contentHash' AS "contentHash" FROM content_item
          WHERE skill_code = $1 AND band = $2 AND kind = $3 AND personalised_for IS NULL`,
    params: [input.skillCode, input.band, input.kind],
  });
  return rows.flatMap((row) => (row.contentHash === null ? [] : [row.contentHash]));
}

async function listPrompts(
  db: Queryable,
  input: ContentLookup,
  limit: number,
): Promise<readonly string[]> {
  const { rows } = await runQuery<{ prompt: string | null }>({
    db,
    operation: 'contentItem.listPrompts',
    sql: `SELECT body->>'prompt' AS prompt FROM content_item
          WHERE skill_code = $1 AND band = $2 AND kind = $3
            AND (personalised_for IS NULL OR personalised_for = $4)
          ORDER BY created_at DESC
          LIMIT $5`,
    params: [input.skillCode, input.band, input.kind, input.studentId, limit],
  });
  return rows.flatMap((row) => (row.prompt === null ? [] : [row.prompt]));
}

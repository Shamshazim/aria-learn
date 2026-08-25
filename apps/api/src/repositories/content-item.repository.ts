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

async function findEligible(db: Queryable, input: ContentLookup): Promise<ContentItem | null> {
  const { rows } = await runQuery<ContentItemRow>({
    db,
    operation: 'contentItem.findEligible',
    sql: `SELECT ${COLUMNS} FROM content_item
          WHERE skill_code = $1 AND band = $2 AND kind = $3
            AND (personalised_for IS NULL OR personalised_for = $4)
            AND NOT (id = ANY($5::uuid[]))
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

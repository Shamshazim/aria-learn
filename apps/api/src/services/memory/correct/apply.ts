import {
  NotFoundError,
  RejectedValueError,
  StaleCorrectionTargetError,
  ValidationError,
} from '@/errors';
import { sensitiveCategory } from '@/services/memory/decide/sensitivity';

import { judgementIn } from './judgement';

import type { ApplyInput, CorrectionResult, CorrectionStores } from './types';

/** A parent's word is final; a child's may be overruled by a parent later. */
const CONFIDENCE = { parent: 1, staff: 1, child: 0.8 } as const;

const UNCHANGED: CorrectionResult = {
  status: 'unchanged',
  correctionId: null,
  replacementId: null,
};

/**
 * One correction, written whole (P3-06, `master-plan.md` §4.2: "a correction supersedes the old
 * claim without erasing its audit history").
 *
 * The target is locked first, so a second correction to the same row waits and then finds it
 * no longer current — a 409 naming the row that is. A replacement is a new row backed by the
 * correction itself; a retraction expires the old one. Either way the old row stays, and a
 * `learner_fact_correction` row says who changed what, from what, to what and why.
 *
 * Must run inside a transaction: the stores passed in are bound to it.
 */
export async function applyCorrection(
  stores: CorrectionStores,
  input: ApplyInput,
): Promise<CorrectionResult> {
  const { request } = input;
  if (request.action === 'replace' && request.newValue === undefined) {
    throw new ValidationError('a replacement needs a new value');
  }
  if (request.action === 'retract' && request.newValue !== undefined) {
    throw new ValidationError('a retraction carries no new value');
  }
  if (request.newValue !== undefined) refuseValue(request.newValue.text);
  return request.targetKind === 'fact' ? correctFact(stores, input) : correctEpisode(stores, input);
}

/** Sensitive or judging text is refused before anything is written (422). */
function refuseValue(text: string): void {
  const category = sensitiveCategory(text);
  if (category !== null) throw new RejectedValueError('sensitive', `replacement is ${category}`);
  if (judgementIn(text)) throw new RejectedValueError('judgement', 'replacement judges the child');
}

async function correctFact(stores: CorrectionStores, input: ApplyInput): Promise<CorrectionResult> {
  const { request, studentId, now } = input;
  const locked = await stores.targets.lockFact(studentId, request.targetId, now);
  if (locked === null) throw new NotFoundError('correction target not found');
  if (!locked.current) await stale(stores, input);
  const old = locked.row;
  const correctionId = input.ids.next();
  if (request.newValue === undefined) {
    await stores.targets.expire('fact', old.id, now);
    await audit(stores, input, {
      id: correctionId,
      oldValue: old.value,
      replacementId: null,
      newValue: null,
    });
    return { status: 'applied', correctionId, replacementId: null };
  }
  if (old.value.text === request.newValue.text) return UNCHANGED;
  const replacement = await stores.facts.insertFact({
    studentId,
    kind: old.kind,
    value: { ...old.value, text: request.newValue.text },
    confidence: CONFIDENCE[input.author.correctedBy],
    firstObservedAt: old.firstObservedAt,
    lastConfirmedAt: now,
    expiresAt: null,
    sensitivity: old.sensitivity,
    modelShareable: old.modelShareable,
    evidence: [{ sourceKind: 'correction', sourceId: correctionId }],
  });
  await stores.targets.supersedeFact(old.id, replacement.id);
  await audit(stores, input, {
    id: correctionId,
    oldValue: old.value,
    replacementId: replacement.id,
    newValue: replacement.value,
  });
  return { status: 'applied', correctionId, replacementId: replacement.id };
}

async function correctEpisode(
  stores: CorrectionStores,
  input: ApplyInput,
): Promise<CorrectionResult> {
  const { request, studentId, now } = input;
  const locked = await stores.targets.lockEpisode(studentId, request.targetId, now);
  if (locked === null) throw new NotFoundError('correction target not found');
  if (!locked.current) await stale(stores, input);
  const old = locked.row;
  const oldValue = { summary: old.summary, kind: old.kind };
  const correctionId = input.ids.next();
  if (request.newValue === undefined) {
    await stores.targets.expire('episode', old.id, now);
    await audit(stores, input, { id: correctionId, oldValue, replacementId: null, newValue: null });
    return { status: 'applied', correctionId, replacementId: null };
  }
  if (old.summary === request.newValue.text) return UNCHANGED;
  // The same moments happened; only how they are described changed, so the evidence carries over.
  const [first, ...rest] = await stores.targets.episodeEvidence(old.id);
  if (first === undefined) throw new Error('episode has no evidence to carry over');
  const { id: _id, supersededBy: _supersededBy, ...kept } = old;
  const replacement = await stores.episodes.supersede(old.id, {
    ...kept,
    summary: request.newValue.text,
    evidence: [first, ...rest],
  });
  await audit(stores, input, {
    id: correctionId,
    oldValue,
    replacementId: replacement.id,
    newValue: { summary: replacement.summary, kind: replacement.kind },
  });
  return { status: 'applied', correctionId, replacementId: replacement.id };
}

async function stale(stores: CorrectionStores, input: ApplyInput): Promise<never> {
  const { targetKind, targetId } = input.request;
  const current = await stores.targets.currentOf(targetKind, targetId, input.now);
  throw new StaleCorrectionTargetError('correction target is no longer current', current);
}

async function audit(
  stores: CorrectionStores,
  input: ApplyInput,
  row: Readonly<{
    id: string;
    oldValue: Readonly<Record<string, unknown>>;
    replacementId: string | null;
    newValue: Readonly<Record<string, unknown>> | null;
  }>,
): Promise<void> {
  await stores.corrections.insert({
    ...input.author,
    id: row.id,
    studentId: input.studentId,
    targetKind: input.request.targetKind,
    targetId: input.request.targetId,
    replacementId: row.replacementId,
    oldValue: row.oldValue,
    newValue: row.newValue,
    reason: input.request.reason ?? null,
    at: input.now,
  });
}

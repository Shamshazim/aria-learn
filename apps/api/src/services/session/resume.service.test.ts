import { describe, expect, it } from 'vitest';

import { createResumeService } from '@/services/session/resume.service';
import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';

const SESSION: TutorSessionRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  studentId: '00000000-0000-4000-8000-000000000002',
  subject: 'mathematics',
  grade: '4',
  band: 'middle',
  startedAt: new Date('2026-09-01T10:00:00.000Z'),
  endedAt: null,
  endReason: null,
  plan: {},
  summary: null,
};

const ASK: Readonly<Record<string, unknown>> = {
  id: '00000000-0000-4000-8000-000000000010',
  at: '2026-09-01T10:00:01.000Z',
  protocolVersion: '1.1.0',
  sessionId: SESSION.id,
  kind: 'ASK',
  itemId: 'item-1',
  attempt: 1,
  expects: 'text',
  speech: { text: 'What is four plus three?' },
  display: [],
};

function record(
  seq: number,
  actor: 'aria' | 'child',
  kind: string,
  payload: SessionEventRecord['payload'],
): SessionEventRecord {
  return {
    id: `event-${String(seq)}`,
    sessionId: SESSION.id,
    seq,
    at: new Date(`2026-09-01T10:00:0${String(seq)}.000Z`),
    actor,
    kind,
    text: null,
    skillCode: null,
    correct: null,
    latencyMs: null,
    evidence: {},
    payload,
  };
}

/**
 * "Aria talks" records the sentences the realtime model said beside her moves. Those records
 * are not moves, and a session that has them must still resume: before this every session
 * start for that child failed with a 500.
 */
describe('resume', () => {
  it('replays the moves and skips the spoken sentences', async () => {
    const service = createResumeService({
      withDb: () => {
        throw new Error('unused');
      },
      append: () => Promise.reject(new Error('unused')),
      findLatestEvidence: () => Promise.resolve(null),
      list: () =>
        Promise.resolve([
          record(1, 'aria', 'ASK', ASK),
          record(2, 'aria', 'SPOKEN', { source: 'realtime', text: 'Hi Sam! Ready?' }),
          record(3, 'child', 'SPEECH_FINAL', { source: 'realtime', text: 'seven' }),
        ]),
    });
    const resumed = await service.rebuild(SESSION);
    expect(resumed.moves.map((move) => move.kind)).toEqual(['ASK']);
    expect(resumed.lastAppliedSeq).toBe(3);
  });
});

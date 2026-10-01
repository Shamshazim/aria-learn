import { describe, expect, it, vi } from 'vitest';

import { sessionIdSchema, type Band } from '@aria/shared';

import { ForbiddenError, NotFoundError } from '@/errors';
import type { ClientTimingObservation, ClientTimingOutcome } from '@/observability/client-metrics';
import { createTurnTimingService } from '@/services/telemetry/turn-timing.service';
import type { TutorSessionRecord } from '@/types/session';

const NOW = new Date('2026-09-30T09:00:00.000Z');
const STUDENT_ID = '00000000-0000-4000-8000-000000000101';
const OTHER_STUDENT_ID = '00000000-0000-4000-8000-000000000199';
const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000102');

describe('recording what the browser measured', () => {
  it('observes every timing in the report with the session band', async () => {
    const { service, observed } = build({ sessionBand: 'senior' });

    const result = await service.record(STUDENT_ID, {
      sessionId: SESSION_ID,
      timings: [
        { kind: 'audible_welcome', ms: 740 },
        { kind: 'interrupt_silence', ms: 180 },
      ],
    });

    expect(result).toEqual({ recorded: 2, dropped: 0 });
    expect(observed).toEqual([
      { kind: 'audible_welcome', ms: 740, band: 'senior', isSynthetic: false },
      { kind: 'interrupt_silence', ms: 180, band: 'senior', isSynthetic: false },
    ]);
  });

  /**
   * The two bands can disagree: a development grade override starts a session in another band,
   * and the latency being recorded belongs to the session that produced it.
   */
  it('prefers the session band over the child profile band', async () => {
    const { service, observed } = build({ sessionBand: 'early', studentBand: 'senior' });

    await service.record(STUDENT_ID, {
      sessionId: SESSION_ID,
      timings: [{ kind: 'audible_welcome', ms: 500 }],
    });

    expect(observed[0]?.band).toBe('early');
  });

  /**
   * `arrival_visible` is measured on the class picker, before the child has chosen a class, so
   * there is no session for the report to name — the same reason `sessionId` is optional on
   * every envelope in the protocol.
   */
  it('accepts a report with no session and labels it from the child profile', async () => {
    const { service, observed, findById } = build({ studentBand: 'middle' });

    const result = await service.record(STUDENT_ID, {
      timings: [{ kind: 'arrival_visible', ms: 420 }],
    });

    expect(result).toEqual({ recorded: 1, dropped: 0 });
    expect(observed[0]?.band).toBe('middle');
    expect(findById).not.toHaveBeenCalled();
  });

  it('reports what the observer refused, rather than claiming it landed', async () => {
    const { service } = build({ outcome: () => 'implausible' });

    const result = await service.record(STUDENT_ID, {
      sessionId: SESSION_ID,
      timings: [
        { kind: 'audible_welcome', ms: 1 },
        { kind: 'interrupt_silence', ms: 2 },
      ],
    });

    expect(result).toEqual({ recorded: 0, dropped: 2 });
  });

  it('marks the synthetic probe, so the observer can keep it out of the bars', async () => {
    const { service, observed } = build({ isSynthetic: true });

    await service.record(STUDENT_ID, {
      sessionId: SESSION_ID,
      timings: [{ kind: 'audible_welcome', ms: 300 }],
    });

    expect(observed[0]?.isSynthetic).toBe(true);
  });

  /**
   * The last interrupt of a session is measured while Aria is still talking and reported a
   * moment later, often after the child has left the page. Refusing an ended session would
   * lose the final turn of every session — the turn most likely to be the slow one.
   */
  it('accepts a report for a session that has already ended', async () => {
    const { service } = build({ ended: true });

    await expect(
      service.record(STUDENT_ID, {
        sessionId: SESSION_ID,
        timings: [{ kind: 'interrupt_silence', ms: 220 }],
      }),
    ).resolves.toEqual({ recorded: 1, dropped: 0 });
  });

  it("refuses a report filed against another child's session", async () => {
    const { service, observed } = build({ sessionStudentId: OTHER_STUDENT_ID });

    await expect(
      service.record(STUDENT_ID, {
        sessionId: SESSION_ID,
        timings: [{ kind: 'audible_welcome', ms: 300 }],
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(observed).toEqual([]);
  });

  it('refuses a report naming a session that does not exist', async () => {
    const { service } = build({ session: null });

    await expect(
      service.record(STUDENT_ID, {
        sessionId: SESSION_ID,
        timings: [{ kind: 'audible_welcome', ms: 300 }],
      }),
    ).rejects.toThrow(NotFoundError);
  });
});

function build(
  options: Readonly<{
    sessionBand?: Band;
    studentBand?: Band;
    sessionStudentId?: string;
    isSynthetic?: boolean;
    ended?: boolean;
    session?: TutorSessionRecord | null;
    outcome?: () => ClientTimingOutcome;
  }> = {},
) {
  const observed: ClientTimingObservation[] = [];
  const session =
    options.session === null
      ? null
      : sessionRecord({
          band: options.sessionBand ?? 'middle',
          studentId: options.sessionStudentId ?? STUDENT_ID,
          ended: options.ended ?? false,
        });
  const findById = vi.fn(() => Promise.resolve(session));
  const service = createTurnTimingService({
    sessions: { findById },
    students: {
      requireById: () =>
        Promise.resolve({
          band: options.studentBand ?? 'middle',
          isSynthetic: options.isSynthetic ?? false,
        }),
    },
    observe: (observation) => {
      observed.push(observation);
      return options.outcome?.() ?? 'recorded';
    },
  });
  return { service, observed, findById };
}

function sessionRecord(
  input: Readonly<{ band: Band; studentId: string; ended: boolean }>,
): TutorSessionRecord {
  return {
    id: SESSION_ID,
    studentId: input.studentId,
    subject: 'math',
    grade: '4',
    band: input.band,
    startedAt: NOW,
    endedAt: input.ended ? NOW : null,
    endReason: input.ended ? 'complete' : null,
    plan: {},
    summary: null,
  };
}

import type { TutorInputEvent, TutorMove } from '@aria/shared';
import { ENGAGEMENT_NOTED, type TutorHarness, type TutorPorts } from '@aria/tutor';

import type { Logger } from '@/lib/logger';
import type { ApiModelContext } from '@/services/content/turn-content.service';

type EngagementEvent = Extract<TutorInputEvent, { kind: 'ENGAGEMENT_SIGNAL' }>;

/**
 * A client's engagement signal (P3-05): a hidden tab, a child gone idle, a vocal cue.
 *
 * Most change nothing a child should see. Those are written to the log — so the next turn's
 * estimator can read them — and answered with no move at all, rather than a sentence invented
 * to fill the gap. One that tips the state into a check-in or an adaptation runs as a turn.
 *
 * A `vocal_cue` is accepted only when the parent consented to vocal cues; otherwise it is
 * dropped before it reaches the estimator, and the drop is logged.
 */
export async function handleEngagementSignal(
  input: Readonly<{
    event: EngagementEvent;
    studentId: string;
    harness: TutorHarness<ApiModelContext>;
    commit: TutorPorts<ApiModelContext>['commit'];
    vocalCuesAllowed?: ((studentId: string) => Promise<boolean>) | undefined;
    logger: Pick<Logger, 'info'>;
  }>,
): Promise<readonly TutorMove[]> {
  const { event } = input;
  if (event.signal === 'vocal_cue' && !(await consented(input))) {
    input.logger.info(
      { event: 'engagement.vocal_cue_dropped', sessionId: event.sessionId },
      'Dropped a vocal cue: no consent to vocal cues is recorded for this child',
    );
    return [];
  }
  const draft = await input.harness.speculate(event);
  const { decision, plan, context } = draft.draft;
  if (!decision.reasons.includes(ENGAGEMENT_NOTED)) return input.harness.finalize(event, draft);
  await input.commit({
    event,
    decision,
    plan,
    moves: [],
    privateEvidence: {},
    spans: {},
    practisedSkillCode: context.session.skillCode,
  });
  return [];
}

async function consented(
  input: Readonly<{
    studentId: string;
    vocalCuesAllowed?: ((id: string) => Promise<boolean>) | undefined;
  }>,
): Promise<boolean> {
  return (await input.vocalCuesAllowed?.(input.studentId)) ?? false;
}

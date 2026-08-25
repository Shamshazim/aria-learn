import type { TutorMove } from '@aria/shared';

import type { ArrivalContext } from '@/services/arrival/context.loader';
import { WELCOME_COPY } from '@/services/arrival/templates/welcome.data';
import type { MoveFactory } from '@/services/moves/move-factory';

const LONG_ABSENCE_MS = 14 * 24 * 3_600_000;

export function composeWelcome(
  factory: MoveFactory,
  context: ArrivalContext,
): readonly [TutorMove, TutorMove] {
  const { text, basedOn } = welcomeText(context);
  const welcome = factory.make({
    kind: 'WELCOME',
    speech: { text },
    basedOn,
    display: [{ type: 'text', body: text, markdown: false }],
    expects: 'none',
  });
  const checkIn = factory.make({
    kind: 'CHECK_IN',
    speech: { text: WELCOME_COPY.checkIn },
    about: 'difficulty',
    display: [
      {
        type: 'choices',
        options: [
          { id: 'easy', label: 'Easy start' },
          { id: 'challenge', label: 'Challenge me' },
        ],
      },
    ],
    expects: 'choice',
  });
  return [welcome, checkIn];
}

export function welcomeKind(context: ArrivalContext): string {
  return welcomeText(context).welcomeKind;
}

function welcomeText(context: ArrivalContext): Readonly<{
  text: string;
  basedOn: readonly string[];
  welcomeKind: string;
}> {
  if (context.lastSession === null) {
    return {
      text: WELCOME_COPY.first(context.student.displayName),
      basedOn: [],
      welcomeKind: 'first',
    };
  }
  const age =
    context.now.getTime() - (context.lastSession.endedAt?.getTime() ?? context.now.getTime());
  const supportedFact = context.facts.find((fact) => fact.kind === 'practice_persistence');
  if (age >= LONG_ABSENCE_MS || (context.evidence === null && supportedFact === undefined)) {
    return {
      text: WELCOME_COPY.longAbsence(context.student.displayName),
      basedOn: [],
      welcomeKind: 'long_absence',
    };
  }
  if (supportedFact !== undefined) {
    return {
      text: WELCOME_COPY.recent(context.student.displayName),
      basedOn: [supportedFact.id],
      welcomeKind: 'evidence_fact',
    };
  }
  if (context.evidence === null) {
    return {
      text: WELCOME_COPY.longAbsence(context.student.displayName),
      basedOn: [],
      welcomeKind: 'long_absence',
    };
  }
  return {
    text: WELCOME_COPY.recent(context.student.displayName),
    basedOn: [context.evidence.id],
    welcomeKind: 'evidence_recent',
  };
}

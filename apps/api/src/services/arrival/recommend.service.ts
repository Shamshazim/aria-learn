import type { TutorMove } from '@aria/shared';

import type { ArrivalContext } from '@/services/arrival/context.loader';
import type { MoveFactory } from '@/services/moves/move-factory';

export function recommend(
  factory: MoveFactory,
  context: ArrivalContext,
): Readonly<{ move: TutorMove; subjectId: string }> | null {
  const skill = context.dueSkills.find((candidate) => candidate.band === context.student.band);
  if (skill === undefined) return null;
  const subjectId = skill.subject === 'arithmetic' ? 'math' : skill.subject;
  const text = `${subjectLabel(subjectId)} has a short practice step ready.`;
  return {
    subjectId,
    move: factory.make({
      kind: 'RECOMMEND',
      subjectId,
      grade: context.student.grade,
      reason: `${subjectLabel(subjectId)} practice is due.`,
      speech: { text },
      display: [{ type: 'text', body: text, markdown: false }],
      expects: 'choice',
    }),
  };
}

function subjectLabel(subjectId: string): string {
  return subjectId.charAt(0).toUpperCase() + subjectId.slice(1);
}

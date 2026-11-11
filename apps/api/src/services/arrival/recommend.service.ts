import type { TutorMove } from '@aria/shared';

import type { ArrivalContext } from '@/services/arrival/context.loader';
import { subjectIdFor, subjectName } from '@/services/arrival/subject-names';
import type { MoveFactory } from '@/services/moves/move-factory';

export function recommend(
  factory: MoveFactory,
  context: ArrivalContext,
): Readonly<{ move: TutorMove; subjectId: string }> | null {
  // P3-04: the scheduler has already ranked goals, overdue and shaky skills ahead of anything
  // new, and preferred the child's band and grade for that; the top of the list is the answer.
  const skill = context.dueSkills[0];
  if (skill === undefined) return null;
  const subjectId = subjectIdFor(skill.subject);
  // Short words on purpose: "Math Adventures" already spends the early band's syllable budget.
  const text = `Time for ${subjectName(subjectId)}. I have a short step ready for you.`;
  return {
    subjectId,
    move: factory.make({
      kind: 'RECOMMEND',
      subjectId,
      grade: context.student.grade,
      reason: `${subjectName(subjectId)} practice is due.`,
      speech: { text },
      display: [{ type: 'text', body: text, markdown: false }],
      expects: 'choice',
    }),
  };
}

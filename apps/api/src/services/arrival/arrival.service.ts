import type { TutorMove } from '@aria/shared';

import type { QualityGate } from '@/quality';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import type { ArrivalContext } from '@/services/arrival/context.loader';
import { recommend } from '@/services/arrival/recommend.service';
import { composeWelcome, welcomeKind } from '@/services/arrival/welcome.composer';
import type { MoveFactory } from '@/services/moves/move-factory';

export type ArrivalResult = Readonly<{
  arrivalId: string;
  moves: readonly TutorMove[];
  recommendedSubject: string | null;
  student: Readonly<{
    grade: ArrivalContext['student']['grade'];
    band: ArrivalContext['student']['band'];
  }>;
}>;

export type ArrivalService = Readonly<{ arrive(studentId: string): Promise<ArrivalResult> }>;

export function createArrivalService(deps: {
  load(studentId: string): Promise<ArrivalContext>;
  arrivals: ArrivalEventRepository;
  moves: MoveFactory;
  gate: QualityGate;
  nowMs(): number;
}): ArrivalService {
  return { arrive: (studentId: string) => arrive(deps, studentId) };
}

async function arrive(
  deps: Parameters<typeof createArrivalService>[0],
  studentId: string,
): Promise<ArrivalResult> {
  const started = deps.nowMs();
  const context = await deps.load(studentId);
  const opening = composeWelcome(deps.moves, context);
  const recommendation = recommend(deps.moves, context);
  const moves = recommendation === null ? opening : [...opening, recommendation.move];
  for (const move of moves)
    gateMove(deps.gate, move, context.student.band, context.student.displayName);
  const record = await deps.arrivals.insert({
    studentId,
    welcomeKind: welcomeKind(context),
    recommendation: recommendation === null ? null : { subjectId: recommendation.subjectId },
    accepted: null,
    latencyMs: Math.max(0, deps.nowMs() - started),
  });
  return {
    arrivalId: record.id,
    moves,
    recommendedSubject: recommendation?.subjectId ?? null,
    student: { grade: context.student.grade, band: context.student.band },
  };
}

function gateMove(
  gate: QualityGate,
  move: TutorMove,
  band: ArrivalContext['student']['band'],
  displayName: string,
): void {
  const texts = [
    ...(move.speech === null ? [] : [move.speech.text]),
    ...move.display.flatMap((item) =>
      item.type === 'text'
        ? [item.body]
        : item.type === 'choices'
          ? item.options.map((o) => o.label)
          : [],
    ),
  ];
  for (const text of texts) {
    const gateText = text.replaceAll(displayName, 'helper');
    const result = gate({
      id: move.id,
      kind: 'text',
      band,
      childText: gateText,
      factual: false,
      grounding: 'reviewed-bank',
    });
    if (result.verdict !== 'pass') {
      const reasons = result.reasons.map((reason) => `${reason.check}:${reason.code}`).join(',');
      throw new Error(`Arrival content failed the child-facing quality gate (${reasons})`);
    }
  }
}

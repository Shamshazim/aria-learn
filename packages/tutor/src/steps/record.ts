import type { CommittedTurn, TutorPorts } from '../types';

export function recordTurn<TModelContext>(
  port: TutorPorts<TModelContext>['commit'],
  turn: CommittedTurn,
): Promise<void> {
  return port(turn);
}

import type { PlannedTurn, ResolvedContent, TutorPorts } from '../types';

export function resolveContent<TModelContext>(
  port: TutorPorts<TModelContext>['resolveContent'],
  turn: PlannedTurn<TModelContext>,
  signal?: AbortSignal,
): Promise<ResolvedContent> {
  return port(turn, signal);
}

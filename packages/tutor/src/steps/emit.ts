import type { TutorMove } from '@aria/shared';

import type { TutorPorts } from '../types';

export function emitMoves<TModelContext>(
  port: TutorPorts<TModelContext>['emit'],
  moves: readonly TutorMove[],
): Promise<readonly TutorMove[]> {
  return port(moves);
}

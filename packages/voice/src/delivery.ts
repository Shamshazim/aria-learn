import type { TutorMove } from '@aria/shared';

export type DeliveredMove = Readonly<{ move: TutorMove; duplicate: boolean }>;

export function createMoveInbox(initialAcknowledgedSeq = 0): Readonly<{
  receive(move: TutorMove): DeliveredMove;
  acknowledge(serverSeq: number): void;
  acknowledgedSeq(): number;
  nextEpoch(): number;
}> {
  const ids = new Set<string>();
  let acknowledged = initialAcknowledgedSeq;
  let epoch = 0;
  return {
    receive: (move) => {
      const duplicate =
        ids.has(move.id) || (move.serverSeq !== undefined && move.serverSeq <= acknowledged);
      ids.add(move.id);
      return { move, duplicate };
    },
    acknowledge: (serverSeq) => {
      acknowledged = Math.max(acknowledged, serverSeq);
    },
    acknowledgedSeq: () => acknowledged,
    nextEpoch: () => ++epoch,
  };
}

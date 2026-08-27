import type { MoveKind } from '@aria/shared';

/**
 * The silence escalation ladder (P2H-01). Pure: the count of consecutive `SILENCE` events
 * since the child last did anything maps to what Aria does next. Every rung changes the
 * approach; nothing here repeats, and the ladder always ends.
 */
export type SilenceRung = Readonly<{
  rung: 1 | 2 | 3 | 4;
  kind: MoveKind;
  approach: string;
  reason: string;
  terminal: boolean;
}>;

export function silenceRung(consecutiveSilences: number): SilenceRung {
  const count = Math.max(1, consecutiveSilences);
  if (count === 1) {
    return {
      rung: 1,
      kind: 'SAY',
      approach: 'reask-short',
      reason: 'Silence rung 1: shorter re-ask.',
      terminal: false,
    };
  }
  if (count === 2) {
    return {
      rung: 2,
      kind: 'HINT',
      approach: 'single-nudge',
      reason: 'Silence rung 2: one concrete nudge.',
      terminal: false,
    };
  }
  if (count === 3) {
    return {
      rung: 3,
      kind: 'SAY',
      approach: 'check-in',
      reason: 'Silence rung 3: check the child is still there.',
      terminal: false,
    };
  }
  return {
    rung: 4,
    kind: 'BREAK',
    approach: 'attention',
    reason: 'Silence rung 4: end gently.',
    terminal: true,
  };
}

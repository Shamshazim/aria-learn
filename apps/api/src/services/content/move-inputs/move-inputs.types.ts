import type { MoveClaims } from '@/quality';

/**
 * What a move is given to be specific *about* (P2H-11).
 *
 * `lines` go into the prompt as facts, one per line, in the order a tutor would think of them.
 * `claims` go into the gate, and are the same evidence read as a permission: the model may
 * name any of these and nothing else. Building both in one place is the point — a prompt that
 * offered a strategy the gate then refused would fail every time.
 */
export type MoveInputs = Readonly<{
  lines: readonly string[];
  claims?: MoveClaims;
}>;

export const NO_MOVE_INPUTS: MoveInputs = { lines: [] };

import type { Skill, VisualContent, VisualKind } from '@aria/shared';

import { visualParams } from '@/curriculum/visuals/visual-params';
import type { ArithmeticProblem } from '@/quality/arithmetic';

export type VisualRequest = Readonly<{
  kind: VisualKind;
  /** What the child is told they are looking at; the renderer shows it and a screen reader reads it. */
  caption: string;
  problem: ArithmeticProblem | null;
}>;

/**
 * Turns a visual kind into the `SHOW` payload the protocol already carries (P2H-10).
 *
 * The protocol has had `visual` since P0-02 and nothing built one. These builders are the
 * missing half: one per kind, each deriving its parameters from the item the child is actually
 * working on, so an early-band reteach shows this problem rather than a stock picture.
 */
export function buildVisual(request: VisualRequest): VisualContent {
  return {
    type: 'visual',
    visual: request.kind,
    params: visualParams(request.kind, request.problem),
    alt: request.caption,
  };
}

/**
 * The visual this skill is shown with, or nothing.
 *
 * Reading and writing skills declare no kinds, and that is an answer rather than a gap: a
 * ten-frame does not help a child hear a rhyme, and showing one would be noise.
 */
export function visualsFor(skill: Skill | null): readonly VisualKind[] {
  return skill?.visualKinds ?? [];
}

/** The kind to reach for when a move asks for a visual model and does not care which. */
export function firstVisualFor(skill: Skill | null): VisualKind | null {
  return visualsFor(skill)[0] ?? null;
}

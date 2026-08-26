import type { Band, MoveKind } from '@aria/shared';

import type { QualityGate } from '@/quality';
import { APPROACH_FALLBACKS, MOVE_FALLBACKS } from '@/services/content/fallback/fallback.data';
import type { BandVariants, FallbackParameters } from '@/services/content/fallback/fallback.types';

/** How many (session, move) pairs the picker remembers before it starts forgetting the oldest. */
const TRACKED_KEYS = 500;
const PARAMETER = /\{(name|skillName|answer)\}/gu;

export type FallbackRequest = Readonly<{
  sessionId: string;
  move: string;
  approach: string;
  band: Band;
  parameters: FallbackParameters;
}>;

export type FallbackPicker = Readonly<{ pick(request: FallbackRequest): string }>;

/**
 * Chooses the static sentence, and never the one it chose last time (P2H-11).
 *
 * Rotation rather than randomness: it is deterministic, so a session can be replayed exactly,
 * it cannot repeat, and it walks the whole set before coming back round. Randomness would need
 * injecting anyway, and would still say the same thing twice sooner or later.
 *
 * Every sentence goes through the gate on the way out. They are reviewed, so this should never
 * fire — but "reviewed once, a year ago, before the band thresholds moved" is exactly the case
 * where a child would otherwise hear it.
 */
export function createFallbackPicker(deps: Readonly<{ gate: QualityGate }>): FallbackPicker {
  const lastUsed = new Map<string, number>();
  return {
    pick: (request) => {
      const variants = eligible(request);
      // Keyed on the move rather than the approach: two RETEACH moves in a row are two
      // repetitions to a child however differently the policy justified them.
      const key = `${request.sessionId}:${request.move}`;
      const index = nextIndex(lastUsed, key, variants.length);
      const chosen = variants[index] ?? variants[0];
      if (chosen === undefined) throw new Error(`No fallback text for ${request.move}`);
      return gated(deps.gate, fill(chosen, request.parameters), request.band);
    },
  };
}

/**
 * The variants this turn could actually say.
 *
 * A variant naming a parameter we do not have is dropped rather than filled with a blank: a
 * child hearing "Yes, is right" learns that nobody is really listening.
 */
function eligible(request: FallbackRequest): readonly string[] {
  const variants = variantsFor(request.move, request.approach)[request.band];
  const usable = variants.filter((variant) =>
    parametersOf(variant).every((parameter) => known(request.parameters, parameter)),
  );
  return usable.length === 0
    ? variants.filter((variant) => parametersOf(variant).length === 0)
    : usable;
}

function variantsFor(move: string, approach: string): BandVariants {
  const byApproach = APPROACH_FALLBACKS[`${move}:${approach}`];
  if (byApproach !== undefined) return byApproach;
  if (!isMoveKind(move)) throw new Error(`No fallback text for move ${move}`);
  return MOVE_FALLBACKS[move];
}

function isMoveKind(value: string): value is MoveKind {
  return Object.hasOwn(MOVE_FALLBACKS, value);
}

function parameterValue(parameters: FallbackParameters, name: string): string | undefined {
  if (name === 'name') return parameters.name;
  if (name === 'skillName') return parameters.skillName;
  return parameters.answer;
}

function parametersOf(variant: string): readonly string[] {
  return [...variant.matchAll(PARAMETER)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

function known(parameters: FallbackParameters, name: string): boolean {
  const value = parameterValue(parameters, name);
  return value !== undefined && value.trim() !== '';
}

function nextIndex(lastUsed: Map<string, number>, key: string, length: number): number {
  const previous = lastUsed.get(key);
  const index = previous === undefined ? 0 : (previous + 1) % length;
  lastUsed.delete(key);
  lastUsed.set(key, index);
  if (lastUsed.size > TRACKED_KEYS) {
    const oldest = lastUsed.keys().next();
    if (!(oldest.done ?? false)) lastUsed.delete(oldest.value);
  }
  return index;
}

function fill(variant: string, parameters: FallbackParameters): string {
  return variant.replaceAll(
    PARAMETER,
    (match: string, name: string) => parameterValue(parameters, name) ?? match,
  );
}

function gated(gate: QualityGate, text: string, band: Band): string {
  const verdict = gate({
    id: 'fallback-text',
    kind: 'text',
    band,
    childText: text,
    factual: false,
    grounding: 'reviewed-bank',
  });
  if (verdict.verdict !== 'pass') {
    throw new Error(`Reviewed fallback text failed the quality gate: ${text}`);
  }
  return text;
}

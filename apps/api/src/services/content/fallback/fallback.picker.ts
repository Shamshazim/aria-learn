import type { Band, MoveKind } from '@aria/shared';

import type { QualityGate } from '@/quality';
import { APPROACH_FALLBACKS, MOVE_FALLBACKS } from '@/services/content/fallback/fallback.data';
import type { BandVariants, FallbackParameters } from '@/services/content/fallback/fallback.types';

/** How many (session, move) pairs the picker remembers before it starts forgetting the oldest. */
const TRACKED_KEYS = 500;
const PARAMETER = /\{(name|skillName|answer)\}/gu;

export type FallbackRequest = Readonly<{
  sessionId: string;
  move: MoveKind;
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
 * What it remembers is the *sentence*, not its index. The eligible list changes shape between
 * turns — a variant naming the answer key drops out of a turn that has no answer key — so an
 * index remembered against one list points somewhere else in the next, and two turns running
 * can land on the same words.
 *
 * The memory is per instance and per process. A second API instance rotates independently,
 * which means a child whose turns land on different instances can hear a repeat; the fix for
 * that is the fallback not firing at all, which is what `fallback_used_total == 0` is for.
 *
 * Every sentence goes through the gate on the way out. They are reviewed, so this should never
 * fire — but "reviewed once, a year ago, before the band thresholds moved" is exactly the case
 * where a child would otherwise hear it.
 */
export function createFallbackPicker(deps: Readonly<{ gate: QualityGate }>): FallbackPicker {
  const lastSaid = new Map<string, string>();
  return {
    pick: (request) => {
      const variants = eligible(request);
      // Keyed on the move rather than the approach: two RETEACH moves in a row are two
      // repetitions to a child however differently the policy justified them.
      const key = `${request.sessionId}:${request.move}`;
      const chosen = nextVariant(variants, lastSaid.get(key));
      if (chosen === undefined) throw new Error(`No fallback text for ${request.move}`);
      remember(lastSaid, key, chosen);
      return gated(deps.gate, fill(chosen, request.parameters), request.band);
    },
  };
}

/** The one after whatever was said last, wrapping round, or the first if nothing was. */
function nextVariant(variants: readonly string[], last: string | undefined): string | undefined {
  if (last === undefined) return variants[0];
  const previous = variants.indexOf(last);
  if (previous === -1) return variants.find((variant) => variant !== last) ?? variants[0];
  return variants[(previous + 1) % variants.length];
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

function variantsFor(move: MoveKind, approach: string): BandVariants {
  return APPROACH_FALLBACKS[`${move}:${approach}`] ?? MOVE_FALLBACKS[move];
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

/** Newest last, oldest first, so the map forgets the sessions nobody is in any more. */
function remember(lastSaid: Map<string, string>, key: string, chosen: string): void {
  lastSaid.delete(key);
  lastSaid.set(key, chosen);
  if (lastSaid.size > TRACKED_KEYS) {
    const oldest = lastSaid.keys().next();
    if (!(oldest.done ?? false)) lastSaid.delete(oldest.value);
  }
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

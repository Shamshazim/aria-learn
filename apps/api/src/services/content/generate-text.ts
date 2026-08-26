import type { Band } from '@aria/shared';
import type { PlannedTurn } from '@aria/tutor';

import type { AiClient } from '@/ai';
import type { FallbackReason } from '@/observability/content-metrics';
import type { MoveClaims, QualityGate } from '@/quality';
import { registerFailures } from '@/quality/checks/level/register';
import type { MoveInputs } from '@/services/content/move-inputs';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import { respondInput } from '@/services/content/turn-response';

/**
 * The outcome of trying to say something in Aria's own words (P2H-02, P2H-03).
 *
 * A failure carries *why*, because the three ways generation can fail need three different
 * responses from us: turn the model on, wait out an outage, or fix a prompt.
 */
export type GenerationOutcome =
  | Readonly<{
      kind: 'generated';
      text: string;
      promptName: string;
      promptVersion: string;
    }>
  | Readonly<{ kind: 'fallback'; reason: FallbackReason }>;

const MAX_ATTEMPTS = 2;

/** Generates child-facing text, regenerating once if the first candidate fails the gate. */
export async function generateGatedText(
  deps: Readonly<{ ai: AiClient | null; gate: QualityGate }>,
  turn: PlannedTurn<ApiModelContext>,
  inputs: MoveInputs,
  signal?: AbortSignal,
): Promise<GenerationOutcome> {
  if (deps.ai === null) return { kind: 'fallback', reason: 'ai_disabled' };
  let lastReason: FallbackReason = 'gate_failed';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = await generateOnce(deps.ai, turn, inputs, signal);
    if (candidate === null) {
      lastReason = 'provider_error';
      continue;
    }
    // P2H-11: a praise that named a strategy nobody saw is regenerated here, not shipped.
    if (isSpeakable(deps.gate, candidate.text, turn.context.session.band, inputs)) return candidate;
    lastReason = 'gate_failed';
  }
  return { kind: 'fallback', reason: lastReason };
}

async function generateOnce(
  ai: AiClient,
  turn: PlannedTurn<ApiModelContext>,
  inputs: MoveInputs,
  signal?: AbortSignal,
): Promise<Extract<GenerationOutcome, { kind: 'generated' }> | null> {
  try {
    const result = await ai.run('respond', respondInput(turn, inputs), {
      studentId: turn.context.session.studentId,
      ...(signal === undefined ? {} : { signal }),
    });
    return {
      kind: 'generated',
      text: result.data.text,
      promptName: result.metadata.promptName,
      promptVersion: result.metadata.promptVersion,
    };
  } catch {
    throwIfAborted(signal);
    return null;
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new DOMException('Tutor turn aborted', 'AbortError');
}

/**
 * The gate plus the band register (P2H-03).
 *
 * The register rules apply here and not inside the gate because they are about Aria *speaking*:
 * a practice item with three short instructions is fine for a six-year-old, and a reviewed
 * safeguarding response is deliberately longer than two sentences. Only model-written prose is
 * held to "calm and adult" or "at most two sentences".
 */
function isSpeakable(gate: QualityGate, text: string, band: Band, inputs: MoveInputs): boolean {
  const claims = inputs.claims;
  return (
    registerFailures(text, band).length === 0 &&
    passesGate(gate, text, band, { generated: true, ...(claims === undefined ? {} : { claims }) })
  );
}

/** Whether the text is generated, and what it is allowed to claim (P2H-11). */
export type GateOptions = Readonly<{ generated?: boolean; claims?: MoveClaims }>;

export function passesGate(
  gate: QualityGate,
  text: string,
  band: Band,
  options: GateOptions = {},
): boolean {
  const claims = options.claims;
  return (
    gate({
      id: 'turn-text',
      kind: 'text',
      band,
      childText: text,
      factual: false,
      grounding: options.generated === false ? 'reviewed-bank' : 'unsupported',
      ...(claims === undefined ? {} : { claims }),
    }).verdict === 'pass'
  );
}

export function requiredGatedText(
  gate: QualityGate,
  text: string,
  band: Band,
  options: GateOptions = { generated: false },
): string {
  if (!passesGate(gate, text, band, options))
    throw new Error('Child-facing turn content failed the quality gate');
  return text;
}

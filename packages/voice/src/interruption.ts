const BACKCHANNELS = new Set(['mm-hm', 'mhm', 'uh-huh', 'yeah', 'ok', 'okay']);

export type InterruptDecision =
  | Readonly<{ kind: 'confirm'; generationId: string }>
  | Readonly<{ kind: 'backchannel' }>
  | Readonly<{ kind: 'restore' }>;

export function decideInterruption(
  input: Readonly<{
    generationId: string;
    speechDurationMs: number;
    transcript: string;
  }>,
): InterruptDecision {
  const normalized = input.transcript.trim().toLocaleLowerCase();
  if (BACKCHANNELS.has(normalized)) return { kind: 'backchannel' };
  if (input.speechDurationMs >= 300 && normalized.split(/\s+/u).some(Boolean)) {
    return { kind: 'confirm', generationId: input.generationId };
  }
  return { kind: 'restore' };
}

export function resumeAtSentence(
  input: Readonly<{
    moveId: string;
    sentence: string;
  }>,
): Readonly<{ resumeOf: string; text: string }> {
  return { resumeOf: input.moveId, text: `So — ${input.sentence.trim()}` };
}

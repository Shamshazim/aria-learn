import { applyPronunciation, type PronunciationHints } from '@aria/voice';

import { renderProsody } from '@/voice/vendor';

/**
 * P2H-08: the last thing that happens to a sentence before it becomes sound.
 *
 * A session builds one of these and every path to the child's ears goes through it, so a
 * name is respelled and a prosody token is rendered or dropped exactly once, wherever the
 * sentence came from — a streamed segment, a whole move, or a replay.
 */
export type SpeechRenderer = Readonly<{ render(spoken: string): string }>;

/** Reserved: these words appear inside prosody tokens, so a hint may not rewrite them. */
const RESERVED = new Set(['emphasis', 'pause', 'pause:short']);

export function createSpeechRenderer(
  input: Readonly<{ ttsModel: string; hints: PronunciationHints }>,
): SpeechRenderer {
  const hints = Object.fromEntries(
    Object.entries(input.hints).filter(([written]) => !RESERVED.has(written.toLowerCase())),
  );
  return { render: (spoken) => renderProsody(applyPronunciation(spoken, hints), input.ttsModel) };
}

import { failedMany, passed } from '@/quality/checks/check-result';
import { childFacingText } from '@/quality/checks/content-text';
import { BANNED_WORDS } from '@/quality/checks/level/banned.data';
import { measureReadability, readabilityFailures } from '@/quality/checks/level/readability';
import type { GateCheckResult, GateFailureReason, GateInput } from '@/quality/gate.types';

/**
 * Level check (P2H-02): sentence length + readability score + banned list.
 *
 * The former per-band vocabulary whitelist rejected almost every natural sentence a model
 * writes, so children heard static fallbacks. Readability measures how the text reads instead
 * of which words it uses; the wordlists remain for decodable-text work (P4-02).
 */
export function checkLevel(input: GateInput): GateCheckResult {
  // Decodable text is a phonics artefact, not a readability one; a grade score cannot judge it.
  // Refusing here means no decodable item can ever reach a child through the readability path.
  if (input.kind === 'decodable') {
    return failedMany('level', [
      {
        code: 'decodable_unsupported',
        message: 'Decodable text must be checked against the phonics wordlist, not readability.',
      },
    ]);
  }
  const text = childFacingText(input);
  const reasons: Omit<GateFailureReason, 'check'>[] = [
    ...readabilityFailures(measureReadability(text), input.band),
    ...bannedFailures(text),
  ];
  return reasons.length === 0 ? passed('level') : failedMany('level', reasons);
}

function bannedFailures(text: string): readonly Omit<GateFailureReason, 'check'>[] {
  const lower = text.toLowerCase();
  const hits = BANNED_WORDS.filter((word) =>
    new RegExp(`(?<![a-z])${word}(?![a-z])`, 'u').test(lower),
  );
  return hits.length === 0
    ? []
    : [{ code: 'banned_word', message: `Text contains a banned word: ${hits.join(', ')}` }];
}

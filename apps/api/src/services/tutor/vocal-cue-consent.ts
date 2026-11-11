import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';

/**
 * The consent a `vocal_cue` needs (P3-05, P2-14): a granted voice consent that names vocal
 * cues among its processing categories. The parent consent screens do not offer that category
 * yet, so for now every vocal cue is dropped — which is the safe way round.
 */
export const VOCAL_CUES_CATEGORY = 'vocal_cues';

export function createVocalCueConsent(
  consents: Pick<VoiceConsentRepository, 'findGranted'>,
): (studentId: string) => Promise<boolean> {
  return async (studentId) => {
    const consent = await consents.findGranted(studentId);
    return consent?.processorCategories.includes(VOCAL_CUES_CATEGORY) ?? false;
  };
}

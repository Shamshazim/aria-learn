import type { Band } from '@aria/shared';

/**
 * P2H-08: which voice a child hears, and how it is asked to speak.
 *
 * Aria is one character in three registers, not three characters. A five-year-old needs the
 * words slower and the articulation clearer; a thirteen-year-old needs an adult who is not
 * performing at them. The criteria live here as data so the listening review in
 * `dev-docs/voice-review.md` can change a voice id without touching the session code.
 *
 * The ids themselves are configuration, not code: the provider decision (P2-01) is still
 * provisional, so `voice-review.md` records which candidate was reviewed and the environment
 * says which one is in use. A band with no id is a boot failure, never a silent default.
 */
export type VoiceRegister = 'warm' | 'neutral' | 'calm';
export type PitchHint = 'bright' | 'neutral' | 'low';

export type VoiceProfile = Readonly<{
  voiceId: string;
  /** Speaking rate as a multiplier of the vendor's natural pace. */
  rate: number;
  pitchHint: PitchHint;
  register: VoiceRegister;
}>;

/** What the review is asked to judge, per band. Ids come from configuration. */
export const VOICE_CRITERIA: Readonly<Record<Band, Omit<VoiceProfile, 'voiceId'>>> = {
  early: { rate: 0.92, pitchHint: 'bright', register: 'warm' },
  middle: { rate: 1, pitchHint: 'neutral', register: 'neutral' },
  senior: { rate: 1, pitchHint: 'low', register: 'calm' },
};

export type BandVoiceIds = Readonly<Record<Band, string>>;

export function voiceFor(band: Band, ids: BandVoiceIds): VoiceProfile {
  const voiceId = ids[band];
  if (voiceId.trim() === '') throw new Error(`No voice is configured for the ${band} band`);
  return { ...VOICE_CRITERIA[band], voiceId };
}

import { stripProsody, type ProsodyMarker } from '@aria/voice';

/**
 * P2H-08: the one place a text-to-speech vendor's own vocabulary exists.
 *
 * `spokenForm` writes prosody as vendor-neutral tokens. Each engine renders what it can and
 * the rest is removed — a child hearing the words "open bracket pause" is a worse failure
 * than a missing beat, so an unknown engine is treated as one that renders nothing.
 *
 * Keyed by the vendor prefix of a LiveKit inference model id ("fishaudio/s2.1-pro").
 */
type Vendor = Readonly<{
  supports: ReadonlySet<ProsodyMarker>;
  emphasis(word: string): string;
  pause(): string;
  /** The provider's own name for a speaking-rate multiplier, if it has one. */
  rateOption: string | null;
}>;

const PLAIN = {
  supports: new Set<ProsodyMarker>(),
  emphasis: (word: string) => word,
  pause: () => '',
} as const;

const SSML = {
  supports: new Set<ProsodyMarker>(['emphasis', 'pause']),
  emphasis: (word: string) => `<emphasis level="moderate">${word}</emphasis>`,
  pause: () => '<break time="300ms"/>',
} as const;

/**
 * ElevenLabs honours `<break>` on its own and nothing else from SSML: an `<emphasis>` tag is
 * read to the child as the words "emphasis level moderate". The beat is kept, the stress is
 * dropped — the prosody in the voice itself carries it.
 */
const BREAK_ONLY = {
  supports: new Set<ProsodyMarker>(['pause']),
  emphasis: (word: string) => word,
  pause: () => '<break time="0.3s" />',
} as const;

/**
 * Reviewed per vendor in `dev-docs/voice-review.md`. A vendor that is not listed is assumed
 * to render nothing and to have no rate control, which is the safe reading of "unknown".
 */
export const REVIEWED_VENDORS: Readonly<Record<string, Vendor>> = {
  elevenlabs: { ...BREAK_ONLY, rateOption: 'speed' },
  cartesia: { ...SSML, rateOption: 'speed' },
  inworld: { ...PLAIN, rateOption: 'speaking_rate' },
  xai: { ...PLAIN, rateOption: 'speed' },
  // Fish Audio s2.1 takes plain text; markup would reach the listener as words.
  fishaudio: { ...PLAIN, rateOption: 'speed' },
};

const NONE: Vendor = { ...PLAIN, rateOption: null };

const EMPHASIS = /\[\[emphasis\]\](.*?)\[\[\/emphasis\]\]/gu;
const PAUSE = /\[\[pause:short\]\]/gu;

function vendorFor(ttsModel: string): Vendor {
  return REVIEWED_VENDORS[ttsModel.split('/')[0] ?? ''] ?? NONE;
}

/**
 * The band's speaking rate in the provider's own words.
 *
 * Empty for a provider with no rate control: asking for 0.92 by sending an option the gateway
 * does not know is how a request gets rejected, and a slightly fast voice beats no voice.
 */
export function synthesisOptions(
  ttsModel: string,
  rate: number,
): Readonly<Record<string, unknown>> {
  const option = vendorFor(ttsModel).rateOption;
  return option === null || rate === 1 ? {} : { [option]: rate };
}

/** Tokens in, vendor markup out — and nothing left that could be read aloud as itself. */
export function renderProsody(spoken: string, ttsModel: string): string {
  const vendor = vendorFor(ttsModel);
  const rendered = spoken
    .replace(EMPHASIS, (_match, word: string) =>
      vendor.supports.has('emphasis') ? vendor.emphasis(word) : word,
    )
    .replace(PAUSE, () => (vendor.supports.has('pause') ? vendor.pause() : ''));
  return stripProsody(rendered).trim();
}

import { createHash } from 'node:crypto';

import { BANDS } from '@aria/shared';
import type { Band } from '@aria/shared';
import { bridgeTextIsNonCommittal, spokenForm } from '@aria/voice';
import type { BridgeBucket } from '@aria/voice';

import type {
  SpeechAssetDraft,
  SpeechAssetRepository,
} from '@/repositories/speech-asset.repository';
import { BRIDGE_SAMPLE_RATE } from '@/services/voice/bridge-library.service';
import { bridgeSeedFor } from '@/services/voice/bridge-seed';

/** A bridge that runs past this cannot end before the first gated sentence starts (seam rule). */
export const MAX_BRIDGE_MS = 1_200;

export type BridgeSynthesiser = Readonly<{
  /** Mono signed 16-bit PCM at `BRIDGE_SAMPLE_RATE`, in the session's own voice. */
  synthesise(input: Readonly<{ text: string; voice: string }>): Promise<Uint8Array>;
}>;

export type SpeechAudioWriter = Readonly<{
  write(storageKey: string, audio: Uint8Array): Promise<void>;
}>;

export type BridgeSynthesisPlanEntry = Readonly<{
  band: Band;
  bucket: BridgeBucket;
  voice: string;
  writtenText: string;
  spokenText: string;
  contentHash: string;
  storageKey: string;
}>;

export type BridgeSynthesisReport = Readonly<{
  planned: number;
  created: number;
  alreadyPresent: number;
  rejected: readonly string[];
}>;

/**
 * What a full run would write, without touching anything (P2H-09).
 *
 * Hash-addressed on the text that is actually spoken, plus the band, bucket and voice: two
 * bands may share a line, and each still needs its own recording in its own voice.
 */
export function planBridgeSynthesis(
  voices: Readonly<Record<Band, string | undefined>>,
): readonly BridgeSynthesisPlanEntry[] {
  return BANDS.flatMap((band) => {
    const voice = voices[band];
    return voice === undefined ? [] : entriesFor(band, voice);
  });
}

function entriesFor(band: Band, voice: string): readonly BridgeSynthesisPlanEntry[] {
  return bridgeSeedFor(band).map((line) => {
    const spokenText = spokenForm(line.text);
    const contentHash = hash(`${band}|${line.bucket}|${voice}|${spokenText}`);
    return {
      band,
      bucket: line.bucket,
      voice,
      writtenText: line.text,
      spokenText,
      contentHash,
      storageKey: `bridges/${band}/${voice}/${contentHash}.pcm`,
    };
  });
}

/**
 * Synthesises what is missing and nothing else.
 *
 * Re-running is free by construction: the row's own `(content_hash, voice)` key decides, so a
 * second run inserts nothing and a changed line is a new clip rather than a silent overwrite of
 * one somebody already listened to.
 */
export function createBridgeSynthesisService(deps: {
  assets: Pick<SpeechAssetRepository, 'findByHash' | 'insertIfAbsent'>;
  synthesiser: BridgeSynthesiser;
  storage: SpeechAudioWriter;
  ids: Readonly<{ next(): string }>;
}): Readonly<{
  run(
    input: Readonly<{ voices: Readonly<Record<Band, string | undefined>>; dryRun: boolean }>,
  ): Promise<BridgeSynthesisReport>;
}> {
  return {
    run: async ({ voices, dryRun }) => {
      const plan = planBridgeSynthesis(voices);
      const rejected = plan
        .filter((entry) => !bridgeTextIsNonCommittal(entry.writtenText))
        .map((entry) => entry.writtenText);
      if (rejected.length > 0) return report(plan.length, 0, 0, rejected);
      if (dryRun) return report(plan.length, 0, 0, []);
      let created = 0;
      let alreadyPresent = 0;
      for (const entry of plan) {
        if ((await deps.assets.findByHash(entry)) !== null) {
          alreadyPresent += 1;
          continue;
        }
        if (await synthesiseOne(deps, entry)) created += 1;
        else alreadyPresent += 1;
      }
      return report(plan.length, created, alreadyPresent, []);
    },
  };
}

async function synthesiseOne(
  deps: Parameters<typeof createBridgeSynthesisService>[0],
  entry: BridgeSynthesisPlanEntry,
): Promise<boolean> {
  const audio = await deps.synthesiser.synthesise({ text: entry.spokenText, voice: entry.voice });
  if (durationMs(audio.byteLength) > MAX_BRIDGE_MS) {
    throw new Error(`Bridge clip "${entry.writtenText}" is longer than the seam allows`);
  }
  await deps.storage.write(entry.storageKey, audio);
  const draft: SpeechAssetDraft = { id: deps.ids.next(), ...entry };
  return deps.assets.insertIfAbsent(draft);
}

/** Signed 16-bit mono: two bytes a sample, and the rate says how many make a second. */
export function durationMs(byteLength: number): number {
  return Math.round((byteLength / 2 / BRIDGE_SAMPLE_RATE) * 1_000);
}

function report(
  planned: number,
  created: number,
  alreadyPresent: number,
  rejected: readonly string[],
): BridgeSynthesisReport {
  return { planned, created, alreadyPresent, rejected };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

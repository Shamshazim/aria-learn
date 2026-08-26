import { describe, expect, it, vi } from 'vitest';

import type { SpeechAssetRecord } from '@/repositories/speech-asset.repository';

import { BRIDGE_SAMPLE_RATE } from './bridge-library.service';
import {
  createBridgeSynthesisService,
  planBridgeSynthesis,
  MAX_BRIDGE_MS,
} from './bridge-synthesis.service';

const VOICES = { early: 'voice-early', middle: undefined, senior: undefined } as const;

function audio(durationMs: number): Uint8Array {
  return new Uint8Array((durationMs / 1_000) * BRIDGE_SAMPLE_RATE * 2);
}

function record(contentHash: string): SpeechAssetRecord {
  return {
    id: 'asset-existing',
    contentHash,
    bucket: 'acknowledge',
    writtenText: 'Okay!',
    spokenText: 'Okay!',
    storageKey: `bridges/early/voice-early/${contentHash}.pcm`,
  };
}

function service(existing: readonly string[]) {
  const stored = new Set(existing);
  const insertIfAbsent = vi.fn((draft: { contentHash: string }) => {
    const fresh = !stored.has(draft.contentHash);
    stored.add(draft.contentHash);
    return Promise.resolve(fresh);
  });
  const write = vi.fn(() => Promise.resolve());
  let id = 0;
  return {
    insertIfAbsent,
    write,
    service: createBridgeSynthesisService({
      assets: {
        findByHash: ({ contentHash }) =>
          Promise.resolve(stored.has(contentHash) ? record(contentHash) : null),
        insertIfAbsent,
      },
      synthesiser: { synthesise: () => Promise.resolve(audio(900)) },
      storage: { write },
      ids: { next: () => `asset-${String((id += 1))}` },
    }),
  };
}

describe('bridge synthesis', () => {
  it('plans one clip per seed line per configured voice, and none for an unset band', () => {
    const plan = planBridgeSynthesis(VOICES);

    expect(plan.every((entry) => entry.band === 'early')).toBe(true);
    expect(plan).toHaveLength(40);
    expect(new Set(plan.map((entry) => entry.contentHash)).size).toBe(plan.length);
  });

  it('writes nothing on a dry run', async () => {
    const harness = service([]);

    const report = await harness.service.run({ voices: VOICES, dryRun: true });

    expect(report).toEqual({ planned: 40, created: 0, alreadyPresent: 0, rejected: [] });
    expect(harness.write).not.toHaveBeenCalled();
  });

  it('creates every clip once and nothing at all on a second run', async () => {
    const harness = service([]);

    const first = await harness.service.run({ voices: VOICES, dryRun: false });
    const second = await harness.service.run({ voices: VOICES, dryRun: false });

    expect(first).toMatchObject({ planned: 40, created: 40, alreadyPresent: 0 });
    expect(second).toMatchObject({ planned: 40, created: 0, alreadyPresent: 40 });
    expect(harness.insertIfAbsent).toHaveBeenCalledTimes(40);
  });

  it('refuses a clip that runs past the seam', async () => {
    const long = createBridgeSynthesisService({
      assets: {
        findByHash: () => Promise.resolve(null),
        insertIfAbsent: () => Promise.resolve(true),
      },
      synthesiser: { synthesise: () => Promise.resolve(audio(MAX_BRIDGE_MS + 200)) },
      storage: { write: () => Promise.resolve() },
      ids: { next: () => 'asset-1' },
    });

    await expect(long.run({ voices: VOICES, dryRun: false })).rejects.toThrow(
      /longer than the seam/,
    );
  });
});

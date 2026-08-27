import { describe, expect, it, vi } from 'vitest';

import type { SpeechAssetRecord } from '@/repositories/speech-asset.repository';

import { createBridgeLibraryService, BRIDGE_SAMPLE_RATE } from './bridge-library.service';

const CLIP: SpeechAssetRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  contentHash: 'hash-1',
  bucket: 'thinking',
  writtenText: 'Let me think.',
  spokenText: 'Let me think.',
  storageKey: 'bridges/middle/voice-middle/hash-1.pcm',
};

describe('bridge library', () => {
  it('serves only the clips of the band and voice that asked for them', async () => {
    const listApprovedBridges = vi.fn(() => Promise.resolve([CLIP]));
    const library = createBridgeLibraryService({
      assets: { listApprovedBridges, findById: () => Promise.resolve(null) },
      audio: { read: () => Promise.resolve(new Uint8Array()) },
    });

    await expect(library.list({ band: 'middle', voice: 'voice-middle' })).resolves.toEqual({
      band: 'middle',
      voice: 'voice-middle',
      sampleRate: BRIDGE_SAMPLE_RATE,
      clips: [{ id: CLIP.id, bucket: 'thinking', text: 'Let me think.' }],
    });
    expect(listApprovedBridges).toHaveBeenCalledWith({ band: 'middle', voice: 'voice-middle' });
  });

  it('reads a clip through its stored key rather than from anything the worker sent', async () => {
    const read = vi.fn(() => Promise.resolve(new Uint8Array([1, 2])));
    const library = createBridgeLibraryService({
      assets: {
        listApprovedBridges: () => Promise.resolve([]),
        findById: () => Promise.resolve(CLIP),
      },
      audio: { read },
    });

    await expect(library.audio(CLIP.id)).resolves.toEqual(new Uint8Array([1, 2]));
    expect(read).toHaveBeenCalledWith(CLIP.storageKey);
  });

  it('refuses an asset id that is not there', async () => {
    const library = createBridgeLibraryService({
      assets: {
        listApprovedBridges: () => Promise.resolve([]),
        findById: () => Promise.resolve(null),
      },
      audio: { read: () => Promise.resolve(new Uint8Array()) },
    });

    await expect(library.audio(CLIP.id)).rejects.toThrow(/speech asset not found/);
  });
});

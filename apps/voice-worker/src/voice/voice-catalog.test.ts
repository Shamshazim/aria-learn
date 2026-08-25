import { describe, expect, it } from 'vitest';

import { BANDS } from '@aria/shared';

import { voiceFor, VOICE_CRITERIA } from '@/voice/voice-catalog';

const IDS = { early: 'voice-early', middle: 'voice-middle', senior: 'voice-senior' } as const;

describe('voice catalogue', () => {
  it('gives every band a voice of its own', () => {
    const voices = BANDS.map((band) => voiceFor(band, IDS).voiceId);

    expect(new Set(voices).size).toBe(BANDS.length);
  });

  it('reads slower and brighter to the youngest children', () => {
    expect(voiceFor('early', IDS)).toEqual({
      voiceId: 'voice-early',
      rate: 0.92,
      pitchHint: 'bright',
      register: 'warm',
    });
  });

  it('does not perform at the senior band', () => {
    expect(voiceFor('senior', IDS).register).toBe('calm');
    expect(voiceFor('senior', IDS).rate).toBe(1);
  });

  it('refuses to run a band whose voice was never configured', () => {
    expect(() => voiceFor('middle', { ...IDS, middle: '   ' })).toThrow(
      /No voice is configured for the middle band/,
    );
  });

  it('states criteria for every band, so the listening review has something to judge', () => {
    expect(Object.keys(VOICE_CRITERIA).sort()).toEqual([...BANDS].sort());
  });
});

import { describe, expect, it } from 'vitest';

import { voiceAvailability } from '@/features/session/model/voice-availability';

describe('voiceAvailability', () => {
  it('is always ready in a scripted session, whatever the transport says', () => {
    expect(voiceAvailability('needs-consent', { scripted: true })).toBe('ready');
    expect(voiceAvailability(null, { scripted: true })).toBe('ready');
  });

  it('is off when there is no voice transport at all', () => {
    expect(voiceAvailability(null, { scripted: false })).toBe('off');
  });

  it.each([
    ['connecting', 'connecting'],
    ['recovering', 'connecting'],
    ['needs-consent', 'needs-consent'],
    ['unavailable', 'unavailable'],
    ['ready', 'ready'],
    ['listening', 'ready'],
    ['muted', 'ready'],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(voiceAvailability(status, { scripted: false })).toBe(expected);
  });
});

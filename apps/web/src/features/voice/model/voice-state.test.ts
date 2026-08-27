import { describe, expect, it } from 'vitest';

import { INITIAL_VOICE_STATE, withVoiceDevices } from './voice-state';

describe('voice state', () => {
  it('does not regress worker readiness when device enumeration finishes later', () => {
    const ready = { ...INITIAL_VOICE_STATE, status: 'ready' as const };

    expect(withVoiceDevices(ready, []).status).toBe('ready');
  });
});

import { describe, expect, it } from 'vitest';

import { parseVoiceRoomContext } from '@/session/session-context';

const SESSION_ID = '7a8c7c17-fbb5-4023-bdbc-1a382692293e';

describe('voice room context', () => {
  it('accepts only the epoch room named by signed participant metadata', () => {
    const metadata = JSON.stringify({
      sessionId: SESSION_ID,
      connectionEpoch: 2,
      band: 'middle',
    });

    expect(parseVoiceRoomContext(`aria_${SESSION_ID}_2`, metadata)).toEqual({
      sessionId: SESSION_ID,
      connectionEpoch: 2,
      band: 'middle',
    });
    expect(() => parseVoiceRoomContext(`aria_${SESSION_ID}_1`, metadata)).toThrow(
      /does not match participant metadata/,
    );
  });
});

import { AccessToken } from 'livekit-server-sdk';

import type { RealtimeTokenProvider } from './realtime.service';

export function createLivekitTokenProvider(
  input: Readonly<{
    apiKey: string;
    apiSecret: string;
  }>,
): RealtimeTokenProvider {
  return {
    mint: async ({ identity, room, ttlSeconds, metadata }) => {
      const token = new AccessToken(input.apiKey, input.apiSecret, {
        identity,
        ttl: ttlSeconds,
        metadata: JSON.stringify(metadata),
      });
      token.addGrant({
        room,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      return token.toJwt();
    },
  };
}

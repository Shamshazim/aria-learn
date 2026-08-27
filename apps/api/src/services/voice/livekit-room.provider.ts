import { RoomServiceClient, ServerError } from 'livekit-server-sdk';

import type { VoiceRoomCloser } from './consent.service';

export function createLivekitRoomCloser(input: {
  url: string;
  apiKey: string;
  apiSecret: string;
}): VoiceRoomCloser {
  const client = new RoomServiceClient(httpUrl(input.url), input.apiKey, input.apiSecret);
  return {
    close: async (roomName) => {
      try {
        await client.deleteRoom(roomName);
      } catch (error) {
        if (error instanceof ServerError && (error.status === 404 || error.code === 'not_found'))
          return;
        throw error;
      }
    },
  };
}

function httpUrl(url: string): string {
  if (url.startsWith('wss://')) return `https://${url.slice('wss://'.length)}`;
  if (url.startsWith('ws://')) return `http://${url.slice('ws://'.length)}`;
  return url;
}

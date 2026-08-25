import type { SegmentBus } from '@/services/content/segment-bus';

import type { Request } from 'express';

/**
 * P2H-07: writes a turn out while it is still happening.
 *
 * A turn used to be one JSON body sent when everything was finished, which is why a child heard
 * nothing until the last token was generated. Here the sentences leave as they pass the gate and
 * the turn itself follows as the closing frame.
 *
 * Headers are held back until there is something to send. That way a turn that fails before it
 * says anything is still an ordinary error response, and only a turn that has already spoken has
 * to be ended mid-stream — where the closing frame's absence is what tells the client it failed.
 */
export type FrameFormat = 'sse' | 'ndjson';

/**
 * The part of an Express response a turn stream uses.
 *
 * Naming it keeps this module honest about what it touches — a status line, some headers, and
 * writes — and lets a test hand it a recorder instead of a socket.
 */
export type TurnStreamResponse = Readonly<{
  status(code: number): unknown;
  set(headers: Readonly<Record<string, string>>): unknown;
  write(chunk: string): unknown;
  end(): unknown;
}>;

const CONTENT_TYPES: Readonly<Record<FrameFormat, string>> = {
  sse: 'text/event-stream; charset=utf-8',
  ndjson: 'application/x-ndjson; charset=utf-8',
};

export function requestedFormat(request: Pick<Request, 'headers'>): FrameFormat | null {
  const accept = request.headers.accept ?? '';
  if (accept.includes('text/event-stream')) return 'sse';
  if (accept.includes('application/x-ndjson')) return 'ndjson';
  return null;
}

export async function streamTurn<T>(input: {
  response: TurnStreamResponse;
  format: FrameFormat;
  segments: SegmentBus;
  sessionId: string;
  run(): Promise<T>;
  closing(result: T): unknown;
}): Promise<void> {
  const writer = createFrameWriter(input.response, input.format);
  const unsubscribe = input.segments.subscribe(input.sessionId, (segment) => {
    writer.write({ kind: 'MOVE_SEGMENT', ...segment });
  });
  try {
    const result = await input.run();
    writer.write({ kind: 'TURN_MOVES', turn: input.closing(result) });
  } catch (error) {
    if (!writer.started()) throw error;
    input.response.end();
    return;
  } finally {
    unsubscribe();
  }
  input.response.end();
}

type FrameWriter = Readonly<{ write(frame: unknown): void; started(): boolean }>;

function createFrameWriter(response: TurnStreamResponse, format: FrameFormat): FrameWriter {
  let started = false;
  return {
    started: () => started,
    write: (frame) => {
      if (!started) {
        started = true;
        response.status(200);
        response.set({
          'content-type': CONTENT_TYPES[format],
          'cache-control': 'no-store',
          connection: 'keep-alive',
        });
      }
      const body = JSON.stringify(frame);
      // No compression middleware sits in front of this, so a write reaches the socket.
      response.write(format === 'sse' ? `data: ${body}\n\n` : `${body}\n`);
    },
  };
}

import { describe, expect, it, vi } from 'vitest';

import { voiceTurnFrameSchema } from '@aria/shared';

import { requestedFormat, streamTurn } from '@/controllers/turn-stream';
import { createSegmentBus } from '@/services/content/segment-bus';

import type { Request } from 'express';

function recorder() {
  const written: string[] = [];
  const headers: Record<string, string>[] = [];
  const response = {
    status: vi.fn(() => response),
    set: vi.fn((value: Record<string, string>) => {
      headers.push(value);
      return response;
    }),
    write: vi.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    end: vi.fn(),
  };
  return { response, written, headers };
}

function segment(index: number, text: string) {
  return {
    generationId: 'gen-1',
    moveId: 'move-1',
    index,
    text,
    speech: text,
    isLast: false,
  };
}

describe('turn frames', () => {
  it('writes each sentence as it is released, then the turn itself', async () => {
    const recorded = recorder();
    const segments = createSegmentBus();

    await streamTurn({
      response: recorded.response,
      format: 'ndjson',
      segments,
      sessionId: 'session-1',
      run: () => {
        segments.publish('session-1', segment(0, 'First.'));
        segments.publish('session-1', segment(1, 'Second.'));
        return Promise.resolve({ connectionEpoch: 1, moves: [] });
      },
      closing: (turn) => turn,
    });

    const frames = recorded.written.map((line) => voiceTurnFrameSchema.parse(JSON.parse(line)));
    expect(frames.map((frame) => frame.kind)).toEqual([
      'MOVE_SEGMENT',
      'MOVE_SEGMENT',
      'TURN_MOVES',
    ]);
    expect(recorded.headers[0]?.['content-type']).toContain('application/x-ndjson');
    expect(recorded.response.end).toHaveBeenCalledOnce();
  });

  it('frames server-sent events for the text channel', async () => {
    const recorded = recorder();
    const segments = createSegmentBus();

    await streamTurn({
      response: recorded.response,
      format: 'sse',
      segments,
      sessionId: 'session-1',
      run: () => {
        segments.publish('session-1', segment(0, 'First.'));
        return Promise.resolve({ connectionEpoch: 1, moves: [] });
      },
      closing: (turn) => turn,
    });

    expect(recorded.written[0]).toMatch(/^data: \{.*\}\n\n$/u);
    expect(recorded.headers[0]?.['content-type']).toContain('text/event-stream');
  });

  it('lets a turn that failed before it said anything be an ordinary error', async () => {
    const recorded = recorder();

    await expect(
      streamTurn({
        response: recorded.response,
        format: 'ndjson',
        segments: createSegmentBus(),
        sessionId: 'session-1',
        run: () => Promise.reject(new Error('safe test failure')),
        closing: (turn) => turn,
      }),
    ).rejects.toThrow('safe test failure');
    expect(recorded.response.write).not.toHaveBeenCalled();
    expect(recorded.response.end).not.toHaveBeenCalled();
  });

  it('ends a turn that failed after it had already spoken, with no closing frame', async () => {
    const recorded = recorder();
    const segments = createSegmentBus();

    await streamTurn({
      response: recorded.response,
      format: 'ndjson',
      segments,
      sessionId: 'session-1',
      run: () => {
        segments.publish('session-1', segment(0, 'First.'));
        return Promise.reject(new Error('safe test failure'));
      },
      closing: (turn) => turn,
    });

    expect(recorded.written).toHaveLength(1);
    expect(recorded.written[0]).toContain('MOVE_SEGMENT');
    expect(recorded.response.end).toHaveBeenCalledOnce();
  });

  it('stops listening for a session once its turn is over', async () => {
    const recorded = recorder();
    const segments = createSegmentBus();

    await streamTurn({
      response: recorded.response,
      format: 'ndjson',
      segments,
      sessionId: 'session-1',
      run: () => Promise.resolve({ connectionEpoch: 1, moves: [] }),
      closing: (turn) => turn,
    });

    expect(segments.listening('session-1')).toBe(false);
  });

  it.each([
    ['text/event-stream', 'sse'],
    ['application/x-ndjson', 'ndjson'],
    ['application/json', null],
  ])('reads %s as %s', (accept, format) => {
    const request: Pick<Request, 'headers'> = { headers: { accept } };
    expect(requestedFormat(request)).toBe(format);
  });
});

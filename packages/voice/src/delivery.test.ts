import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema } from '@aria/shared';

import { createMoveInbox } from './delivery';

function move(id: string, serverSeq: number) {
  return tutorMoveSchema.parse({
    id,
    serverSeq,
    protocolVersion: PROTOCOL_VERSION,
    at: '2026-08-24T00:00:00.000Z',
    kind: 'SAY',
    speech: { text: id },
    display: [],
    expects: 'none',
  });
}

describe('at-least-once move delivery', () => {
  it('deduplicates received moves but advances the durable cursor only when acknowledged', () => {
    const inbox = createMoveInbox();
    expect(inbox.receive(move('one', 1)).duplicate).toBe(false);
    expect(inbox.receive(move('one', 1)).duplicate).toBe(true);
    expect(inbox.receive(move('two', 2)).duplicate).toBe(false);
    expect(inbox.acknowledgedSeq()).toBe(0);
    inbox.acknowledge(2);
    expect(inbox.acknowledgedSeq()).toBe(2);
    expect(inbox.receive(move('three', 1)).duplicate).toBe(true);
    expect(inbox.nextEpoch()).toBe(1);
  });
});

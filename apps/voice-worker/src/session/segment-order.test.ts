import { describe, expect, it } from 'vitest';

import type { MoveSegment } from '@aria/shared';

import { createSegmentOrder } from '@/session/segment-order';

function segment(index: number, text: string, generationId = 'gen-1'): MoveSegment {
  return {
    kind: 'MOVE_SEGMENT',
    generationId,
    moveId: `move-${generationId}`,
    index,
    text,
    speech: text,
    isLast: false,
  };
}

describe('segment ordering', () => {
  it('speaks sentences in the order they were written, whatever order they arrive in', () => {
    const order = createSegmentOrder();

    expect(order.accept(segment(1, 'Second.')).map((item) => item.text)).toEqual([]);
    expect(order.accept(segment(2, 'Third.')).map((item) => item.text)).toEqual([]);
    expect(order.accept(segment(0, 'First.')).map((item) => item.text)).toEqual([
      'First.',
      'Second.',
      'Third.',
    ]);
  });

  it('never says the same sentence twice', () => {
    const order = createSegmentOrder();

    expect(order.accept(segment(0, 'Only once.'))).toHaveLength(1);
    expect(order.accept(segment(0, 'Only once.'))).toEqual([]);
  });

  it('drops a sentence that arrives after the child talked over it', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'Heard this.'));

    order.cancel('gen-1');

    expect(order.accept(segment(1, 'Too late.'))).toEqual([]);
  });

  it('remembers how far into the interrupted answer the child got, once', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'One.'));
    order.accept(segment(1, 'Two.'));

    order.cancel('gen-1');

    expect(order.takeInterruptedPrefix()).toEqual({ generationId: 'gen-1', index: 1 });
    expect(order.takeInterruptedPrefix()).toBeNull();
  });

  it('reports nothing to record when the answer was never interrupted', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'One.'));

    expect(order.takeInterruptedPrefix()).toBeNull();
  });

  it('counts a move as spoken only once its stream reached the closing frame', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'Said half of it.'));

    // The stream is still open: replaying the move whole is how the child hears the rest.
    expect(order.wasSpoken('move-gen-1')).toBe(false);

    order.settle();

    expect(order.wasSpoken('move-gen-1')).toBe(true);
    expect(order.wasSpoken('move-gen-2')).toBe(false);
  });

  it('forgets what a stream half-said once the next one starts', () => {
    const order = createSegmentOrder();
    order.begin();
    order.accept(segment(0, 'Half an answer.'));

    // The stream stopped without a closing frame; the next one settles on its own work only.
    order.begin();
    order.settle();

    expect(order.wasSpoken('move-gen-1')).toBe(false);
  });

  it('carries on past a sentence that is never going to arrive', () => {
    const order = createSegmentOrder();
    for (let index = 1; index <= 8; index += 1) {
      expect(order.accept(segment(index, `Sentence ${String(index)}.`))).toEqual([]);
    }

    // Nine held would mean a child waiting in silence for a sentence that was lost, so the
    // stream gives up on index 0 and says the eight it already has.
    const released = order.accept(segment(9, 'Ninth.'));

    expect(released.map((item) => item.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // The lost sentence stays lost: it is behind the stream now.
    expect(order.accept(segment(0, 'First.'))).toEqual([]);
  });

  it('keeps two generations apart', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'A one.', 'gen-a'));

    expect(order.accept(segment(0, 'B one.', 'gen-b')).map((item) => item.text)).toEqual([
      'B one.',
    ]);
  });
});

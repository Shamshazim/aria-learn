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

  it('knows which moves have already been spoken a sentence at a time', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'Said it.'));

    expect(order.wasSpoken('move-gen-1')).toBe(true);
    expect(order.wasSpoken('move-gen-2')).toBe(false);
  });

  it('stops holding sentences back for a gap that is never going to be filled', () => {
    const order = createSegmentOrder();
    for (let index = 1; index <= 8; index += 1)
      order.accept(segment(index, `Sentence ${String(index)}.`));

    // Nine held would mean a child waiting in silence for a sentence that was lost.
    expect(order.accept(segment(9, 'Ninth.'))).toEqual([]);
    expect(order.accept(segment(0, 'First.'))).toHaveLength(9);
  });

  it('keeps two generations apart', () => {
    const order = createSegmentOrder();
    order.accept(segment(0, 'A one.', 'gen-a'));

    expect(order.accept(segment(0, 'B one.', 'gen-b')).map((item) => item.text)).toEqual([
      'B one.',
    ]);
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { MoveSegment } from '@aria/shared';

import type { TutorSession } from '@/features/session/hooks/useTutorSession';
import { LayoutContent } from '@/features/session/layouts/LayoutContent';
import { reduceSession } from '@/features/session/model/session-machine';
import { initialSessionState, type SessionState } from '@/features/session/model/session-state';

function segment(index: number, text: string): MoveSegment {
  return {
    kind: 'MOVE_SEGMENT',
    generationId: 'gen-1',
    moveId: 'move-1',
    index,
    text,
    speech: text,
    isLast: false,
  };
}

function session(state: SessionState): TutorSession {
  const unused = (): Promise<void> => Promise.resolve();
  return {
    state,
    connectionStatus: 'online',
    answer: unused,
    askQuestion: unused,
    backchannel: unused,
    speechPartial: unused,
    confused: unused,
    completeDrag: unused,
    interrupt: unused,
    leave: unused,
    pause: unused,
    resume: unused,
    speak: unused,
    receive: () => undefined,
  };
}

describe('a move being written', () => {
  it('shows each sentence as it arrives, without waiting for the move', () => {
    const first = reduceSession(initialSessionState('middle'), segment(0, 'Four plus three is 7.'));
    const second = reduceSession(first, segment(1, 'You can count on from four.'));

    render(<LayoutContent session={session(second)} />);

    expect(
      screen.getByText('Four plus three is 7. You can count on from four.'),
    ).toBeInTheDocument();
  });

  it('is announced politely, so a screen reader reads it as it grows', () => {
    const state = reduceSession(initialSessionState('senior'), segment(0, 'Here is the idea.'));

    render(<LayoutContent session={session(state)} />);

    expect(screen.getByText('Here is the idea.')).toHaveAttribute('aria-live', 'polite');
  });

  it('starts again when the sentences belong to a different move', () => {
    const first = reduceSession(initialSessionState('middle'), segment(0, 'Old answer.'));

    const second = reduceSession(first, { ...segment(0, 'New answer.'), moveId: 'move-2' });

    expect(second.streaming).toEqual({ moveId: 'move-2', text: 'New answer.' });
  });
});

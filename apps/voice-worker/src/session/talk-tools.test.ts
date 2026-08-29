import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import { createTalkTools, type TalkToolHooks } from '@/session/talk-tools';

async function* lines(...items: string[]): AsyncIterable<string> {
  for (const item of items) yield await Promise.resolve(item);
}

const opts = { ctx: {}, toolCallId: 'call', abortSignal: new AbortController().signal } as never;

function move(kind: TutorMove['kind'], text: string, extra: Record<string, unknown> = {}): TutorMove {
  return tutorMoveSchema.parse({
    id: `${kind.toLowerCase()}-1`,
    at: '2026-08-28T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    kind,
    speech: { text },
    display: [],
    expects: 'none',
    ...extra,
  });
}

function hooks(
  published: readonly TutorMove[],
  terminal = false,
): TalkToolHooks & { answers: [string, string][]; transcripts: string[]; ended: number } {
  const answers: [string, string][] = [];
  const transcripts: string[] = [];
  const state = { ended: 0 };
  return {
    answers,
    transcripts,
    get ended() {
      return state.ended;
    },
    moves: {
      answer: (respondsTo, text) => {
        answers.push([respondsTo, text]);
        return lines(...published.flatMap((m) => (m.speech === null ? [] : [m.speech.text])));
      },
      handleTranscript: (text) => {
        transcripts.push(text);
        return lines(...published.flatMap((m) => (m.speech === null ? [] : [m.speech.text])));
      },
      terminalDelivered: () => terminal,
    },
    currentAskId: () => 'ask-1',
    beginTurn: () => undefined,
    endTurn: () => published,
    onSessionOver: () => {
      state.ended += 1;
    },
  };
}

describe('the tools a talking Aria has', () => {
  it('record_answer grades through the harness and reports the verdict and next question', async () => {
    const h = hooks([
      move('PRAISE', 'Yes, four hundred seventy.', { because: 'you rounded the tens up' }),
      move('ASK', 'Round 374 to the nearest ten.', {
        expects: 'choice',
        display: [
          {
            type: 'choices',
            options: [
              { id: 'a', label: '370' },
              { id: 'b', label: '380' },
            ],
          },
        ],
      }),
    ]);
    const tools = createTalkTools(h);

    const out = await tools.record_answer.execute({ answer: 'four hundred seventy' }, opts);

    expect(h.answers).toEqual([['ask-1', 'four hundred seventy']]);
    expect(out.verdict).toBe('correct');
    expect(out.teacher_says).toEqual(['Yes, four hundred seventy.', 'Round 374 to the nearest ten.']);
    expect(out.next_question).toEqual({
      id: 'ask-1',
      prompt: 'Round 374 to the nearest ten.',
      options: [
        { id: 'a', text: '370' },
        { id: 'b', text: '380' },
      ],
    });
    expect(out.session_over).toBe(false);
  });

  it('reads a hint as "not yet" and leaves the model to phrase it', async () => {
    const tools = createTalkTools(hooks([move('HINT', 'Look at the ones digit.')]));
    const out = await tools.record_answer.execute({ answer: 'four sixty' }, opts);
    expect(out.verdict).toBe('not_yet');
    expect(out.next_question).toBeNull();
  });

  it('treats an answer with no open question as speech for the planner', async () => {
    const h = { ...hooks([]), currentAskId: () => null };
    await createTalkTools(h).record_answer.execute({ answer: 'seven' }, opts);
    expect(h.transcripts).toEqual(['seven']);
    expect(h.answers).toEqual([]);
  });

  it('end_session goes through the policy path a child saying "stop" reaches', async () => {
    const h = hooks([move('BREAK', 'We can stop here.', { reason: 'child_asked' })], true);
    const out = await createTalkTools(h).end_session.execute({}, opts);
    expect(h.transcripts).toEqual(['I want to stop now.']);
    expect(out.session_over).toBe(true);
    expect(out.instruction).toContain('goodbye');
    expect(h.ended).toBe(1);
  });
});

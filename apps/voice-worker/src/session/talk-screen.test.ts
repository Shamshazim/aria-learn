import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import { answerFromScreen, createScreenTools } from '@/session/talk-screen';
import type { TalkToolHooks } from '@/session/talk-tools';

const opts = { ctx: {}, toolCallId: 'call', abortSignal: new AbortController().signal } as never;
const ROOM = { sessionId: 'session-1', connectionEpoch: 2 };

async function* lines(...items: string[]): AsyncIterable<string> {
  for (const item of items) yield await Promise.resolve(item);
}

function move(kind: TutorMove['kind'], extra: Record<string, unknown> = {}): TutorMove {
  return tutorMoveSchema.parse({
    id: `${kind.toLowerCase()}-1`,
    at: '2026-09-02T00:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    kind,
    speech: null,
    display: [],
    expects: 'none',
    ...extra,
  });
}

const ASK = move('ASK', {
  speech: { text: 'Which word is a noun?' },
  expects: 'choice',
  display: [
    {
      type: 'choices',
      options: [
        { id: 'a', label: 'run' },
        { id: 'b', label: 'apple' },
      ],
    },
  ],
});

describe('what Aria puts on the screen', () => {
  it('asks the API for the surface and publishes the move it recorded', async () => {
    const shown = move('SHOW', { expects: 'text', display: [{ type: 'workpad', mode: 'answer' }] });
    const screen = vi.fn((_sessionId: string, _body: unknown) => Promise.resolve({ move: shown }));
    const publish = vi.fn((_move: TutorMove) => Promise.resolve());
    const tools = createScreenTools({ talk: { screen }, room: ROOM, publish });

    const out = await tools.show_on_screen.execute(
      { surface: 'writing', text: '  Write a sentence with "because".  ', options: null },
      opts,
    );

    expect(screen).toHaveBeenCalledWith('session-1', {
      connectionEpoch: 2,
      surface: 'writing',
      text: 'Write a sentence with "because".',
    });
    expect(publish).toHaveBeenCalledWith(shown);
    expect(out.shown).toBe('writing');
    expect(out.move_id).toBe('show-1');
    expect(out.instruction).toContain('on the screen now');
  });

  it('leaves out empty text and too few options', async () => {
    const screen = vi.fn((_sessionId: string, _body: unknown) => Promise.resolve({ move: move('SHOW') }));
    const tools = createScreenTools({ talk: { screen }, room: ROOM, publish: () => Promise.resolve() });
    await tools.show_on_screen.execute({ surface: 'clear', text: '', options: [' '] }, opts);
    expect(screen).toHaveBeenCalledWith('session-1', { connectionEpoch: 2, surface: 'clear' });
  });
});

function harness(ask: TutorMove | null, published: readonly TutorMove[] = [], crisis = false) {
  const answers: [string, string][] = [];
  const heard: unknown[] = [];
  const replies: unknown[] = [];
  const interrupted = { count: 0 };
  const hooks: TalkToolHooks = {
    moves: {
      answer: (respondsTo, text) => {
        answers.push([respondsTo, text]);
        return lines(...published.flatMap((m) => (m.speech === null ? [] : [m.speech.text])));
      },
      handleTranscript: () => lines(),
      terminalDelivered: () => false,
    },
    currentAskId: () => ask?.id ?? null,
    beginTurn: () => undefined,
    endTurn: () => published,
    onSessionOver: () => undefined,
  };
  const session = {
    generateReply: (options: unknown) => {
      replies.push(options);
    },
    interrupt: () => {
      interrupted.count += 1;
      return { await: Promise.resolve() };
    },
  } as never;
  const talk = {
    heard: (_sessionId: string, body: unknown) => {
      heard.push(body);
      return Promise.resolve({ crisis: crisis ? { say: 'I am here with you.' } : null });
    },
  };
  return {
    deps: { session, hooks, talk, room: ROOM, currentAsk: () => ask },
    answers,
    heard,
    replies,
    interrupted,
  };
}

describe('what the child does on the screen', () => {
  it('grades a tap on the open question and tells the model what the tile said', async () => {
    const h = harness(ASK, [
      move('PRAISE', { speech: { text: 'Yes, apple is a noun.' }, because: 'apple names a thing' }),
    ]);

    await answerFromScreen(h.deps, { kind: 'SCREEN_ANSWER', moveId: 'ask-1', text: 'b' });

    expect(h.answers).toEqual([['ask-1', 'b']]);
    expect(h.heard).toEqual([]);
    const instructions = String(Reflect.get(h.replies[0] ?? {}, 'instructions'));
    expect(instructions).toContain('"apple". It was correct.');
    expect(instructions).toContain('Yes, apple is a noun.');
  });

  it('reads what was typed in the writing pad to the model as the child\'s words', async () => {
    const h = harness(ASK);

    await answerFromScreen(h.deps, {
      kind: 'SCREEN_ANSWER',
      moveId: 'show-1',
      text: 'My cat sleeps a lot because she is old.',
    });

    expect(h.answers).toEqual([]);
    expect(h.heard).toEqual([
      { connectionEpoch: 2, text: 'My cat sleeps a lot because she is old.', via: 'screen' },
    ]);
    expect(String(Reflect.get(h.replies[0] ?? {}, 'userInput'))).toBe(
      '(typed on the screen) My cat sleeps a lot because she is old.',
    );
  });

  it('cuts in with the crisis line when the typed words disclose something', async () => {
    const h = harness(null, [], true);

    await answerFromScreen(h.deps, { kind: 'SCREEN_ANSWER', moveId: 'show-1', text: 'I am scared' });

    expect(h.interrupted.count).toBe(1);
    expect(String(Reflect.get(h.replies[0] ?? {}, 'instructions'))).toContain('"I am here with you."');
  });
});

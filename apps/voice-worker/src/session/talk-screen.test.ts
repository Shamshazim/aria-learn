import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import { answerFromScreen, createScreenTools, skipFromScreen } from '@/session/talk-screen';
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
    const tools = createScreenTools({
      talk: { screen },
      room: ROOM,
      publish,
      currentAsk: () => null,
    });

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
    const screen = vi.fn((_sessionId: string, _body: unknown) =>
      Promise.resolve({ move: move('SHOW') }),
    );
    const tools = createScreenTools({
      talk: { screen },
      room: ROOM,
      publish: () => Promise.resolve(),
      currentAsk: () => null,
    });
    await tools.show_on_screen.execute({ surface: 'clear', text: '', options: [' '] }, opts);
    expect(screen).toHaveBeenCalledWith('session-1', { connectionEpoch: 2, surface: 'clear' });
  });
});

describe('while a question is on the screen', () => {
  function tools(ask: TutorMove) {
    const screen = vi.fn((_sessionId: string, _body: unknown) =>
      Promise.resolve({ move: move('SHOW', { display: [{ type: 'text', body: 'x' }] }) }),
    );
    return {
      screen,
      tools: createScreenTools({
        talk: { screen },
        room: ROOM,
        publish: () => Promise.resolve(),
        currentAsk: () => ask,
      }),
    };
  }
  const WRITTEN = { ...ASK, id: 'ask-2', expects: 'text' as const, display: [] };

  it('refuses to replace the question with choices, a number pad or a blank screen', async () => {
    const t = tools(ASK);
    for (const surface of ['choices', 'number', 'clear'] as const) {
      const out = await t.tools.show_on_screen.execute(
        { surface, text: 'Pick one', options: ['run', 'apple'] },
        opts,
      );
      expect(out.shown).toBe('nothing');
      expect(out.move_id).toBeNull();
      expect(out.instruction).toContain('stays as it is');
    }
    expect(t.screen).not.toHaveBeenCalled();
  });

  it('opens one writing pad for a question answered in words, and no second one', async () => {
    const t = tools(WRITTEN);
    const first = await t.tools.show_on_screen.execute(
      { surface: 'writing', text: 'Write two sentences.', options: null },
      opts,
    );
    const second = await t.tools.show_on_screen.execute(
      { surface: 'writing', text: 'Write two sentences.', options: null },
      opts,
    );
    expect(first.shown).toBe('writing');
    expect(second.shown).toBe('nothing');
    expect(second.instruction).toContain('already open');
    expect(t.screen).toHaveBeenCalledTimes(1);
  });

  it('refuses a writing pad for a question answered by tapping', async () => {
    const t = tools(ASK);
    const out = await t.tools.show_on_screen.execute(
      { surface: 'writing', text: 'Write it.', options: null },
      opts,
    );
    expect(out.shown).toBe('nothing');
    expect(out.instruction).toContain('tapping');
  });

  it('puts one thing to read beside the question, then keeps the screen still', async () => {
    const t = tools(ASK);
    const first = await t.tools.show_on_screen.execute(
      { surface: 'text', text: 'The cat sat.', options: null },
      opts,
    );
    const second = await t.tools.show_on_screen.execute(
      { surface: 'text', text: 'The dog ran.', options: null },
      opts,
    );
    expect(first.shown).toBe('text');
    expect(second.shown).toBe('nothing');
    expect(t.screen).toHaveBeenCalledTimes(1);
  });

  it('starts over when the next question arrives', async () => {
    let ask: TutorMove = ASK;
    const screen = vi.fn((_sessionId: string, _body: unknown) =>
      Promise.resolve({ move: move('SHOW', { display: [{ type: 'text', body: 'x' }] }) }),
    );
    const t = createScreenTools({
      talk: { screen },
      room: ROOM,
      publish: () => Promise.resolve(),
      currentAsk: () => ask,
    });
    await t.show_on_screen.execute({ surface: 'text', text: 'one', options: null }, opts);
    ask = { ...ASK, id: 'ask-3' };
    const out = await t.show_on_screen.execute(
      { surface: 'text', text: 'two', options: null },
      opts,
    );
    expect(out.shown).toBe('text');
    expect(screen).toHaveBeenCalledTimes(2);
  });
});

function harness(ask: TutorMove | null, published: readonly TutorMove[] = [], crisis = false) {
  const answers: [string, string][] = [];
  const skips: [string | null, string][] = [];
  const heard: unknown[] = [];
  const replies: unknown[] = [];
  const interrupted = { count: 0 };
  const said = () => lines(...published.flatMap((m) => (m.speech === null ? [] : [m.speech.text])));
  const hooks: TalkToolHooks = {
    moves: {
      answer: (respondsTo, text) => {
        answers.push([respondsTo, text]);
        return said();
      },
      skip: (respondsTo, reason) => {
        skips.push([respondsTo, reason]);
        return said();
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
    skips,
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

  it("reads what was typed in the writing pad to the model as the child's words", async () => {
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

  it('closes the question when the child presses skip, and tells the model not to hold on', async () => {
    const h = harness(ASK, [
      move('REVEAL', { speech: { text: 'No problem. It was apple.' }, answer: 'apple' }),
      move('ASK', { speech: { text: 'Which word is a verb?' }, expects: 'text' }),
    ]);

    await skipFromScreen(h.deps, { kind: 'SCREEN_SKIP', moveId: 'ask-1' });

    expect(h.skips).toEqual([['ask-1', 'child_asked']]);
    expect(h.answers).toEqual([]);
    const instructions = String(Reflect.get(h.replies[0] ?? {}, 'instructions'));
    expect(instructions).toContain('pressed skip');
    expect(instructions).toContain('No problem. It was apple.');
  });

  it('still skips when the screen names a question the voice has already moved past', async () => {
    const h = harness(ASK, [move('ASK', { speech: { text: 'Next one.' }, expects: 'text' })]);

    await skipFromScreen(h.deps, { kind: 'SCREEN_SKIP', moveId: 'ask-old' });

    expect(h.skips).toEqual([[null, 'child_asked']]);
  });

  it('cuts in with the crisis line when the typed words disclose something', async () => {
    const h = harness(null, [], true);

    await answerFromScreen(h.deps, {
      kind: 'SCREEN_ANSWER',
      moveId: 'show-1',
      text: 'I am scared',
    });

    expect(h.interrupted.count).toBe(1);
    expect(String(Reflect.get(h.replies[0] ?? {}, 'instructions'))).toContain(
      '"I am here with you."',
    );
  });
});

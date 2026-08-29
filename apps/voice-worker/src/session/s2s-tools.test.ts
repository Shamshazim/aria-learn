import { describe, expect, it, vi } from 'vitest';

import { createSafetyTap } from '@/session/s2s-safety-tap';
import { createS2STools, type S2SToolHooks } from '@/session/s2s-tools';

async function* lines(...items: string[]): AsyncIterable<string> {
  for (const item of items) yield await Promise.resolve(item);
}

const opts = { ctx: {}, toolCallId: 'call', abortSignal: new AbortController().signal } as never;

function hooks(overrides: Partial<S2SToolHooks> = {}): S2SToolHooks & {
  transcripts: string[];
  answers: [string, string][];
} {
  const transcripts: string[] = [];
  const answers: [string, string][] = [];
  return {
    transcripts,
    answers,
    moves: {
      handleTranscript: (text) => {
        transcripts.push(text);
        return lines('What do you see?');
      },
      answer: (respondsTo, text) => {
        answers.push([respondsTo, text]);
        return lines('Yes, three!', 'Now try four.');
      },
    },
    tap: createSafetyTap(),
    currentAskId: () => null,
    onTurnEnded: vi.fn(),
    ...overrides,
  };
}

describe('the three speech-to-speech tools', () => {
  it('plan_next_move hands the transcript to the harness and returns its exact sentences', async () => {
    const h = hooks();
    const tools = createS2STools(h);

    const planned = await tools.plan_next_move.execute({ child_said: 'I see circles' }, opts);

    expect(h.transcripts).toEqual(['I see circles']);
    expect(planned.say).toEqual(['What do you see?']);
    expect(planned.instruction).toContain('word for word');
  });

  it('registers the plan with the safety tap, so only those sentences may be voiced', async () => {
    const tap = createSafetyTap();
    const tools = createS2STools(hooks({ tap }));

    await tools.plan_next_move.execute({ child_said: 'hi' }, opts);

    expect(tap.observe('What do you see?').kind).toBe('on_plan');
    expect(tap.observe('Anything else').kind).toBe('off_plan');
  });

  it('check_answer grades against the open question through the existing scoring', async () => {
    const h = hooks({ currentAskId: () => 'ask-7' });
    const tools = createS2STools(h);

    const planned = await tools.check_answer.execute({ answer: 'three' }, opts);

    expect(h.answers).toEqual([['ask-7', 'three']]);
    expect(h.transcripts).toEqual([]);
    expect(planned.say).toEqual(['Yes, three!', 'Now try four.']);
  });

  it('check_answer with no open question is just speech, and the planner decides', async () => {
    const h = hooks();
    const tools = createS2STools(h);

    await tools.check_answer.execute({ answer: 'three' }, opts);

    expect(h.answers).toEqual([]);
    expect(h.transcripts).toEqual(['three']);
  });

  it('says so when the harness has nothing to say', async () => {
    const h = hooks({ moves: { handleTranscript: () => lines(), answer: () => lines() } });
    const tools = createS2STools(h);

    const planned = await tools.plan_next_move.execute({ child_said: 'mm' }, opts);

    expect(planned.say).toEqual([]);
    expect(planned.instruction).toContain('nothing to say');
  });

  it('end_turn reports the turn boundary and nothing else', async () => {
    const h = hooks();
    const tools = createS2STools(h);

    await expect(tools.end_turn.execute({}, opts)).resolves.toEqual({ ok: true });
    expect(h.onTurnEnded).toHaveBeenCalledOnce();
  });
});

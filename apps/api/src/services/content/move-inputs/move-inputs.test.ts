import { describe, expect, it } from 'vitest';

import type { Band, MoveKind } from '@aria/shared';

import { createQualityGate, type MoveClaims } from '@/quality';
import { PRAISE_CASES } from '@/services/content/move-inputs/__fixtures__/praise.fixtures';
import { REVEAL_CASES } from '@/services/content/move-inputs/__fixtures__/reveal.fixtures';
import {
  endTurn,
  praiseTurn,
  recap,
  spokenTurn,
} from '@/services/content/move-inputs/__fixtures__/turns.fixture';
import { endInputs } from '@/services/content/move-inputs/end.inputs';
import { praiseInputs, praiseStreak } from '@/services/content/move-inputs/praise.inputs';
import { revealInputs } from '@/services/content/move-inputs/reveal.inputs';
import type { SessionRecap } from '@/services/session/recap.types';

const gate = createQualityGate(() => ({ safe: true, categories: [] }));

function verdictFor(text: string, claims: MoveClaims): readonly string[] {
  const verdict = gate({
    id: 'case',
    kind: 'text',
    band: 'senior',
    childText: text,
    factual: false,
    grounding: 'unsupported',
    claims,
  });
  return verdict.verdict === 'fail' ? verdict.reasons.map((reason) => reason.code) : [];
}

function verdictIn(band: Band, text: string, claims: MoveClaims): readonly string[] {
  const verdict = gate({
    id: 'case',
    kind: 'text',
    band,
    childText: text,
    factual: false,
    grounding: 'unsupported',
    claims,
  });
  return verdict.verdict === 'fail' ? verdict.reasons.map((reason) => reason.code) : [];
}

describe('praise grounding', () => {
  it.each(PRAISE_CASES)('$name', (praiseCase) => {
    const codes = verdictFor(praiseCase.text, { move: 'praise', allowed: praiseCase.allowed });
    if (praiseCase.verdict === 'pass') expect(codes).toEqual([]);
    else expect(codes).toContain(praiseCase.code);
  });

  it('offers only the strategies the grader vouched for', () => {
    const turn = praiseTurn(['regrouped']);
    const inputs = praiseInputs(turn);
    expect(inputs.claims?.allowed).toContain('regrouped');
    expect(inputs.claims?.allowed).not.toContain('counted-on');
    expect(inputs.lines.join(' ')).toContain('regrouped when the ones went past nine');
  });

  it('says plainly when it knows nothing about how the answer was reached', () => {
    const inputs = praiseInputs(praiseTurn([], 40_000));
    expect(inputs.claims?.allowed).toEqual([]);
    expect(inputs.lines.join(' ')).toContain('nothing about how');
  });

  it('earns "answered quickly" only from an answer that actually came quickly', () => {
    expect(praiseInputs(praiseTurn([], 4_000)).claims?.allowed).toContain('answered-quickly');
    expect(praiseInputs(praiseTurn([], 40_000)).claims?.allowed).not.toContain('answered-quickly');
  });

  it('earns "kept going" from an attempt that followed wrong ones', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: {
        ...base.context,
        session: { ...base.context.session, consecutiveWrong: 2, lastApproach: 'simpler-case' },
      },
    };
    const allowed = praiseInputs(turn).claims?.allowed ?? [];
    expect(allowed).toContain('kept-going');
    // Aria changing her approach is Aria's second way, not the child's. Nothing here saw the
    // child try one, so nothing may say they did.
    expect(allowed).not.toContain('tried-another-way');
  });

  it('claims the picture only while a picture is still on the screen', () => {
    const base = praiseTurn([]);
    const showing = {
      ...base,
      context: { ...base.context, recentKinds: ['RETEACH', 'SHOW', 'ASK'] },
    };
    const longAgo = {
      ...base,
      context: { ...base.context, recentKinds: ['SHOW', 'ASK', 'PRAISE', 'ASK'] },
    };
    expect(praiseInputs(showing).claims?.allowed).toContain('used-the-picture');
    expect(praiseInputs(longAgo).claims?.allowed).not.toContain('used-the-picture');
  });

  it('claims an explanation only from an answer that explains something', () => {
    expect(
      praiseInputs(praiseTurn([], 4_000, 'because i added the tens first')).claims?.allowed,
    ).toContain('explained-your-thinking');
    expect(
      praiseInputs(praiseTurn([], 4_000, 'um i think it is forty two')).claims?.allowed,
    ).not.toContain('explained-your-thinking');
  });

  /** P2H-11: the fourth cheer in a row is noise. */
  it('asks for a quieter praise after three in a row', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: { ...base.context, recentKinds: ['PRAISE', 'ASK', 'PRAISE', 'ASK', 'PRAISE'] },
    };
    expect(praiseStreak(turn.context.recentKinds)).toBe(3);
    expect(praiseInputs(turn).lines.join(' ')).toContain('Say less this time');
  });

  /** The child was heard, not read, and not heard well: check before you congratulate. */
  it('asks Aria to confirm what she heard before praising an uncertain transcript', () => {
    expect(praiseInputs(spokenTurn(0.6)).lines.join(' ')).toContain('Say back what you heard');
    expect(praiseInputs(spokenTurn(0.98)).lines.join(' ')).not.toContain('Say back what you heard');
  });

  it('refuses to praise an answer the child was just handed', () => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      context: { ...base.context, recentKinds: ['ASK', 'REVEAL', 'ASK'] },
    };
    expect(praiseInputs(turn).lines.join(' ')).toContain('Do not praise the answer itself');
  });
});

describe('reveal shape', () => {
  it.each(REVEAL_CASES)('$name', (revealCase) => {
    const base = praiseTurn([]);
    const turn = {
      ...base,
      plan: { ...base.plan, kind: 'REVEAL' as MoveKind },
      context: {
        ...base.context,
        modelContext: { ...base.context.modelContext, answerKey: revealCase.answer },
      },
    };
    const claims = revealInputs(turn, revealCase.idea).claims;
    if (claims === undefined) throw new Error('A reveal always carries claims');
    const codes = verdictFor(revealCase.text, claims);
    if (revealCase.verdict === 'pass') expect(codes).toEqual([]);
    else expect(codes).toContain(revealCase.code);
  });
});

describe('the ending', () => {
  it('gives the model the counts and forbids the child hearing them', () => {
    const inputs = endInputs(endTurn(), recap());
    const claims = inputs.claims;
    if (claims === undefined) throw new Error('An ending always carries claims');
    expect(inputs.lines.join(' ')).toContain('Never say a number');
    expect(claims).toMatchObject({ move: 'end' });
    expect(verdictFor('You worked on adding today. See you next time.', claims)).toEqual([]);
    expect(verdictFor('You got 3 out of 4 today. See you soon.', claims)).toContain(
      'scored_ending',
    );
  });

  it('names the moment worth naming', () => {
    expect(endInputs(endTurn(), recap()).lines.join(' ')).toContain(
      'came back to Add two-digit numbers with regrouping',
    );
  });

  /** §14 again, in the band where it bites: an ending spoken to a five-year-old is short. */
  it('holds an early-band ending to twenty words', () => {
    const claims = endInputs(endTurn(), recap()).claims;
    if (claims === undefined) throw new Error('An ending always carries claims');
    const long =
      'You worked really hard on the adding today and you stayed with it right to the end, which was lovely to see.';
    expect(verdictIn('early', long, claims)).toContain('ending_too_long_for_band');
    expect(verdictIn('early', 'You stuck with the adding today. See you soon.', claims)).toEqual(
      [],
    );
    expect(verdictIn('senior', long, claims)).toEqual([]);
  });

  it('does not pretend work was done in a session with no answers', () => {
    const empty: SessionRecap = {
      skills: [],
      attempted: 0,
      correct: 0,
      finalStreak: 0,
      moment: null,
    };
    expect(endInputs(endTurn(), empty).lines.join(' ')).toContain(
      'without pretending work was done',
    );
  });
});

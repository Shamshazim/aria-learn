import { describe, expect, it } from 'vitest';

import { renderRespondPrompt } from '@/ai/prompts/definitions/respond.template';
import type { RespondPromptInput } from '@/ai/prompts/types';
import { scrubLearnerContext } from '@/privacy';

function input(learnerBrief?: string): RespondPromptInput {
  return {
    context: scrubLearnerContext(
      {
        identifiers: { fullName: 'Priya Shah' },
        gradeBand: 'early',
        ...(learnerBrief === undefined ? {} : { learnerBrief }),
      },
      { pseudonym: 'omit' },
    ),
    band: 'early',
    move: 'SAY',
    approach: 'teach',
    subject: 'reading',
  };
}

describe('the respond prompt and the learner brief (P3-03)', () => {
  it("opens with this week's brief, scrubbed", () => {
    const prompt = renderRespondPrompt(input('Priya read a whole page aloud this week.'), '');
    expect(prompt).toContain('What you know about this child this week:');
    expect(prompt).toContain('read a whole page aloud');
    expect(prompt).not.toContain('Priya');
  });

  it('has no heading at all when there is no brief', () => {
    expect(renderRespondPrompt(input(), '')).not.toContain('this week:');
  });
});

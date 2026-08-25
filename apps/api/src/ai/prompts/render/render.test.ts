import { describe, expect, it } from 'vitest';

import { RENDER_FIXTURES } from '@/ai/prompts/render/__fixtures__/render.fixtures';
import { renderPrompt } from '@/ai/prompts/render/render';
import { scrubLearnerContext } from '@/privacy';

const CONTEXT = scrubLearnerContext({ identifiers: {} }, { pseudonym: 'omit' });

describe('renderPrompt', () => {
  it.each(RENDER_FIXTURES)('$name', ({ template, values, expected }) => {
    expect(renderPrompt(template, CONTEXT, values)).toBe(expected);
    expect(renderPrompt(template, CONTEXT, values)).toBe(expected);
  });

  it('rejects a template with a missing value', () => {
    expect(() =>
      renderPrompt('Explain {{concept}} to {{learner}}.', CONTEXT, { concept: 'fractions' }),
    ).toThrow('Missing prompt value for {{learner}}');
  });
});

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MOVE_KINDS } from '@aria/shared';

import { ARIA_PERSONA, REGISTERS } from '@/ai/prompts/persona/aria.persona';
import { MOVE_INSTRUCTIONS } from '@/ai/prompts/persona/move-prompt.map';

const REPO_ROOT = fileURLToPath(new URL('../../../../../../', import.meta.url));
const ARIA_DOC = `${REPO_ROOT}dev-docs/aria.md`;

/** Persona plus register plus template, with headroom for the dialogue window. */
const PERSONA_TOKEN_BUDGET = 1_200;

/**
 * A deliberately crude estimate: four characters to a token, the rule of thumb every vendor
 * quotes. The budget is a guard rail, not an invoice — an exact tokeniser would tie the test
 * to one vendor's vocabulary, and the number we care about is "is this prompt getting away
 * from us", which four-characters-a-token answers fine.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function blocksOf(heading: string): Promise<readonly string[]> {
  const doc = await readFile(ARIA_DOC, 'utf8');
  const section = doc.split(`### ${heading}`)[1] ?? doc.split(`## ${heading}`)[1] ?? '';
  return [...section.matchAll(/```text\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

describe('Aria persona', () => {
  it('is exactly the text recorded in dev-docs/aria.md', async () => {
    const [documented] = await blocksOf('The system prompt');

    expect(documented?.trimEnd()).toBe(ARIA_PERSONA.trimEnd());
  });

  it.each(['early', 'middle', 'senior'] as const)(
    'documents the %s register exactly as the code sends it',
    async (band) => {
      const [documented] = await blocksOf(`${band} (ages`);

      expect(documented?.trimEnd()).toBe(REGISTERS[band].trimEnd());
    },
  );

  it('records a human review slot for every persona change', async () => {
    const doc = await readFile(ARIA_DOC, 'utf8');

    expect(doc).toContain('## Human review');
    expect(doc).toContain('| Reviewer |');
  });

  it.each(['early', 'middle', 'senior'] as const)(
    'fits the %s prompt inside the token budget',
    (band) => {
      expect(estimateTokens(`${ARIA_PERSONA}\n\n${REGISTERS[band]}`)).toBeLessThanOrEqual(
        PERSONA_TOKEN_BUDGET,
      );
    },
  );

  it('never leaks its own instructions into a child-facing register', () => {
    for (const register of Object.values(REGISTERS)) {
      expect(register).not.toContain('JSON');
    }
  });
});

describe('move prompt map', () => {
  it('has an instruction for all fourteen move kinds', () => {
    expect(Object.keys(MOVE_INSTRUCTIONS).sort()).toEqual([...MOVE_KINDS].sort());
    expect(MOVE_KINDS).toHaveLength(14);
  });

  it('never tells Aria to give the answer away outside REVEAL', () => {
    for (const [kind, instruction] of Object.entries(MOVE_INSTRUCTIONS)) {
      if (kind === 'REVEAL') continue;
      expect(instruction.toLowerCase(), kind).not.toContain('reveal the answer');
    }
  });
});

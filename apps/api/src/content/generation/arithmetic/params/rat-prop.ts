import type { CandidateItem, GeneratorParams } from '@/content/generation/arithmetic/types';

/**
 * Proportion (7.RP.A.2): "3 pens cost $12. How much do 5 pens cost?" A whole-dollar price from
 * 2 to 9, a known count from 2 to 6 and a different asked count from 2 to 10, so the price per
 * item is always whole and adding the difference is always wrong.
 */
const THINGS = ['pens', 'books', 'apples', 'tickets', 'cards'] as const;

type Entry = readonly [number, number, number, (typeof THINGS)[number]];

const ENTRIES: readonly Entry[] = Array.from({ length: 8 }, (_u, p) => p + 2)
  .flatMap((price) =>
    Array.from({ length: 5 }, (_v, c) => c + 2).flatMap((count) =>
      [2, 4, 5, 7, 8, 10]
        .filter((asked) => asked !== count)
        .map((asked): Entry => [
          price,
          count,
          asked,
          THINGS[(price + count + asked) % THINGS.length] ?? 'pens',
        ]),
    ),
  )
  .filter((_entry, index) => index % 2 === 0);

export const RAT_PROP_PARAMS: GeneratorParams = {
  skillCode: 'RAT.PROP',
  size: ENTRIES.length,
  at: (index) => item(index),
};

function item(index: number): CandidateItem | null {
  const entry = ENTRIES[index];
  if (entry === undefined) return null;
  const [price, count, asked, thing] = entry;
  return {
    problem: {
      skillCode: 'RAT.PROP',
      kind: 'proportion',
      count: String(count),
      total: String(price * count),
      asked: String(asked),
      thing,
    },
    answer: String(price * asked),
  };
}

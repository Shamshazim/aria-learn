import { lowest } from '@/quality/arithmetic/fraction-format';
import type { Rational } from '@/quality/arithmetic/types';

/**
 * A small exact expression evaluator (P3-07): whole numbers, one variable, + − × ÷ and
 * brackets, with "3n" read as 3 × n. Exact on rationals, so 7 ÷ 2 is 7/2 and nothing rounds.
 *
 * The rules are a parameter, because the wrong ideas are wrong rules: "left to right" is one
 * precedence level, "add first" is the levels swapped, "ignore the brackets" drops them. The
 * same evaluator then produces both the right answer and each wrong one, so the distractor and
 * the misconception it detects cannot drift apart.
 */
export type Rules = Readonly<{
  /** Lowest to highest binding. Normal is `[['+', '-'], ['×', '÷']]`. */
  levels: readonly (readonly Operator[])[];
  brackets: boolean;
}>;

export type Operator = '+' | '-' | '×' | '÷';

export const STANDARD_RULES: Rules = {
  levels: [
    ['+', '-'],
    ['×', '÷'],
  ],
  brackets: true,
};

type Token =
  | Readonly<{ kind: 'number'; value: bigint }>
  | Readonly<{ kind: 'variable' }>
  | Readonly<{ kind: 'operator'; value: Operator }>
  | Readonly<{ kind: 'open' | 'close' }>;

/** The value of `text` with the variable set to `value`; `null` if it does not parse or divides by zero. */
export function evaluate(
  text: string,
  rules: Rules = STANDARD_RULES,
  variable: Readonly<{ name: string; value: Rational }> | null = null,
): Rational | null {
  const tokens = tokenize(text, variable?.name ?? null);
  if (tokens === null) return null;
  const kept = rules.brackets
    ? tokens
    : tokens.filter((token) => token.kind !== 'open' && token.kind !== 'close');
  const parser = createParser(kept, rules, variable?.value ?? null);
  const result = parser.expression();
  return result === null || !parser.finished() ? null : lowest(result);
}

const OPERATORS: Readonly<Record<string, Operator>> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '×': '×',
  '*': '×',
  '÷': '÷',
  '/': '÷',
};

const PIECE = /\s*(\d+|[a-z]|[+\-−×*÷/()])/giu;

function tokenize(text: string, variable: string | null): Token[] | null {
  const matches = [...text.matchAll(PIECE)];
  if (
    matches
      .map((match) => match[0])
      .join('')
      .trim() !== text.trim()
  )
    return null;
  const tokens: Token[] = [];
  for (const match of matches) {
    const piece = match[1] ?? '';
    if (implicitTimes(piece, tokens.at(-1))) tokens.push({ kind: 'operator', value: '×' });
    const token = tokenOf(piece, variable);
    if (token === null) return null;
    tokens.push(token);
  }
  return tokens;
}

/** "3n" and "2(n + 1)": a number, letter or closing bracket followed by a letter or an opening one. */
function implicitTimes(piece: string, previous: Token | undefined): boolean {
  const opensSomething = piece === '(' || /^[a-z]$/iu.test(piece);
  const endsSomething =
    previous?.kind === 'number' || previous?.kind === 'variable' || previous?.kind === 'close';
  return opensSomething && endsSomething;
}

function tokenOf(piece: string, variable: string | null): Token | null {
  if (/^\d+$/u.test(piece)) return { kind: 'number', value: BigInt(piece) };
  if (/^[a-z]$/iu.test(piece)) return piece === variable ? { kind: 'variable' } : null;
  if (piece === '(') return { kind: 'open' };
  if (piece === ')') return { kind: 'close' };
  const operator = OPERATORS[piece];
  return operator === undefined ? null : { kind: 'operator', value: operator };
}

/** Recursive descent over the tokens, with its position held in the closure. */
function createParser(tokens: readonly Token[], rules: Rules, value: Rational | null) {
  let at = 0;
  const next = (): Token | undefined => {
    const token = tokens[at];
    at += 1;
    return token;
  };

  function level(index: number): Rational | null {
    const operators = rules.levels[index];
    if (operators === undefined) return atom();
    let left = level(index + 1);
    for (;;) {
      const token = tokens[at];
      if (left === null || token?.kind !== 'operator' || !operators.includes(token.value))
        return left;
      at += 1;
      const right = level(index + 1);
      if (right === null) return null;
      left = apply(token.value, left, right);
    }
  }

  function atom(): Rational | null {
    const token = next();
    if (token?.kind === 'number') return { numerator: token.value, denominator: 1n };
    if (token?.kind === 'variable') return value;
    if (token?.kind === 'operator' && token.value === '-') return negated(atom());
    return token?.kind === 'open' ? bracketed() : null;
  }

  function bracketed(): Rational | null {
    const inner = level(0);
    return next()?.kind === 'close' ? inner : null;
  }

  return { expression: () => level(0), finished: () => at === tokens.length };
}

function negated(value: Rational | null): Rational | null {
  return value === null ? null : { numerator: -value.numerator, denominator: value.denominator };
}

function apply(operator: Operator, left: Rational, right: Rational): Rational | null {
  switch (operator) {
    case '+':
      return {
        numerator: left.numerator * right.denominator + right.numerator * left.denominator,
        denominator: left.denominator * right.denominator,
      };
    case '-':
      return {
        numerator: left.numerator * right.denominator - right.numerator * left.denominator,
        denominator: left.denominator * right.denominator,
      };
    case '×':
      return {
        numerator: left.numerator * right.numerator,
        denominator: left.denominator * right.denominator,
      };
    case '÷':
      if (right.numerator === 0n) return null;
      return normalSign({
        numerator: left.numerator * right.denominator,
        denominator: left.denominator * right.numerator,
      });
  }
}

function normalSign(value: Rational): Rational {
  return value.denominator < 0n
    ? { numerator: -value.numerator, denominator: -value.denominator }
    : value;
}

/**
 * A linear expression in one variable as `a·x + b`, read off by evaluating at 0 and 1 — exact
 * for anything linear, which is all an equation at this level is. `null` if it does not parse.
 */
export function linearForm(
  text: string,
  variable: string,
): Readonly<{ a: Rational; b: Rational }> | null {
  const at = (value: bigint) =>
    evaluate(text, STANDARD_RULES, {
      name: variable,
      value: { numerator: value, denominator: 1n },
    });
  const [zero, one] = [at(0n), at(1n)];
  if (zero === null || one === null) return null;
  const a = apply('-', one, zero);
  return a === null ? null : { a: lowest(a), b: zero };
}

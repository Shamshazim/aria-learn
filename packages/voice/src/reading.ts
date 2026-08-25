import type { WordTiming } from './types';

export type AlignedWord = Readonly<{
  reference: string | null;
  spoken: string | null;
  result: 'correct' | 'substitution' | 'omission' | 'insertion';
  confidence: number;
}>;

export type ReadingAssessment = Readonly<{
  wordsCorrect: number;
  wcpm: number;
  confidence: Readonly<{
    lower: number;
    estimate: number;
    upper: number;
    level: 'low' | 'adequate';
  }>;
  aligned: readonly AlignedWord[];
  mayCreateDurableEvidence: boolean;
}>;

export function assessOralReading(
  input: Readonly<{
    passage: string;
    words: readonly WordTiming[];
    onTaskMs: number;
    speaker: 'expected' | 'uncertain';
  }>,
): ReadingAssessment {
  const reference = words(input.passage);
  const hypothesis = input.words.map((word) => normalize(word.text));
  const aligned = align(reference, hypothesis, input.words);
  const wordsCorrect = aligned.filter((word) => word.result === 'correct').length;
  const minutes = Math.max(input.onTaskMs / 60_000, 1 / 60);
  const wcpm = Math.round(wordsCorrect / minutes);
  const confidenceScore = assessmentConfidence(aligned, reference.length, input.speaker);
  const uncertainty = Math.ceil((1 - confidenceScore) * Math.max(wcpm, 1));
  return {
    wordsCorrect,
    wcpm,
    confidence: {
      lower: Math.max(0, wcpm - uncertainty),
      estimate: wcpm,
      upper: wcpm + uncertainty,
      level: confidenceScore >= 0.75 ? 'adequate' : 'low',
    },
    aligned,
    mayCreateDurableEvidence: confidenceScore >= 0.75 && input.speaker === 'expected',
  };
}

function align(
  reference: readonly string[],
  hypothesis: readonly string[],
  timings: readonly WordTiming[],
): readonly AlignedWord[] {
  const costs = initialMatrix(reference.length + 1, hypothesis.length + 1);
  for (let row = 1; row <= reference.length; row += 1) {
    for (let column = 1; column <= hypothesis.length; column += 1) {
      const same = value(reference, row - 1) === value(hypothesis, column - 1);
      setCell(
        costs,
        row,
        column,
        Math.min(
          cell(costs, row - 1, column) + 1,
          cell(costs, row, column - 1) + 1,
          cell(costs, row - 1, column - 1) + (same ? 0 : 1),
        ),
      );
    }
  }
  return traceback(costs, reference, hypothesis, timings);
}

type TracePosition = Readonly<{ row: number; column: number }>;
type TraceStep = Readonly<{ word: AlignedWord; next: TracePosition }>;
type TraceInput = Readonly<{
  costs: readonly (readonly number[])[];
  reference: readonly string[];
  hypothesis: readonly string[];
  timings: readonly WordTiming[];
  position: TracePosition;
}>;

function traceback(
  costs: readonly (readonly number[])[],
  reference: readonly string[],
  hypothesis: readonly string[],
  timings: readonly WordTiming[],
): readonly AlignedWord[] {
  const result: AlignedWord[] = [];
  let position: TracePosition = { row: reference.length, column: hypothesis.length };
  while (position.row > 0 || position.column > 0) {
    const step = traceStep({ costs, reference, hypothesis, timings, position });
    result.push(step.word);
    position = step.next;
  }
  return result.reverse();
}

function traceStep(input: TraceInput): TraceStep {
  const { costs, reference, hypothesis, timings, position } = input;
  const { row, column } = position;
  const canDiagonal = row > 0 && column > 0;
  const same = canDiagonal && value(reference, row - 1) === value(hypothesis, column - 1);
  const diagonal = canDiagonal ? cell(costs, row - 1, column - 1) : Infinity;
  if (canDiagonal && cell(costs, row, column) === diagonal + (same ? 0 : 1)) {
    return {
      word: aligned(
        value(reference, row - 1),
        value(hypothesis, column - 1),
        same,
        timings[column - 1],
      ),
      next: { row: row - 1, column: column - 1 },
    };
  }
  if (row > 0 && cell(costs, row, column) === cell(costs, row - 1, column) + 1) {
    return {
      word: {
        reference: value(reference, row - 1),
        spoken: null,
        result: 'omission',
        confidence: 0,
      },
      next: { row: row - 1, column },
    };
  }
  return {
    word: {
      reference: null,
      spoken: value(hypothesis, column - 1),
      result: 'insertion',
      confidence: timings[column - 1]?.confidence ?? 0,
    },
    next: { row, column: column - 1 },
  };
}

function aligned(
  reference: string,
  spoken: string,
  same: boolean,
  timing: WordTiming | undefined,
): AlignedWord {
  return {
    reference,
    spoken,
    result: same ? 'correct' : 'substitution',
    confidence: timing?.confidence ?? 0,
  };
}

function assessmentConfidence(
  alignedWords: readonly AlignedWord[],
  expected: number,
  speaker: 'expected' | 'uncertain',
): number {
  if (speaker === 'uncertain' || expected === 0) return 0;
  const recognized = alignedWords.filter((word) => word.spoken !== null);
  const mean =
    recognized.length === 0
      ? 0
      : recognized.reduce((sum, word) => sum + word.confidence, 0) / recognized.length;
  const coverage = recognized.filter((word) => word.reference !== null).length / expected;
  return Math.min(1, mean * coverage);
}

function words(text: string): readonly string[] {
  return text.split(/\s+/u).map(normalize).filter(Boolean);
}

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[^a-z0-9']/gu, '');
}

function initialMatrix(rows: number, columns: number): number[][] {
  return Array.from({ length: rows }, (_row, row) =>
    Array.from({ length: columns }, (_column, column) =>
      row === 0 ? column : column === 0 ? row : 0,
    ),
  );
}

function cell(matrix: readonly (readonly number[])[], row: number, column: number): number {
  const result = matrix[row]?.[column];
  if (result === undefined) throw new Error('Reading alignment index is outside the matrix');
  return result;
}

function setCell(matrix: number[][], row: number, column: number, result: number): void {
  const target = matrix[row];
  if (target === undefined) throw new Error('Reading alignment row is outside the matrix');
  target[column] = result;
}

function value(values: readonly string[], index: number): string {
  const result = values[index];
  if (result === undefined) throw new Error('Reading alignment word is missing');
  return result;
}

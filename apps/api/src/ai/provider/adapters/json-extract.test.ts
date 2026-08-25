import { describe, expect, it } from 'vitest';

import { extractJsonObject } from '@/ai/provider/adapters/json-extract';

describe('extractJsonObject', () => {
  it('extracts JSON from a markdown code fence', () => {
    expect(extractJsonObject('```json\n{"answer":4}\n```')).toBe('{"answer":4}');
  });

  it.each([
    ['leading prose', 'Here is the result: {"answer":4}', '{"answer":4}'],
    ['trailing prose', '{"answer":4} Hope that helps.', '{"answer":4}'],
  ])('extracts JSON with %s', (_case, input, expected) => {
    expect(extractJsonObject(input)).toBe(expected);
  });

  it('rejects two candidate objects instead of guessing', () => {
    expect(() => extractJsonObject('{"answer":4} or {"answer":5}')).toThrow(
      /exactly one valid JSON object/,
    );
  });
});

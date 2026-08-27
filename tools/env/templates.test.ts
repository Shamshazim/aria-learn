import { describe, expect, it } from 'vitest';

import { compareTemplates, duplicateNames, hasDrift, readEnvNames } from './templates';

describe('readEnvNames', () => {
  it('reads names and ignores comments, blanks and values', () => {
    const text = [
      '# ── Runtime ──',
      '',
      'NODE_ENV=development',
      'API_PORT=3000',
      '  export DATABASE_URL=postgresql://aria@localhost/aria',
      '# STATUS_OPERATOR_TOKEN=commented-out',
    ].join('\n');

    expect(readEnvNames(text)).toEqual(['NODE_ENV', 'API_PORT', 'DATABASE_URL']);
  });

  it('keeps a name whose value is empty, which is how a template declares one', () => {
    expect(readEnvNames('ANTHROPIC_API_KEY=')).toEqual(['ANTHROPIC_API_KEY']);
  });
});

describe('compareTemplates', () => {
  it('is quiet when the two agree', () => {
    const drift = compareTemplates(['A', 'B'], ['B', 'A']);

    expect(hasDrift(drift)).toBe(false);
  });

  it('names a variable the template forgot', () => {
    expect(compareTemplates(['A', 'B'], ['A']).missing).toEqual(['B']);
  });

  it('names a variable nothing reads', () => {
    expect(compareTemplates(['A'], ['A', 'LEFTOVER']).unknown).toEqual(['LEFTOVER']);
  });

  it('allows the ones a deployment adds, when they are declared', () => {
    const drift = compareTemplates(['A'], ['A', 'FLY_REGION'], ['FLY_REGION']);

    expect(hasDrift(drift)).toBe(false);
  });
});

describe('duplicateNames', () => {
  it('catches the second assignment that would silently win', () => {
    expect(duplicateNames(['A', 'B', 'A'])).toEqual(['A']);
  });
});

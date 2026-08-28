import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type { Queryable } from '@/db/types';

import { withDemoVoiceConsent } from './demo-consent';

const PROCESSORS = ['media', 'stt', 'tts'];

function realConsent() {
  const findGranted = vi.fn(() => Promise.resolve(null));
  const lookup = { withDb: () => lookup, findGranted };
  return lookup;
}

describe('demo voice consent', () => {
  it('grants the demo student consent over every configured processor', async () => {
    const real = realConsent();
    const lookup = withDemoVoiceConsent(real, { studentId: 'demo-1', processors: PROCESSORS });

    await expect(lookup.findGranted('demo-1')).resolves.toMatchObject({
      studentId: 'demo-1',
      status: 'granted',
      processorCategories: PROCESSORS,
      verificationReference: 'demo-student',
    });
    expect(real.findGranted).not.toHaveBeenCalled();
  });

  it('sends every other student to the real repository', async () => {
    const real = realConsent();
    const lookup = withDemoVoiceConsent(real, { studentId: 'demo-1', processors: PROCESSORS });

    await expect(lookup.findGranted('child-2')).resolves.toBeNull();
    expect(real.findGranted).toHaveBeenCalledExactlyOnceWith('child-2');
  });

  it('is the real repository when no demo student is configured', () => {
    const real = realConsent();

    expect(withDemoVoiceConsent(real, { studentId: undefined, processors: PROCESSORS })).toBe(real);
  });

  it('keeps the demo grant after rebinding to a transaction', async () => {
    const real = realConsent();
    const db: Queryable = new Pool();
    const lookup = withDemoVoiceConsent(real, { studentId: 'demo-1', processors: PROCESSORS });

    await expect(lookup.withDb(db).findGranted('demo-1')).resolves.toMatchObject({
      status: 'granted',
    });
  });
});

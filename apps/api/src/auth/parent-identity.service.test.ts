import { describe, expect, it, vi } from 'vitest';

import type { Parent } from '@/types/parent';

import { createParentIdentityService } from './parent-identity.service';

const PARENT: Parent = {
  id: 'parent-1',
  email: 'grown.up@example.test',
  supabaseUserId: 'supabase-1',
  displayName: 'Parent',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

describe('resolving a verified token to a family', () => {
  it('returns the family we already have', async () => {
    const insert = vi.fn();
    const service = createParentIdentityService({
      parents: { findBySupabaseUserId: () => Promise.resolve(PARENT), insert },
    });

    await expect(
      service.resolve({ supabaseUserId: 'supabase-1', email: 'grown.up@example.test' }),
    ).resolves.toEqual({
      id: 'parent-1',
      supabaseUserId: 'supabase-1',
      email: 'grown.up@example.test',
    });
    expect(insert).not.toHaveBeenCalled();
  });

  /**
   * The ticket's edge case: a valid JWT with no parent row. Sign-up and first use are the same
   * moment, and a family waiting for a webhook would see an empty list they cannot fix.
   */
  it('creates the family on the first authenticated call', async () => {
    const insert = vi.fn(() => Promise.resolve({ ...PARENT, id: 'parent-new' }));
    const service = createParentIdentityService({
      parents: { findBySupabaseUserId: () => Promise.resolve(null), insert },
    });

    await expect(
      service.resolve({ supabaseUserId: 'supabase-2', email: 'new@example.test' }),
    ).resolves.toMatchObject({ id: 'parent-new', supabaseUserId: 'supabase-2' });
    expect(insert).toHaveBeenCalledWith({
      email: 'new@example.test',
      supabaseUserId: 'supabase-2',
      displayName: 'Parent',
    });
  });

  /** An address changed in Supabase must not create a second family. */
  it('keys on the subject, never on the address', async () => {
    const insert = vi.fn();
    const service = createParentIdentityService({
      parents: { findBySupabaseUserId: () => Promise.resolve(PARENT), insert },
    });

    await expect(
      service.resolve({ supabaseUserId: 'supabase-1', email: 'changed@example.test' }),
    ).resolves.toMatchObject({ id: 'parent-1', email: 'grown.up@example.test' });
    expect(insert).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { createChildCredentialService } from '@/auth';
import { fakeChildCredentials, plainHasher } from '@/auth/__fixtures__/identity.fixture';
import { DEFAULT_STUDENT_SETTINGS } from '@/mappers/student.mapper';
import { createParentChildrenService } from '@/services/parent/children.service';
import type { Student } from '@/types/student';

const NOW = new Date('2026-08-25T10:00:00.000Z');

/** Real UUIDs: `childSummarySchema` parses the id, so `student-1` would not survive it. */
const SAM_ID = '00000000-0000-4000-8000-000000000001';
const PARENT_ID = '00000000-0000-4000-8000-0000000000a1';

const SAM: Student = {
  id: SAM_ID,
  parentId: PARENT_ID,
  displayName: 'Sam',
  grade: '4',
  band: 'middle',
  settings: DEFAULT_STUDENT_SETTINGS,
  createdAt: NOW,
};

function build(students: readonly Student[] = [SAM]) {
  const rows = new Map(students.map((student) => [student.id, student]));
  const update = vi.fn((id: string, changes: Record<string, unknown>) => {
    const current = rows.get(id);
    if (current === undefined) return Promise.resolve(null);
    const next = { ...current, ...changes };
    rows.set(id, next);
    return Promise.resolve(next);
  });
  const insert = vi.fn(
    (input: { parentId: string; displayName: string; grade: Student['grade'] }) =>
      Promise.resolve({ ...SAM, ...input, id: '00000000-0000-4000-8000-000000000002' }),
  );
  const service = createParentChildrenService({
    students: {
      listByParentId: (parentId) =>
        Promise.resolve([...rows.values()].filter((child) => child.parentId === parentId)),
      findById: (id) => Promise.resolve(rows.get(id) ?? null),
      insert,
      update,
    },
    credentials: createChildCredentialService({
      credentials: fakeChildCredentials(),
      hasher: plainHasher,
      clock: { now: () => NOW },
    }),
  });
  return { service, update, insert };
}

describe('a parent and their children', () => {
  it('lists only the children in the picker shape', async () => {
    const { service } = build();

    await expect(service.list(PARENT_ID)).resolves.toEqual([
      {
        id: SAM_ID,
        firstName: 'Sam',
        grade: '4',
        band: 'middle',
        avatar: 'fox',
        loginMethod: 'none',
      },
    ]);
  });

  /** Nothing about the grown-up reaches a child screen — there is no field for it. */
  it('never carries the parent id into the summary', async () => {
    const { service } = build();
    const [child] = await service.list(PARENT_ID);

    expect(JSON.stringify(child)).not.toContain(PARENT_ID);
  });

  it('refuses a child that belongs to another family, the same way it refuses one that does not exist', async () => {
    const { service } = build();

    await expect(
      service.update('00000000-0000-4000-8000-0000000000a2', SAM_ID, {}),
    ).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.update(PARENT_ID, '00000000-0000-4000-8000-0000000000ff', {}),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('merges settings key by key instead of replacing them', async () => {
    const { service, update } = build();

    await service.update(PARENT_ID, SAM_ID, { settings: { shareFirstName: false } });

    expect(update).toHaveBeenCalledWith(SAM_ID, {
      settings: { shareFirstName: false, pronunciation: null, avatar: 'fox' },
    });
  });

  /** Band is a function of grade, so the patch cannot name one. */
  it('takes a grade and leaves band to the repository', async () => {
    const { service, update } = build();

    await service.update(PARENT_ID, SAM_ID, { grade: '1' });

    expect(update).toHaveBeenCalledWith(SAM_ID, { grade: '1' });
  });

  it('sets a PIN and reports the child as a PIN child', async () => {
    const { service } = build();

    const child = await service.update(PARENT_ID, SAM_ID, { login: { pin: '4321' } });

    expect(child.loginMethod).toBe('pin');
  });

  it('will not leave a child with no way in, and writes nothing when refusing', async () => {
    const { service } = build();
    await service.update(PARENT_ID, SAM_ID, { login: { pin: '4321' } });

    await expect(
      service.update(PARENT_ID, SAM_ID, {
        login: { pin: null, pictureSequence: null, familyDevice: false },
      }),
    ).rejects.toMatchObject({ status: 400 });

    const [child] = await service.list(PARENT_ID);
    expect(child?.loginMethod).toBe('pin');
  });

  it('adds a child with the picture the parent chose', async () => {
    const { service, insert } = build();

    await service.add(PARENT_ID, { displayName: 'Ada', grade: '2', avatar: 'whale' });

    expect(insert).toHaveBeenCalledWith({
      parentId: PARENT_ID,
      displayName: 'Ada',
      grade: '2',
      settings: { shareFirstName: true, pronunciation: null, avatar: 'whale' },
    });
  });
});

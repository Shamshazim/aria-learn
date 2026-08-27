import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChildSummary } from '@aria/shared';

import { ChildPicker } from '@/features/auth/components/ChildPicker';

const sam: ChildSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'pin',
};

describe('the picker', () => {
  it('offers one big button per child', async () => {
    const onChoose = vi.fn();
    render(<ChildPicker children={[sam]} onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: /Sam/u }));

    expect(onChoose).toHaveBeenCalledExactlyOnceWith(sam);
  });

  /** The ticket's edge case: two children called the same thing, told apart on the screen. */
  it('shows a grade and a picture, so two children with one name are still two children', () => {
    const other: ChildSummary = { ...sam, id: 'other', grade: '1', avatar: 'owl' };
    render(<ChildPicker children={[sam, other]} onChoose={vi.fn()} />);

    expect(screen.getByText('Grade 4 · Fox')).toBeInTheDocument();
    expect(screen.getByText('Grade 1 · Owl')).toBeInTheDocument();
  });

  it('says plainly when nobody is set up yet', () => {
    render(<ChildPicker children={[]} onChoose={vi.fn()} />);

    expect(screen.getByText(/No one is set up on this tablet yet/u)).toBeInTheDocument();
  });
});

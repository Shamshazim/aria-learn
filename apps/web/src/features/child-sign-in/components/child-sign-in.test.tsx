import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PictureSecretPad } from './PictureSecretPad';
import { ProfilePicker } from './ProfilePicker';

import type { ChildProfile } from '../api/child-auth.api';

const ADA: ChildProfile = { studentId: 'child-1', nickname: 'Ada', avatarKey: 'fox' };
const SAM: ChildProfile = { studentId: 'child-2', nickname: 'Sam', avatarKey: null };

function pad(overrides: Partial<React.ComponentProps<typeof PictureSecretPad>> = {}) {
  const props = {
    profile: ADA,
    taps: [],
    retry: false,
    submitting: false,
    onTap: vi.fn(),
    onUndo: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  } satisfies React.ComponentProps<typeof PictureSecretPad>;
  render(<PictureSecretPad {...props} />);
  return props;
}

describe('ProfilePicker', () => {
  it('offers one named button per child, including one with no avatar chosen yet', async () => {
    const onChoose = vi.fn();
    render(<ProfilePicker profiles={[ADA, SAM]} onChoose={onChoose} />);

    // Named, not just pictured: a child using a screen reader has to be able to sign in too.
    await userEvent.click(screen.getByRole('button', { name: 'Sam' }));

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(onChoose).toHaveBeenCalledWith('child-2');
  });
});

describe('PictureSecretPad', () => {
  it('reports each tap by picture key', async () => {
    const props = pad();

    await userEvent.click(screen.getByRole('button', { name: 'Rocket' }));

    expect(props.onTap).toHaveBeenCalledWith('rocket');
  });

  it('never shows the pictures already tapped', () => {
    pad({ taps: ['apple', 'star'] });

    // Two of four dots are filled, and nothing on the screen says which pictures they were.
    const filled = document.querySelectorAll('.secret-progress__dot[data-filled="yes"]');
    expect(filled).toHaveLength(2);
    expect(screen.getByText(/2 of 4 pictures tapped/)).toBeInTheDocument();
  });

  it('stops accepting taps while an attempt is in flight', () => {
    pad({ taps: ['apple', 'star', 'boat', 'drum'], submitting: true });

    expect(screen.getByRole('button', { name: 'Apple' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('says a wrong secret out loud rather than only clearing the dots', () => {
    pad({ retry: true });

    expect(screen.getByText('That was not it. Try again.')).toBeInTheDocument();
    expect(screen.getByText(/That was not right\. Try again\./)).toBeInTheDocument();
  });
});

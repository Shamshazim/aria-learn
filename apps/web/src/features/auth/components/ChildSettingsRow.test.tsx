import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ChildSummary } from '@aria/shared';

import { ChildSettingsRow } from '@/features/auth/components/ChildSettingsRow';

const SAM: ChildSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'none',
};

describe('one child, as a grown-up sees them', () => {
  it('says how this child signs in today', () => {
    render(<ChildSettingsRow child={{ ...SAM, loginMethod: 'pin' }} onChange={vi.fn()} />);

    expect(screen.getByText(/Signs in with: pin/u)).toBeInTheDocument();
  });

  it('saves a four-digit PIN and refuses to save a shorter one', async () => {
    const onChange = vi.fn();
    render(<ChildSettingsRow child={SAM} onChange={onChange} />);
    const save = screen.getByRole('button', { name: 'Save PIN' });

    expect(save).toBeDisabled();
    await userEvent.type(screen.getByLabelText('New PIN'), '43');
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText('New PIN'), '21');
    await userEvent.click(save);

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ login: { pin: '4321' } });
  });

  /** A PIN is digits. Anything else a parent types is dropped rather than saved and refused. */
  it('keeps only digits', async () => {
    render(<ChildSettingsRow child={SAM} onChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('New PIN'), '4a3b2c1d');

    expect(screen.getByLabelText('New PIN')).toHaveValue('4321');
  });

  it('forgets the typed PIN once it is saved', async () => {
    render(<ChildSettingsRow child={SAM} onChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('New PIN'), '4321');

    await userEvent.click(screen.getByRole('button', { name: 'Save PIN' }));

    expect(screen.getByLabelText('New PIN')).toHaveValue('');
  });

  it('marks the tablet as the family’s, and back again', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ChildSettingsRow child={SAM} onChange={onChange} />);

    await userEvent.click(screen.getByLabelText(/Family device/u));
    expect(onChange).toHaveBeenCalledWith({ login: { familyDevice: true } });

    rerender(
      <ChildSettingsRow child={{ ...SAM, loginMethod: 'family-device' }} onChange={onChange} />,
    );
    await userEvent.click(screen.getByLabelText(/Family device/u));

    expect(onChange).toHaveBeenLastCalledWith({ login: { familyDevice: false } });
  });

  it('offers voice consent only where the deployment can do anything with it', async () => {
    const onConsent = vi.fn();
    const { rerender } = render(<ChildSettingsRow child={SAM} onChange={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Allow talking out loud' })).toBeNull();

    rerender(<ChildSettingsRow child={SAM} onChange={vi.fn()} onConsent={onConsent} />);
    await userEvent.click(screen.getByRole('button', { name: 'Allow talking out loud' }));

    expect(onConsent).toHaveBeenCalledOnce();
  });
});

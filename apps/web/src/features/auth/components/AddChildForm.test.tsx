import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AddChildForm } from '@/features/auth/components/AddChildForm';

describe('adding a child', () => {
  it('submits a name, a grade and the picture the parent chose', async () => {
    const onSubmit = vi.fn();
    render(<AddChildForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('First name'), 'Ada');
    await userEvent.selectOptions(screen.getByLabelText('Grade'), '7');
    await userEvent.selectOptions(screen.getByLabelText('Picture'), 'whale');
    await userEvent.click(screen.getByRole('button', { name: 'Add child' }));

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
      displayName: 'Ada',
      grade: '7',
      avatar: 'whale',
    });
  });

  /** The picture list is what a child recognises, so it is named, not numbered. */
  it('offers every picture by name', () => {
    render(<AddChildForm onSubmit={vi.fn()} />);

    const options = screen.getByLabelText('Picture');
    expect(options).toHaveTextContent('Fox');
    expect(options).toHaveTextContent('Whale');
    expect(options).toHaveTextContent('Rocket');
  });

  it('clears the name afterwards so the next child starts empty', async () => {
    render(<AddChildForm onSubmit={vi.fn()} />);
    const name = screen.getByLabelText('First name');

    await userEvent.type(name, 'Ada');
    await userEvent.click(screen.getByRole('button', { name: 'Add child' }));

    expect(name).toHaveValue('');
  });

  it('accepts nothing while a write is in flight', () => {
    render(<AddChildForm busy onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add child' })).toBeDisabled();
  });
});

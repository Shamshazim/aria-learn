import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { run as axeRun } from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { Band } from '@aria/shared';

import { useMockSession } from '@/features/session/hooks/useMockSession';
import { EarlyLayout } from '@/features/session/layouts/EarlyLayout';
import { MiddleLayout } from '@/features/session/layouts/MiddleLayout';
import { SeniorLayout } from '@/features/session/layouts/SeniorLayout';
import { mockSession } from '@/features/session/model/mock-session';

function Harness({ band }: { band: Band }): React.JSX.Element {
  const session = mockSession(band, 'math');
  const view = useMockSession(session);
  if (band === 'early') return <EarlyLayout session={session} view={view} />;
  if (band === 'middle') return <MiddleLayout session={session} view={view} />;
  return <SeniorLayout session={session} view={view} />;
}

describe.each(['early', 'middle', 'senior'] as const)('%s session layout', (band) => {
  it('runs the scripted wrong-answer, hint and correct-answer path', async () => {
    const user = userEvent.setup();
    render(<Harness band={band} />);

    await user.click(screen.getByRole('button', { name: '6' }));
    expect(screen.getByText(/Hint:/u)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '7' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/three sides/u)).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness band={band} />);
    const result = await axeRun(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });
});

it('never asks an early learner to type', () => {
  render(<Harness band="early" />);

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

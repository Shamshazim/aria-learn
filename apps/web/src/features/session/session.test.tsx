import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { run as axeRun } from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { Band, Grade } from '@aria/shared';

import { useTutorSession } from '@/features/session/hooks/useTutorSession';
import { EarlyLayout } from '@/features/session/layouts/EarlyLayout';
import { MiddleLayout } from '@/features/session/layouts/MiddleLayout';
import { SeniorLayout } from '@/features/session/layouts/SeniorLayout';
import { createScriptedSource } from '@/features/session/sources/scripted-source';

function Harness({ band }: { band: Band }): React.JSX.Element {
  const grade: Grade = band === 'early' ? '1' : band === 'middle' ? '4' : '7';
  const session = useTutorSession({
    band,
    createSource: createScriptedSource,
    grade,
    subjectId: 'math',
  });
  const layout =
    band === 'early' ? (
      <EarlyLayout session={session} />
    ) : band === 'middle' ? (
      <MiddleLayout session={session} />
    ) : (
      <SeniorLayout session={session} />
    );
  return <MemoryRouter>{layout}</MemoryRouter>;
}

describe.each(['early', 'middle', 'senior'] as const)('%s protocol session', (band) => {
  it('runs a wrong answer, hint, correct answer and ending', async () => {
    const user = userEvent.setup();
    render(<Harness band={band} />);
    await screen.findByText('What is four plus three?');

    await user.click(screen.getByRole('button', { name: '6' }));
    await screen.findByText('Try four plus three again.');
    const typedAnswer = screen.queryByRole('textbox', { name: 'Your answer' });
    if (typedAnswer === null) {
      await user.click(screen.getByRole('button', { name: '7' }));
      await user.click(screen.getByRole('button', { name: 'Answer' }));
    } else {
      await user.type(typedAnswer, '7');
      await user.click(screen.getByRole('button', { name: 'Answer' }));
    }
    await screen.findByText('Yes. You counted on from four.');
    await user.click(screen.getByRole('button', { name: 'End session' }));

    expect(await screen.findByText('You did it.')).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(<Harness band={band} />);
    await screen.findByText('What is four plus three?');
    const result = await axeRun(container, {
      rules: { 'color-contrast': { enabled: false } },
    });

    expect(result.violations).toEqual([]);
  });
});

it('never asks an early learner to type', async () => {
  render(<Harness band="early" />);
  await screen.findByText('What is four plus three?');

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

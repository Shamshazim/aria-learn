import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION } from '@aria/shared';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('waits for arrival, then uses one student grade for every subject', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(arrivalEnvelope()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  const { default: SubjectPickerPage } = await import('@/pages/SubjectPickerPage');

  render(
    <MemoryRouter>
      <SubjectPickerPage />
    </MemoryRouter>,
  );

  expect(await screen.findByRole('link', { name: /Math Grade 4/u })).toHaveAttribute(
    'href',
    '/session/4/math?voice=1&arrivalId=00000000-0000-4000-8000-000000000001',
  );
  expect(screen.queryByRole('link', { name: /Reading Grade 4/u })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Writing Grade 4/u })).toHaveAttribute(
    'href',
    '/session/4/writing?voice=1&arrivalId=00000000-0000-4000-8000-000000000001',
  );
  expect(screen.getByRole('link', { name: 'Aria Learn' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back.');
  expect(screen.getByText('Numbers, shapes and patterns.')).toBeInTheDocument();
});

function arrivalEnvelope(): unknown {
  const base = {
    at: '2026-08-24T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    speech: null,
    display: [],
    expects: 'none',
  };
  return {
    data: {
      arrivalId: '00000000-0000-4000-8000-000000000001',
      recommendedSubject: null,
      student: { grade: '4', band: 'middle' },
      moves: [
        {
          ...base,
          id: 'welcome-1',
          kind: 'WELCOME',
          speech: { text: 'Welcome back.' },
          basedOn: [],
        },
        {
          ...base,
          id: 'check-1',
          kind: 'CHECK_IN',
          speech: { text: 'Easy start or a challenge?' },
          about: 'difficulty',
        },
      ],
    },
  };
}

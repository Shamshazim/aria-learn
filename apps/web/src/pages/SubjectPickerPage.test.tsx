import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION } from '@aria/shared';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('waits for arrival, then shows exactly the classes the tutor listed', async () => {
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

  expect(await screen.findByRole('link', { name: 'Mathematics Grade 4' })).toHaveAttribute(
    'href',
    '/session/4/mathematics?voice=1&arrivalId=00000000-0000-4000-8000-000000000001',
  );
  expect(screen.queryByRole('link', { name: /Reading Grade 4/u })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'English Writing Grade 4' })).toHaveAttribute(
    'href',
    '/session/4/english-writing?voice=1&arrivalId=00000000-0000-4000-8000-000000000001',
  );
  expect(screen.getByRole('link', { name: 'Science Grade 4' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Aria Learn' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back.');
  // The face comes from the name, as it did in the legacy picker.
  expect(screen.getByText('Numbers, shapes and patterns.')).toBeInTheDocument();
  expect(screen.getByText('Put your own words on the page.')).toBeInTheDocument();
});

it('lets a developer look at the picker as another grade, by asking the API again', async () => {
  const fetchMock = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response(JSON.stringify(arrivalEnvelope()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  // The page binds `fetch` when its module loads, so it is loaded again against this stub.
  vi.resetModules();
  const { default: SubjectPickerPage } = await import('@/pages/SubjectPickerPage');

  render(
    <MemoryRouter>
      <SubjectPickerPage />
    </MemoryRouter>,
  );
  await screen.findByRole('link', { name: 'Mathematics Grade 4' });

  fireEvent.change(screen.getByRole('combobox', { name: 'Grade (development only)' }), {
    target: { value: 'TK' },
  });

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  const body = fetchMock.mock.calls[1]?.[1]?.body;
  expect(typeof body === 'string' ? body : '').toContain('"grade":"TK"');
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
      classes: [
        { subjectId: 'mathematics', name: 'Mathematics', grade: '4' },
        { subjectId: 'english-writing', name: 'English Writing', grade: '4' },
        { subjectId: 'science', name: 'Science', grade: '4' },
      ],
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

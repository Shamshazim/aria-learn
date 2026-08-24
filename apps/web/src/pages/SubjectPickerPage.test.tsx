import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';

import SubjectPickerPage from '@/pages/SubjectPickerPage';

it('renders class-first links into all three bands', () => {
  render(
    <MemoryRouter>
      <SubjectPickerPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: /Math Grade 1/u })).toHaveAttribute(
    'href',
    '/session/1/math',
  );
  expect(screen.getByRole('link', { name: /Reading Grade 4/u })).toHaveAttribute(
    'href',
    '/session/4/reading',
  );
  expect(screen.getByRole('link', { name: /Science Grade 7/u })).toHaveAttribute(
    'href',
    '/session/7/science',
  );
});

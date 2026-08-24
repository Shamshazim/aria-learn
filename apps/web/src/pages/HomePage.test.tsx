import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';

import HomePage from '@/pages/HomePage';

it('renders the accessible shell', () => {
  render(<HomePage />);

  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('learning space');
});

import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/components/ErrorBoundary';

function Broken(): React.JSX.Element {
  throw new Error('render failed');
}

it('renders a safe recovery screen when a child page throws', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Aria needs a quick reset.');
  expect(document.body).not.toHaveTextContent('render failed');
});

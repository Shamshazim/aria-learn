import { render } from '@testing-library/react';
import { run as axeRun } from 'axe-core';
import { expect, it } from 'vitest';

import HomePage from '@/pages/HomePage';

it('has no axe violations', async () => {
  const { container } = render(<HomePage />);
  const result = await axeRun(container, { rules: { 'color-contrast': { enabled: false } } });

  expect(result.violations).toEqual([]);
});

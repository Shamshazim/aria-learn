import { render, screen } from '@testing-library/react';
import { run as axeRun } from 'axe-core';
import { describe, expect, it } from 'vitest';

import type { Band } from '@aria/shared';

import { ConnectionNotice } from '@/features/session/components/ConnectionNotice';
import { CONNECTION_FAILURE_COPY } from '@/features/session/copy/failure.copy';

describe.each(['early', 'middle', 'senior'] as const)('%s connection notice', (band: Band) => {
  it('shows only the exact child-safe sentence when content is exhausted', async () => {
    const view = render(<ConnectionNotice band={band} status="offline" />);

    expect(screen.getByRole('status')).toHaveTextContent(CONNECTION_FAILURE_COPY[band]);
    expect(view.container.textContent).not.toMatch(
      /anthropic|claude|openai|gpt|gemini|503|service_unavailable|stack|error:/iu,
    );
    const result = await axeRun(view.container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });

  it('keeps provider fallback invisible while cached work continues', () => {
    const { container } = render(<ConnectionNotice band={band} status="degraded" />);

    expect(container).toBeEmptyDOMElement();
  });
});

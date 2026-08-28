import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeliveryNotice } from '@/features/session/components/DeliveryNotice';
import { DELIVERY_FAILURE_COPY } from '@/features/session/copy/failure.copy';

describe.each(['early', 'middle', 'senior'] as const)('%s delivery notice', (band) => {
  it('says the answer did not go through and offers one more try', async () => {
    const onRetry = vi.fn();
    render(<DeliveryNotice band={band} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(DELIVERY_FAILURE_COPY[band]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

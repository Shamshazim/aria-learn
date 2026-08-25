import { describe, expect, it, vi } from 'vitest';

import { prepareVoiceStartup } from './startup-handshake';

describe('voice startup handshake', () => {
  it('does not announce readiness while replay authorization is pending', async () => {
    let releaseAuthorization: (() => void) | undefined;
    const authorize = () =>
      new Promise<void>((resolve) => {
        releaseAuthorization = resolve;
      });
    const announceReady = vi.fn(() => Promise.resolve());
    const startup = prepareVoiceStartup({
      authorize,
      announceReady,
      acknowledgement: Promise.resolve(true),
    });

    await vi.waitFor(() => {
      expect(releaseAuthorization).toBeDefined();
    });
    expect(announceReady).not.toHaveBeenCalled();
    releaseAuthorization?.();

    await expect(startup).resolves.toEqual({ acknowledged: true });
    expect(announceReady).toHaveBeenCalledOnce();
  });
});

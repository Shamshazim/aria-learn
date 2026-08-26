import type { Page } from '@playwright/test';

/**
 * A device with a child already signed in (P2H-12).
 *
 * Every child screen is behind `RequireChildSession` now, and the way the app finds out
 * whether this device holds a session is by asking the API — the cookie that answers it is
 * http-only, so nothing in the page can. A browser test that wants to be on a child screen
 * therefore has to answer that one call, and this is it.
 */
export const E2E_CHILD = {
  id: '00000000-0000-4000-8000-0000000000c1',
  firstName: 'Sam',
  grade: '4',
  band: 'middle',
  avatar: 'fox',
  loginMethod: 'pin',
} as const;

export function childSession(idleMinutes = 30): unknown {
  const now = Date.now();
  return {
    child: E2E_CHILD,
    expiresAt: new Date(now + 12 * 60 * 60 * 1_000).toISOString(),
    idleExpiresAt: new Date(now + idleMinutes * 60 * 1_000).toISOString(),
  };
}

export async function signedInChild(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/child/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: childSession() }),
    }),
  );
}

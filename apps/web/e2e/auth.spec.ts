import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { PROTOCOL_VERSION } from '@aria/shared';

import { childSession, E2E_CHILD } from './fixtures/signed-in';

/**
 * P2H-12's last acceptance criterion, in a browser: parent sign-in, then the picker, then a
 * PIN, then the arrival screen.
 *
 * Supabase and our API are both intercepted. What is under test is the app's own sequencing —
 * that a device with nobody on it lands on the grown-up's screen, that the picker only appears
 * once an adult is there, and that a child with a PIN is asked for one.
 */
const SUPABASE_TOKEN = '**/auth/v1/token**';

async function stubApi(page: Page, options: Readonly<{ pinAccepted: boolean }>): Promise<void> {
  await page.route(SUPABASE_TOKEN, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'parent-access-token',
        refresh_token: 'parent-refresh-token',
        expires_in: 3_600,
      }),
    }),
  );
  // No child session on this device yet: the app has to ask, and be told no.
  await page.route('**/api/v1/auth/child/refresh', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Please sign in again.' } }),
    }),
  );
  await page.route('**/api/v1/parent/children', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { children: [E2E_CHILD] } }),
    }),
  );
  await page.route('**/api/v1/auth/child/login', (route) =>
    options.pinAccepted
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: childSession() }),
        })
      : route.fulfill({
          status: 423,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'LOCKED', message: 'Ask a grown-up for help.' } }),
        }),
  );
  await page.route('**/api/v1/student/arrival', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: arrival() }),
    }),
  );
}

test('a family goes from signing in to a child on their arrival screen', async ({ page }) => {
  await stubApi(page, { pinAccepted: true });

  await page.goto('/');

  // Nobody is signed in, so a child screen sends the device to the grown-up.
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.getByLabel('Email').fill('grown.up@example.test');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Who is learning?' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.getByRole('button', { name: /Sam/u }).click();
  await expect(page.getByText('0 of 4 digits entered')).toBeVisible();
  for (const digit of ['4', '3', '2', '1']) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }

  await expect(page.getByRole('heading', { name: 'Welcome back, Sam.' })).toBeVisible();
});

test('a locked child is told to ask a grown-up, and never shown a countdown', async ({ page }) => {
  await stubApi(page, { pinAccepted: false });

  await page.goto('/who');
  await page.getByLabel('Email').fill('grown.up@example.test');
  await page.getByLabel('Password').fill('hunter2');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /Sam/u }).click();
  for (const digit of ['0', '0', '0', '0']) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }

  await expect(page.getByRole('alert')).toHaveText('Ask a grown-up for help.');
  await expect(page.locator('body')).not.toContainText(/\d+ minutes/u);
});

function arrival(): unknown {
  const base = {
    at: '2026-08-25T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    speech: null,
    display: [],
    expects: 'none',
  };
  return {
    arrivalId: '00000000-0000-4000-8000-000000000001',
    recommendedSubject: 'math',
    student: { grade: '4', band: 'middle' },
    classes: [{ subjectId: 'mathematics', name: 'Mathematics', grade: '4' }],
    moves: [
      { ...base, id: 'welcome-1', kind: 'WELCOME', speech: { text: 'Welcome back, Sam.' } },
      {
        ...base,
        id: 'check-1',
        kind: 'CHECK_IN',
        speech: { text: 'Easy start or a challenge?' },
        about: 'difficulty',
        expects: 'choice',
      },
    ],
  };
}

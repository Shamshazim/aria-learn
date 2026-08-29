import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { PROTOCOL_VERSION, type Band, type Grade } from '@aria/shared';

import { signedInChild } from './fixtures/signed-in';

const PROFILES: readonly Readonly<{ band: Band; grade: Grade }>[] = [
  { band: 'early', grade: '1' },
  { band: 'middle', grade: '4' },
  { band: 'senior', grade: '7' },
];

for (const profile of PROFILES) {
  test(`${profile.band} arrival is visible, accessible and age-appropriate`, async ({ page }) => {
    await page.route('**/api/v1/student/arrival', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response(profile)),
      }),
    );
    await signedInChild(page);
    await page.goto('/choose');
    await page.getByRole('heading', { name: 'Welcome back, Sam.' }).waitFor();
    await expect(page.getByRole('group', { name: /easy start/i })).toBeVisible();
    await expect(page.getByText('Aria suggests')).toBeVisible();
    await expect(page.locator('.aria-owl')).toHaveCount(profile.band === 'senior' ? 0 : 2);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('choosing a class other than the recommendation stays a normal choice', async ({ page }) => {
  await page.route('**/api/v1/student/arrival', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response({ band: 'middle', grade: '4' })),
    }),
  );
  await signedInChild(page);
  await page.goto('/choose');
  await page.getByRole('heading', { name: 'Welcome back, Sam.' }).waitFor();
  await page.getByRole('link', { name: 'Writing Grade 4' }).click();
  await expect(page).toHaveURL(
    /\/session\/4\/writing\?voice=1&arrivalId=00000000-0000-4000-8000-000000000001/,
  );
});

function response(profile: Readonly<{ band: Band; grade: Grade }>): unknown {
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
      recommendedSubject: 'math',
      student: profile,
      classes: [
        { subjectId: 'mathematics', name: 'Mathematics', grade: profile.grade },
        { subjectId: 'writing', name: 'Writing', grade: profile.grade },
      ],
      moves: [
        {
          ...base,
          id: 'welcome-1',
          kind: 'WELCOME',
          speech: { text: 'Welcome back, Sam.' },
          basedOn: ['fact-1'],
        },
        {
          ...base,
          id: 'check-1',
          kind: 'CHECK_IN',
          speech: { text: 'Easy start or a challenge?' },
          about: 'difficulty',
          expects: 'choice',
        },
        {
          ...base,
          id: 'recommend-1',
          kind: 'RECOMMEND',
          speech: { text: 'Math is ready.' },
          subjectId: 'math',
          grade: profile.grade,
          reason: 'Practice is due.',
          expects: 'choice',
        },
      ],
    },
  };
}

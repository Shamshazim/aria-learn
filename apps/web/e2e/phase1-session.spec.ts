import { expect, test } from '@playwright/test';

import { PROFILES, setupSessionRoutes } from './fixtures/http-session';
import { signedInChild } from './fixtures/signed-in';

for (const profile of PROFILES) {
  test(`${profile.band} real HTTP source completes a wrong-answer session`, async ({ page }) => {
    await setupSessionRoutes(page, profile);

    await signedInChild(page);

    await page.goto(`/session/${profile.grade}/math`);
    await page.getByText('What is four plus three?').waitFor();
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByText('Start at four and count on three.').waitFor();
    await page.getByRole('button', { name: 'End session' }).click();
    await expect(page.getByRole('heading', { name: 'You did it.' })).toBeVisible();
  });
}

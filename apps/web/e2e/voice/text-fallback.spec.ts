import { expect, test } from '@playwright/test';

import { PROFILES, setupSessionRoutes } from '../fixtures/http-session';
import { signedInChild } from '../fixtures/signed-in';

/**
 * P2H-13, the text-fallback half of the browser suite. No audio device is needed: the
 * question must be answerable by tapping or typing whether or not voice ever connects, and a
 * voice that cannot connect must say so where the child is looking.
 */
for (const profile of PROFILES) {
  test(`${profile.band}: a choice question offers the choices and Talk to Aria`, async ({
    page,
  }) => {
    await setupSessionRoutes(page, profile, { expects: 'choice' });
    await signedInChild(page);
    await page.goto(`/session/${profile.grade}/math`);
    await page.getByText('What is four plus three?').waitFor();

    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: '7', exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Talk to Aria' })).toBeVisible();
  });

  test(`${profile.band}: a typed question offers a box and Talk to Aria, and the box works`, async ({
    page,
  }) => {
    await setupSessionRoutes(page, profile, { expects: 'text' });
    await signedInChild(page);
    await page.goto(`/session/${profile.grade}/math`);
    await page.getByText('What is four plus three?').waitFor();

    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Talk to Aria' })).toBeVisible();
    const box = main.getByRole('textbox', { name: 'Your answer' });
    await box.fill('6');
    await box.press('Enter');
    await page.getByText('Start at four and count on three.').waitFor();
  });

  test(`${profile.band}: voice without consent is disabled with a reason, not silent`, async ({
    page,
  }) => {
    await setupSessionRoutes(page, profile, { realtime: 403 });
    await signedInChild(page);
    await page.goto(`/session/${profile.grade}/math?voice=1`);
    await page.getByText('What is four plus three?').waitFor();

    const main = page.getByRole('main');
    const talk = main.getByRole('button', { name: 'Talk to Aria' });
    await expect(talk).toBeDisabled();
    await expect(main.locator('#speak-reason')).toContainText(/off/iu);
    // Tapping still answers.
    await main.getByRole('button', { name: '6', exact: true }).click();
    await page.getByText('Start at four and count on three.').waitFor();
  });

  test(`${profile.band}: a re-sent question is shown once and still answerable`, async ({
    page,
  }) => {
    await setupSessionRoutes(page, profile, { resyncFirstTurn: true });
    await signedInChild(page);
    await page.goto(`/session/${profile.grade}/math`);
    await page.getByText('What is four plus three?').waitFor();

    await page.getByRole('button', { name: '6', exact: true }).click();
    await expect(page.getByText('What is four plus three?')).toHaveCount(1);
    await expect(page.locator('body')).not.toContainText("didn't go through");
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByText('Start at four and count on three.').waitFor();
  });
}

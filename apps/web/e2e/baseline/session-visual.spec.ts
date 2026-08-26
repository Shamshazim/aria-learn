import { expect, test } from '@playwright/test';

import { answerWrong, BAND_ROUTES, finishSession } from '../fixtures/scripted-session';
import { signedInChild } from '../fixtures/signed-in';

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

test('class picker baseline', async ({ page }) => {
  await signedInChild(page);
  await page.goto('/');
  await page.getByRole('heading', { level: 1 }).waitFor();
  await expect(page).toHaveScreenshot('class-picker.png', { animations: 'disabled' });
});

for (const [band, route] of Object.entries(BAND_ROUTES)) {
  test(`${band} first question baseline`, async ({ page }) => {
    await signedInChild(page);
    await page.goto(`${route}?scenario=first-visit`);
    await page.getByText('What is four plus three?').waitFor();
    if (band !== 'early' && (page.viewportSize()?.width ?? 0) <= 1080) {
      await expect(page.getByRole('textbox', { name: 'Ask Aria on this screen' })).toBeVisible();
    }
    await expect(page).toHaveScreenshot(`${band}-first.png`, { animations: 'disabled' });
  });

  test(`${band} wrong answer baseline`, async ({ page }) => {
    await signedInChild(page);
    await page.goto(`${route}?scenario=first-visit`);
    await page.getByText('What is four plus three?').waitFor();
    await answerWrong(page);
    await expect(page).toHaveScreenshot(`${band}-wrong.png`, { animations: 'disabled' });
  });

  test(`${band} end card baseline`, async ({ page }) => {
    await signedInChild(page);
    await page.goto(`${route}?scenario=first-visit`);
    await page.getByText('What is four plus three?').waitFor();
    await finishSession(page);
    await expect(page).toHaveScreenshot(`${band}-end.png`, { animations: 'disabled' });
  });
}

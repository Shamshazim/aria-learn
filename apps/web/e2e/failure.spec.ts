import { expect, test } from '@playwright/test';

test('content failure keeps work and recovers in place', async ({ page }) => {
  await page.goto('/session/7/math');
  await page.getByText('What is four plus three?').waitFor();
  await page.getByRole('button', { name: '6' }).click();
  const answer = page.getByRole('textbox', { name: 'Your answer' });
  await answer.fill('7');

  await page.evaluate(() => window.dispatchEvent(new Event('offline')));

  const notice = page.getByText(/Aria can't reach her brain right now/u);
  await expect(notice).toBeVisible();
  await expect(answer).toHaveValue('7');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(notice).toHaveCount(0);
  await expect(answer).toHaveValue('7');
});

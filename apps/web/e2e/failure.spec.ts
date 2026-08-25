import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('content failure keeps work and recovers in place', async ({ context, page }) => {
  await page.goto('/session/7/math?failure=content');
  await page.getByText('What is four plus three?').waitFor();
  await page.getByRole('button', { name: '6' }).click();
  const answer = page.getByRole('textbox', { name: 'Your answer' });
  await answer.fill('7');

  const notice = page.getByText(/Aria can't reach her brain right now/u);
  await expect(notice).toHaveCount(0);
  await expect(answer).toHaveValue('7');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(notice).toBeVisible();
  await expect(answer).toHaveValue('7');
  await expect(page.locator('body')).not.toContainText(/vendor|model|service_unavailable|stack/u);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await context.setOffline(false);
  await expect(notice).toHaveCount(0);
  await expect(page.getByText('Yes. You counted on from four.')).toBeVisible();
});

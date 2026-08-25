import type { Page } from '@playwright/test';

export const BAND_ROUTES = {
  early: '/session/1/math',
  middle: '/session/4/reading',
  senior: '/session/7/science',
} as const;

export async function answerWrong(page: Page): Promise<void> {
  await page.getByRole('button', { name: '6' }).click();
  await page.getByText('Try four plus three again.').waitFor();
}

export async function finishSession(page: Page): Promise<void> {
  const input = page.getByRole('textbox', { name: 'Your answer' });
  if (await input.isVisible()) {
    await input.fill('7');
    await page.getByRole('button', { name: 'Answer' }).click();
  } else {
    await page.getByRole('button', { name: '7', exact: true }).click();
  }
  await page.getByText('Yes. You counted on from four.').waitFor();
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('heading', { name: 'You did it.' }).waitFor();
}

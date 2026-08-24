import type { Page } from '@playwright/test';

export const BAND_ROUTES = {
  early: '/session/1/math',
  middle: '/session/4/reading',
  senior: '/session/7/science',
} as const;

export async function answerWrong(page: Page): Promise<void> {
  await page.getByRole('button', { name: '6' }).click();
  await page.getByText(/Hint:/u).waitFor();
}

export async function finishSession(page: Page): Promise<void> {
  for (const answer of ['7', 'Triangle', '20']) {
    await page.getByRole('button', { name: answer, exact: true }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.getByRole('heading', { name: 'You did it.' }).waitFor();
}

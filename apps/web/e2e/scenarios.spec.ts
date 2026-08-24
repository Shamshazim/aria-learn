import { expect, test } from '@playwright/test';

import { BAND_ROUTES } from './fixtures/scripted-session';

const SCENARIOS = {
  arrival: 'Math is ready when you are.',
  confusion: 'Let us try a picture instead.',
  ending: 'You did it.',
  fatigue: 'Welcome back. We can continue here.',
  'first-visit': 'What is four plus three?',
  interruption: 'You explained your idea clearly.',
  'returning-child': 'That is a thoughtful question. Let us look together.',
  silence: 'Take your time. Tell me when you are ready.',
} as const;

for (const [band, route] of Object.entries(BAND_ROUTES)) {
  test(`${band} layout runs every authored scenario`, async ({ page }) => {
    for (const [scenario, terminalText] of Object.entries(SCENARIOS)) {
      await page.goto(`${route}?scenario=${scenario}`);
      await page.getByText(terminalText).waitFor();
      await expect(page.locator('.session-layout')).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('Something went wrong');
    }
  });
}

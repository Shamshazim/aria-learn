import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { BAND_ROUTES } from '../fixtures/scripted-session';

test.beforeEach(async ({ page }) => page.emulateMedia({ reducedMotion: 'reduce' }));

for (const route of ['/choose', ...Object.values(BAND_ROUTES)]) {
  test(`${route} has no accessibility violations`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole('heading', { level: 1 }).waitFor();
    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations).toEqual([]);
  });
}

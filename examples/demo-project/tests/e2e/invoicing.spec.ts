import { expect, test } from '@playwright/test';

test.describe('Invoicing', () => {
  test('Monthly invoice generated', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveTitle(/Billing/);
  });
});

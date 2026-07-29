import { expect, test } from '@playwright/test';

test.describe('Login', () => {
  test('Successful login', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/Sign in/);
  });

  test('Wrong password', async ({ page }) => {
    await page.goto('/sign-in');
    await expect(page).toHaveTitle(/Sign in/);
  });
});

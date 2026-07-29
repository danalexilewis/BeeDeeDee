import { expect, test } from '@playwright/test';

test.describe('catalog', () => {
  test('lists every feature in the demo project', async ({ page }) => {
    await page.goto('/');

    const cards = page.getByTestId('feature-card');
    await expect(cards).toHaveCount(5);

    // Scoped to cards, since feature titles also appear in their file paths.
    for (const title of ['Login', 'Password reset', 'Invoicing', 'Refunds', 'Exports']) {
      await expect(cards.filter({ hasText: title })).toHaveCount(1);
    }
  });

  test('reports project totals in the header', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('index-state')).toContainText('5 features');
    await expect(page.getByTestId('overall-coverage')).toBeVisible();
  });

  test('shows the live indicator once server-sent events connect', async ({ page }) => {
    await page.goto('/');

    const indicator = page.getByTestId('live-indicator');
    await expect(indicator).toHaveAttribute('data-connected', 'true', { timeout: 15_000 });
    await expect(indicator).toContainText('Live');
  });

  test('filters by status and records it in the URL', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'untested' }).click();

    await expect(page).toHaveURL(/status=untested/);
    const badges = page.getByTestId('status-badge');
    await expect(badges.first()).toHaveAttribute('data-status', 'untested');
  });

  test('restores a filter from a shared URL', async ({ page }) => {
    // Filters live in the URL precisely so a filtered view can be shared.
    await page.goto('/?status=untested');

    await expect(page.getByRole('button', { name: 'untested' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('filters by tag', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '@billing' }).click();

    await expect(page).toHaveURL(/tags=billing/);
    await expect(page.getByTestId('feature-card')).toHaveCount(2);
  });

  test('searches by text', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search features').fill('invoiced');

    await expect(page).toHaveURL(/search=invoiced/);
    await expect(page.getByTestId('feature-card')).toHaveCount(1);
  });

  test('explains an empty result', async ({ page }) => {
    await page.goto('/?search=nothingmatchesthis');
    await expect(page.getByText('No features match these filters')).toBeVisible();
  });

  test('navigates into a feature', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('feature-card').filter({ hasText: 'Login' }).first().click();

    await expect(page).toHaveURL(/\/features\//);
    await expect(page.getByTestId('scenario-list')).toBeVisible();
  });
});

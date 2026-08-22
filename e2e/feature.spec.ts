import { expect, test } from '@playwright/test';

/** The demo project's login feature, whose id derives from its nested path. */
const LOGIN_FEATURE = '/features/authentication.login';

test.describe('feature view', () => {
  test('shows the three panels', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    await expect(page.getByTestId('scenario-list')).toBeVisible();
    await expect(page.getByTestId('gherkin-steps')).toBeVisible();
  });

  test('lists every scenario, including one inside a Rule', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    const items = page.getByTestId('scenario-list-item');
    await expect(items).toHaveCount(4);
    await expect(page.getByText('Session times out')).toBeVisible();
  });

  test('selects the first scenario by default', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    await expect(page.getByTestId('scenario-list-item').first()).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  test('switches scenario and records the selection in the URL', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);
    await page.getByTestId('scenario-list-item').nth(2).click();

    await expect(page).toHaveURL(/scenario=/);
    await expect(page.getByTestId('scenario-list-item').nth(2)).toHaveAttribute(
      'aria-current',
      'true'
    );
  });

  test('restores a scenario selection from a shared URL', async ({ page }) => {
    await page.goto(`${LOGIN_FEATURE}?scenario=authentication.login.locked-account`);

    await expect(page.getByRole('heading', { name: 'Locked account' })).toBeVisible();
  });

  test('renders the steps of the selected scenario', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    const steps = page.getByTestId('gherkin-steps');
    await expect(steps).toContainText('a registered member');
    await expect(steps).toContainText('they submit valid credentials');
  });

  test('renders a linked diagram as SVG', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    const diagram = page.getByTestId('mermaid-diagram');
    await expect(diagram).toBeVisible();
    await expect(diagram.locator('svg')).toBeVisible({ timeout: 15_000 });
  });

  test('offers editor deep links for the selected scenario', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);

    // Requirement 5: links open the spec at the scenario's line.
    const link = page.getByRole('link', { name: /vscode/ }).first();
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href).toContain('vscode://file/');
    expect(href).toContain('login.feature');
    expect(href).toMatch(/:\d+$/);
  });

  test('says so when a scenario has no test', async ({ page }) => {
    await page.goto(`${LOGIN_FEATURE}?scenario=authentication.login.locked-account`);
    await expect(page.getByText('No test covers this scenario yet.')).toBeVisible();
  });

  test('shows a linked test for a covered scenario', async ({ page }) => {
    await page.goto(LOGIN_FEATURE);
    await expect(page.getByTestId('test-links')).toBeVisible();
    await expect(page.getByTestId('test-links')).toContainText('login.spec.ts');
  });

  test('reports an unknown feature rather than rendering an empty view', async ({ page }) => {
    await page.goto('/features/does.not.exist');
    await expect(page.getByRole('alert')).toContainText('Feature not found');
  });
});

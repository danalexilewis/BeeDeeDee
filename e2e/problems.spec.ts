import { expect, test } from '@playwright/test';

test.describe('problems view', () => {
  test('reports the demo project as clean of parse errors', async ({ page }) => {
    await page.goto('/problems');

    // The demo project parses cleanly, so any parse-problem list must be absent.
    await expect(page.getByTestId('parse-problems')).toHaveCount(0);
  });

  test('lists lint findings for specs that need attention', async ({ page }) => {
    await page.goto('/problems');

    // The exports feature is deliberately untagged, so the lint rule fires and
    // this view has something real to show.
    await expect(page.getByTestId('lint-findings')).toBeVisible();
    await expect(page.getByText('untagged-feature')).toBeVisible();
  });

  test('is reachable from the header', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Problems' }).click();

    await expect(page).toHaveURL(/\/problems/);
  });
});

test.describe('invalid Gherkin', () => {
  test('validate reports unparseable input as invalid rather than failing', async ({ request }) => {
    const response = await request.post('/api/gherkin/validate', {
      data: { gherkin: 'this is not gherkin at all' },
    });

    expect(response.status()).toBe(200);
    const validation = (await response.json()) as { valid: boolean; compatibility: number };
    expect(validation.valid).toBe(false);
    expect(validation.compatibility).toBe(0);
  });

  test('validate accepts Gherkin that follows the demo project conventions', async ({
    request,
  }) => {
    const response = await request.post('/api/gherkin/validate', {
      data: {
        gherkin:
          '@auth\nFeature: Sign out\n  Scenario: Member signs out\n    Given a registered member\n',
      },
    });

    const validation = (await response.json()) as { valid: boolean };
    expect(validation.valid).toBe(true);
  });

  test('lint reports the untagged feature', async ({ request }) => {
    const response = await request.post('/api/lint', { data: {} });
    expect(response.status()).toBe(200);

    const findings = (await response.json()) as Array<{ rule: string; path: string }>;
    expect(findings.some(finding => finding.rule === 'untagged-feature')).toBe(true);
  });
});

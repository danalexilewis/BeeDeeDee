import { expect, test, type APIRequestContext } from '@playwright/test';

const LOGIN_FEATURE = '/features/authentication.login';

/** The test file the demo project links to that scenario. */
const TEST_FILE = 'tests/e2e/login.spec.ts';

/** Ingests a result for the covered scenario, as a CI run would. */
async function ingest(
  request: APIRequestContext,
  status: 'pass' | 'fail',
  timestamp: string,
  errorMessage?: string
): Promise<void> {
  const response = await request.post('/api/tests/results', {
    data: {
      format: 'native',
      results: [
        {
          testId: `${TEST_FILE}:4`,
          testName: 'Login Successful login',
          status,
          timestamp,
          file: TEST_FILE,
          line: 4,
          tags: [],
          ...(errorMessage === undefined ? {} : { errorMessage }),
        },
      ],
    },
  });

  expect(response.status()).toBe(202);
}

test.describe('live updates over server-sent events', () => {
  test('a failing ingest reaches an open feature view without a reload', async ({
    page,
    request,
  }) => {
    // Requirement 6: status must follow an ingest without the user refreshing.
    await page.goto(LOGIN_FEATURE);

    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-connected', 'true', {
      timeout: 15_000,
    });

    await ingest(request, 'fail', '2026-07-29T12:00:00.000Z', 'expected dashboard, saw sign-in');

    const badge = page.getByTestId('status-badge').filter({ hasText: 'Failing' }).first();
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('test-error')).toContainText('expected dashboard');
  });

  test('a passing ingest clears the failure', async ({ page, request }) => {
    await ingest(request, 'fail', '2026-07-29T12:00:00.000Z', 'boom');
    await page.goto(LOGIN_FEATURE);

    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-connected', 'true', {
      timeout: 15_000,
    });

    await ingest(request, 'pass', '2026-07-29T13:00:00.000Z');

    await expect(
      page.getByTestId('status-badge').filter({ hasText: 'Passing' }).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the catalog reflects an ingest', async ({ page, request }) => {
    await page.goto('/');

    await expect(page.getByTestId('live-indicator')).toHaveAttribute('data-connected', 'true', {
      timeout: 15_000,
    });

    await ingest(request, 'fail', '2026-07-29T14:00:00.000Z', 'still broken');

    const loginCard = page.getByTestId('feature-card').filter({ hasText: 'Login' }).first();
    await expect(loginCard.getByTestId('status-badge')).toHaveAttribute('data-status', 'failing', {
      timeout: 15_000,
    });
  });
});

test.describe('API served alongside the UI', () => {
  test('reports index status', async ({ request }) => {
    const response = await request.get('/api/index/status');
    expect(response.status()).toBe(200);

    const status = (await response.json()) as { state: string; featureCount: number };
    expect(status.state).toBe('ready');
    expect(status.featureCount).toBe(6);
  });

  test('reports no parse problems for the demo project', async ({ request }) => {
    const response = await request.get('/api/index/status');
    const status = (await response.json()) as { problems: unknown[] };
    expect(status.problems).toEqual([]);
  });

  test('keeps an unknown API path as JSON rather than serving the SPA shell', async ({
    request,
  }) => {
    const response = await request.get('/api/not-a-route');
    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('serves the SPA shell for a client route', async ({ request }) => {
    const response = await request.get('/features/authentication.login');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  });

  test('rejects a malformed ingest with 422', async ({ request }) => {
    const response = await request.post('/api/tests/results', {
      data: { format: 'playwright-json', report: { suites: 'not an array' } },
    });
    expect(response.status()).toBe(422);
  });
});

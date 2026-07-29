import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRouter } from '@/router';
import { aDiagram, aFeatureDetail, aScenario, aTestStatus } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/harness';
import { restoreFetch, stubFetch } from '@/test/stub-fetch';

afterEach(restoreFetch);

const READY_STATUS = {
  state: 'ready',
  featureCount: 1,
  scenarioCount: 2,
  diagramCount: 1,
  testFileCount: 1,
  lastIndexedAt: '2026-07-29T10:00:00.000Z',
  durationMs: 5,
  problems: [],
};

async function renderAt(url: string) {
  const router = createAppRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [url] }) });
  return renderWithProviders(<RouterProvider router={router} />, createTestQueryClient());
}

const TWO_SCENARIOS = [
  aScenario(),
  aScenario({
    id: 'login.locked-account',
    name: 'Locked account',
    status: aTestStatus({ scenarioId: 'login.locked-account', overall: 'fail' }),
  }),
];

describe('feature route', () => {
  test('renders the three panels', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail({ scenarios: TWO_SCENARIOS }) },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');

    await expect.element(screen.getByTestId('scenario-list')).toBeVisible();
    await expect.element(screen.getByText('Successful login').first()).toBeVisible();
    await expect.element(screen.getByTestId('gherkin-steps')).toBeVisible();
  });

  test('selects the first scenario when the URL names none', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail({ scenarios: TWO_SCENARIOS }) },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');

    const items = screen.getByTestId('scenario-list-item');
    await expect.element(items.first()).toHaveAttribute('aria-current', 'true');
  });

  test('honours the scenario named in the URL', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail({ scenarios: TWO_SCENARIOS }) },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login?scenario=login.locked-account');

    await expect
      .element(screen.getByTestId('scenario-list-item').nth(1))
      .toHaveAttribute('aria-current', 'true');
  });

  test('switches scenario on click, so the middle panel follows the selection', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail({ scenarios: TWO_SCENARIOS }) },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');
    await screen.getByTestId('scenario-list-item').nth(1).click();

    await expect
      .element(screen.getByTestId('scenario-list-item').nth(1))
      .toHaveAttribute('aria-current', 'true');
  });

  test('shows a failing test with its error output', async () => {
    stubFetch({
      '/api/features/login': {
        body: aFeatureDetail({
          scenarios: [
            aScenario({
              testLinks: [
                {
                  testId: 'tests/e2e/login.spec.ts:3',
                  framework: 'playwright',
                  path: 'tests/e2e/login.spec.ts',
                  line: 3,
                  status: 'fail',
                  errorMessage: 'expected dashboard, saw login',
                },
              ],
            }),
          ],
        }),
      },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');

    await expect.element(screen.getByTestId('test-links')).toBeVisible();
    await expect
      .element(screen.getByTestId('test-error'))
      .toHaveTextContent('expected dashboard, saw login');
  });

  test('says so when no test covers a scenario', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail() },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');
    await expect.element(screen.getByText('No test covers this scenario yet.')).toBeVisible();
  });

  test('renders a linked diagram in the right panel', async () => {
    stubFetch({
      '/api/features/login': {
        body: aFeatureDetail({
          scenarios: [aScenario({ diagramLinks: [aDiagram().link] })],
        }),
      },
      '/api/diagrams/login': { body: aDiagram() },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');

    await expect.element(screen.getByText('Login flow')).toBeVisible();
    await expect.element(screen.getByTestId('mermaid-diagram')).toBeVisible();
  });

  test('says so when no diagram matched', async () => {
    stubFetch({
      '/api/features/login': { body: aFeatureDetail() },
      '/api/index/status': { body: READY_STATUS },
      '/api/editor-links': { body: [] },
    });

    const screen = await renderAt('/features/login');
    await expect.element(screen.getByText('No diagram linked')).toBeVisible();
  });

  test('reports a missing feature as an error', async () => {
    stubFetch({
      '/api/features/nope': {
        status: 404,
        body: { tag: 'FeatureNotFound', message: 'Feature not found: nope' },
      },
      '/api/index/status': { body: READY_STATUS },
    });

    const screen = await renderAt('/features/nope');
    await expect.element(screen.getByRole('alert')).toHaveTextContent('Feature not found: nope');
  });
});

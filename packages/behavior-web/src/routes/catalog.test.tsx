import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRouter } from '@/router';
import { aCatalog, aFeatureSummary } from '@/test/fixtures';
import { createTestQueryClient, renderWithProviders } from '@/test/harness';
import { restoreFetch, stubFetch } from '@/test/stub-fetch';

afterEach(restoreFetch);

/** Renders the app at a given URL so route code and search params are exercised. */
async function renderAt(url: string) {
  const router = createAppRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [url] }) });
  const client = createTestQueryClient();
  return renderWithProviders(<RouterProvider router={router} />, client);
}

/** Feature list of the requested size, for exercising virtualisation. */
function manyFeatures(count: number) {
  return Array.from({ length: count }, function toFeature(_unused, index) {
    return aFeatureSummary({
      id: `feature-${index}`,
      title: `Feature ${String(index).padStart(3, '0')}`,
      path: `specs/features/feature-${index}.feature`,
    });
  });
}

describe('catalog route', () => {
  test('lists the features the API returns', async () => {
    stubFetch({
      '/api/catalog': { body: aCatalog() },
      '/api/features': { body: [aFeatureSummary()] },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 1,
          scenarioCount: 2,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: '2026-07-29T10:00:00.000Z',
          durationMs: 5,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/');

    const card = screen.getByTestId('feature-card');
    await expect.element(card).toBeVisible();
    await expect.element(card).toHaveTextContent('Login');
    await expect.element(screen.getByText('specs/features/login.feature')).toBeVisible();
  });

  test('shows the project-level status counts', async () => {
    stubFetch({
      '/api/catalog': {
        body: aCatalog({ statusCounts: { passing: 3, failing: 1, untested: 2 } }),
      },
      '/api/features': { body: [aFeatureSummary()] },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 6,
          scenarioCount: 9,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/');
    await expect.element(screen.getByText('3 passing, 1 failing, 2 untested')).toBeVisible();
  });

  test('reads the status filter from the URL and marks the button pressed', async () => {
    const { calls } = stubFetch({
      '/api/catalog': { body: aCatalog() },
      '/api/features': { body: [aFeatureSummary({ status: 'failing' })] },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 1,
          scenarioCount: 1,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/?status=failing');

    await expect
      .element(screen.getByRole('button', { name: 'failing' }))
      .toHaveAttribute('aria-pressed', 'true');

    // The filter must reach the API, not just style a button.
    await expect
      .poll(function requestedWithFilter() {
        return calls.some(call => call.includes('status=failing'));
      })
      .toBe(true);
  });

  test('sends the search term from the URL to the API', async () => {
    const { calls } = stubFetch({
      '/api/catalog': { body: aCatalog() },
      '/api/features': { body: [aFeatureSummary()] },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 1,
          scenarioCount: 1,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    await renderAt('/?search=invoice');

    await expect
      .poll(function requestedWithSearch() {
        return calls.some(call => call.includes('search=invoice'));
      })
      .toBe(true);
  });

  test('explains an empty result rather than showing a blank panel', async () => {
    stubFetch({
      '/api/catalog': { body: aCatalog() },
      '/api/features': { body: [] },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 0,
          scenarioCount: 0,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/?search=zzzz');
    await expect.element(screen.getByText('No features match these filters')).toBeVisible();
  });

  test('reports indexing rather than an error while the first scan runs', async () => {
    stubFetch({
      '/api/catalog': { status: 503, body: { tag: 'IndexNotReady', message: 'not ready' } },
      '/api/features': { status: 503, body: { tag: 'IndexNotReady', message: 'not ready' } },
      '/api/index/status': {
        body: {
          state: 'indexing',
          featureCount: 0,
          scenarioCount: 0,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/');
    await expect.element(screen.getByText(/Indexing your specifications/)).toBeVisible();
  });

  test('renders only the visible rows for a large catalog', async () => {
    // Requirement 11: the catalog must stay responsive with many features. Real
    // measurement is why this runs in a browser rather than jsdom.
    const features = manyFeatures(500);
    stubFetch({
      '/api/catalog': { body: aCatalog({ features }) },
      '/api/features': { body: features },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 500,
          scenarioCount: 1000,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/');

    await expect.element(screen.getByTestId('virtualized-list')).toBeVisible();
    await expect.element(screen.getByText('Feature 000')).toBeVisible();

    const rendered = screen.container.querySelectorAll('[data-testid="feature-card"]').length;
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(features.length);
  });

  test('renders every row without virtualising a small catalog', async () => {
    const features = manyFeatures(5);
    stubFetch({
      '/api/catalog': { body: aCatalog({ features }) },
      '/api/features': { body: features },
      '/api/index/status': {
        body: {
          state: 'ready',
          featureCount: 5,
          scenarioCount: 10,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        },
      },
    });

    const screen = await renderAt('/');
    await expect.element(screen.getByText('Feature 004')).toBeVisible();

    expect(screen.container.querySelector('[data-testid="virtualized-list"]')).toBeNull();
    expect(screen.container.querySelectorAll('[data-testid="feature-card"]').length).toBe(5);
  });
});

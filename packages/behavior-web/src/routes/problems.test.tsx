import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRouter } from '@/router';
import { createTestQueryClient, renderWithProviders } from '@/test/harness';
import { restoreFetch, stubFetch } from '@/test/stub-fetch';

afterEach(restoreFetch);

function statusWith(problems: unknown[]) {
  return {
    state: 'ready',
    featureCount: 1,
    scenarioCount: 1,
    diagramCount: 0,
    testFileCount: 0,
    lastIndexedAt: '2026-07-29T10:00:00.000Z',
    durationMs: 4,
    problems,
  };
}

async function renderAt(url: string) {
  const router = createAppRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [url] }) });
  return renderWithProviders(<RouterProvider router={router} />, createTestQueryClient());
}

describe('problems route', () => {
  test('reports a clean project', async () => {
    stubFetch({
      '/api/index/status': { body: statusWith([]) },
      'POST /api/lint': { body: [] },
    });

    const screen = await renderAt('/problems');
    await expect.element(screen.getByText('No problems found')).toBeVisible();
  });

  test('lists files that could not be parsed', async () => {
    stubFetch({
      '/api/index/status': {
        body: statusWith([
          {
            path: 'specs/features/broken.feature',
            error: { tag: 'GherkinSyntax', message: 'unexpected token at 4:3' },
          },
        ]),
      },
      'POST /api/lint': { body: [] },
    });

    const screen = await renderAt('/problems');

    await expect.element(screen.getByTestId('parse-problems')).toBeVisible();
    await expect.element(screen.getByText('specs/features/broken.feature')).toBeVisible();
    await expect.element(screen.getByText('unexpected token at 4:3')).toBeVisible();
  });

  test('lists lint findings with their rule and severity', async () => {
    stubFetch({
      '/api/index/status': { body: statusWith([]) },
      'POST /api/lint': {
        body: [
          {
            path: 'specs/features/messy.feature',
            rule: 'untagged-feature',
            severity: 'info',
            message: 'Feature "Messy" has no tags',
            line: 1,
          },
        ],
      },
    });

    const screen = await renderAt('/problems');

    await expect.element(screen.getByTestId('lint-findings')).toBeVisible();
    await expect.element(screen.getByText('untagged-feature')).toBeVisible();
    await expect.element(screen.getByText('Feature "Messy" has no tags')).toBeVisible();
  });

  test('shows a suggested fix when the rule provides one', async () => {
    stubFetch({
      '/api/index/status': { body: statusWith([]) },
      'POST /api/lint': {
        body: [
          {
            path: 'a.feature',
            rule: 'inconsistent-step-keyword',
            severity: 'warning',
            message: 'opens with And',
            line: 3,
            suggestedFix: { from: 'And', to: 'Given' },
          },
        ],
      },
    });

    const screen = await renderAt('/problems');
    await expect.element(screen.getByText(/Suggested: replace/)).toBeVisible();
  });

  test('links to the problems page from the header when problems exist', async () => {
    stubFetch({
      '/api/catalog': {
        body: {
          features: [],
          totalScenarios: 0,
          overallCoverage: 0,
          statusCounts: { passing: 0, failing: 0, untested: 0 },
          tags: [],
        },
      },
      '/api/features': { body: [] },
      '/api/index/status': {
        body: statusWith([{ path: 'a.feature', error: { tag: 'GherkinSyntax', message: 'bad' } }]),
      },
    });

    const screen = await renderAt('/');
    await expect.element(screen.getByRole('link', { name: /1 problem/ })).toBeVisible();
  });
});

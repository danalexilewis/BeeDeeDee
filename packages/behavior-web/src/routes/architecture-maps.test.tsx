import type { ArchitectureMap, ArchitectureMapSummary } from '@eddy/behavior-contracts';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { createAppRouter } from '@/router';
import { createTestQueryClient, renderWithProviders } from '@/test/harness';
import { restoreFetch, stubFetch } from '@/test/stub-fetch';

afterEach(restoreFetch);

const INDEX_STATUS = {
  state: 'ready' as const,
  featureCount: 1,
  scenarioCount: 1,
  diagramCount: 0,
  architectureMapCount: 1,
  testFileCount: 0,
  lastIndexedAt: '2026-07-29T10:00:00.000Z',
  durationMs: 5,
  problems: [],
};

const SUMMARY: ArchitectureMapSummary = {
  id: 'overview',
  title: 'Overview',
  description: 'Demo map',
  path: 'specs/mappings/overview.architecture.json',
  flowNodeCount: 1,
  domainNodeCount: 1,
  lineageCount: 1,
  linkedFeatureIds: ['login'],
};

const MAP: ArchitectureMap = {
  schemaVersion: '0.1',
  id: 'overview',
  path: SUMMARY.path,
  title: SUMMARY.title,
  description: SUMMARY.description,
  dividerY: 400,
  userFlows: {
    nodes: [
      {
        id: 'login',
        label: 'Login',
        kind: 'stage',
        position: { x: 40, y: 40 },
        description: '',
        featureId: 'login',
        dataCollected: [],
        requiredToProceed: [],
        zoomRevealAt: 0,
        collapsedByDefault: false,
      },
    ],
    edges: [],
  },
  domainModel: {
    nodes: [
      {
        id: 'user',
        label: 'User',
        kind: 'entity',
        position: { x: 40, y: 500 },
        description: '',
        dataType: '',
      },
    ],
    edges: [],
  },
  lineage: [],
};

async function renderAt(url: string) {
  const router = createAppRouter();
  router.update({ history: createMemoryHistory({ initialEntries: [url] }) });
  const client = createTestQueryClient();
  return renderWithProviders(<RouterProvider router={router} />, client);
}

describe('architecture maps routes', () => {
  test('lists indexed maps', async () => {
    stubFetch({
      '/api/architecture-maps': { body: [SUMMARY] },
      '/api/index/status': { body: INDEX_STATUS },
    });

    const screen = await renderAt('/maps');
    await expect.element(screen.getByTestId('architecture-maps-page')).toBeVisible();
    await expect.element(screen.getByTestId('architecture-map-card')).toHaveTextContent('Overview');
  });

  test('shows an empty state when no maps exist', async () => {
    stubFetch({
      '/api/architecture-maps': { body: [] },
      '/api/index/status': { body: { ...INDEX_STATUS, architectureMapCount: 0 } },
    });

    const screen = await renderAt('/maps');
    await expect.element(screen.getByText('No architecture maps yet')).toBeVisible();
  });

  test('opens a map canvas', async () => {
    stubFetch({
      '/api/architecture-maps/overview': { body: MAP },
      '/api/index/status': { body: INDEX_STATUS },
    });

    const screen = await renderAt('/maps/overview');
    await expect.element(screen.getByTestId('architecture-map-page')).toBeVisible();
    await expect.element(screen.getByTestId('architecture-canvas')).toBeVisible();
    await expect.element(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  });
});

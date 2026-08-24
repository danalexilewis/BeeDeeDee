import type { ArchitectureMap } from '@eddy/behavior-contracts';
import { describe, expect, test, vi } from 'vitest';
import { ArchitectureDetailPanel } from './architecture-detail';
import { renderWithProviders } from '@/test/harness';

const MAP: ArchitectureMap = {
  schemaVersion: '0.1',
  id: 'overview',
  path: 'specs/mappings/overview.architecture.json',
  title: 'Overview',
  description: 'Demo map',
  dividerY: 400,
  userFlows: {
    nodes: [
      {
        id: 'login',
        label: 'Login',
        kind: 'stage',
        position: { x: 0, y: 0 },
        description: 'Sign in',
        featureId: 'authentication.login',
        dataCollected: [
          { id: 'email', name: 'Email', required: true, description: 'Account email' },
          { id: 'password', name: 'Password', required: false, description: '' },
        ],
        requiredToProceed: ['email', 'password'],
        zoomRevealAt: 0,
        collapsedByDefault: false,
      },
      {
        id: 'empty-stage',
        label: 'Empty',
        kind: 'stage',
        position: { x: 100, y: 0 },
        description: '',
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
        id: 'user.email',
        label: 'email',
        kind: 'field',
        position: { x: 0, y: 500 },
        description: 'Canonical email',
        dataType: 'email',
      },
      {
        id: 'orphan',
        label: 'orphan',
        kind: 'field',
        position: { x: 100, y: 500 },
        description: '',
        dataType: '',
      },
    ],
    edges: [],
  },
  lineage: [
    {
      id: 'lin-1',
      source: 'login',
      target: 'user.email',
      dataId: 'email',
      label: 'email',
      description: 'Lands on User.email',
    },
  ],
};

describe('ArchitectureDetailPanel', () => {
  test('shows map copy when nothing is selected', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel map={MAP} selected={undefined} />
    );
    await expect.element(screen.getByTestId('architecture-detail')).toBeVisible();
    await expect.element(screen.getByText('Overview')).toBeVisible();
  });

  test('prompts selection when the map has no description', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel map={{ ...MAP, description: '' }} selected={undefined} />
    );
    await expect
      .element(
        screen.getByText('Select a stage or domain field to inspect collected data and lineage.')
      )
      .toBeVisible();
  });

  test('lists collected data and required gates for a flow node', async () => {
    const onOpenFeature = vi.fn();
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel
        map={MAP}
        selected={{ kind: 'flow', node: MAP.userFlows.nodes[0]! }}
        onOpenFeature={onOpenFeature}
      />
    );

    await expect.element(screen.getByTestId('data-collected')).toBeVisible();
    await expect
      .element(screen.getByTestId('data-collected').getByText('Email', { exact: true }))
      .toBeVisible();
    await expect.element(screen.getByTestId('required-to-proceed')).toBeVisible();

    await screen.getByTestId('architecture-drill-in').click();
    expect(onOpenFeature).toHaveBeenCalledWith('authentication.login', undefined);
  });

  test('shows empty-state copy for a stage with no data', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel
        map={MAP}
        selected={{ kind: 'flow', node: MAP.userFlows.nodes[1]! }}
      />
    );

    await expect.element(screen.getByText('Nothing captured at this stage.')).toBeVisible();
    await expect.element(screen.getByText('No gate beyond reaching this stage.')).toBeVisible();
    await expect.element(screen.getByText('No lineage from this stage.')).toBeVisible();
  });

  test('shows domain field lineage inbound', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel
        map={MAP}
        selected={{ kind: 'domain', node: MAP.domainModel.nodes[0]! }}
      />
    );

    await expect.element(screen.getByText('Fed by stages')).toBeVisible();
    await expect.element(screen.getByText('Login')).toBeVisible();
    await expect.element(screen.getByText('email')).toBeVisible();
  });

  test('reports when a domain node has no inbound lineage', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel
        map={MAP}
        selected={{ kind: 'domain', node: MAP.domainModel.nodes[1]! }}
      />
    );

    await expect.element(screen.getByText('No lineage edges target this node.')).toBeVisible();
  });

  test('shows lineage edge details', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel map={MAP} selected={{ kind: 'lineage', edge: MAP.lineage[0]! }} />
    );

    await expect.element(screen.getByText('Lineage')).toBeVisible();
    await expect.element(screen.getByText('Lands on User.email')).toBeVisible();
    await expect.element(screen.getByText('Login')).toBeVisible();
    await expect.element(screen.getByText('Email (required to proceed)')).toBeVisible();
  });

  test('falls back to ids when lineage endpoints are missing', async () => {
    const orphanEdge = {
      id: 'lin-orphan',
      source: 'missing-stage',
      target: 'missing-field',
      label: '',
      description: '',
    };
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel map={MAP} selected={{ kind: 'lineage', edge: orphanEdge }} />
    );

    await expect.element(screen.getByText('lin-orphan')).toBeVisible();
    await expect.element(screen.getByText('missing-stage')).toBeVisible();
    await expect.element(screen.getByText('missing-field')).toBeVisible();
  });

  test('lists outbound lineage for a flow stage', async () => {
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel
        map={MAP}
        selected={{ kind: 'flow', node: MAP.userFlows.nodes[0]! }}
      />
    );

    await expect.element(screen.getByText('Flows into domain')).toBeVisible();
    await expect.element(screen.getByText('email')).toBeVisible();
  });

  test('resolves required-to-proceed ids that are not collected', async () => {
    const node = {
      ...MAP.userFlows.nodes[0]!,
      requiredToProceed: ['email', 'unknown-gate'],
    };
    const screen = await renderWithProviders(
      <ArchitectureDetailPanel map={MAP} selected={{ kind: 'flow', node }} />
    );

    await expect.element(screen.getByTestId('required-to-proceed')).toHaveTextContent('Email');
    await expect
      .element(screen.getByTestId('required-to-proceed'))
      .toHaveTextContent('unknown-gate');
  });
});

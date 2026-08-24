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
          { id: 'password', name: 'Password', required: true, description: '' },
        ],
        requiredToProceed: ['email', 'password'],
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
});

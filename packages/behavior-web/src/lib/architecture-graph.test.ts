import type { ArchitectureMap } from '@eddy/behavior-contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  ancestorsExpanded,
  buildArchitectureGraph,
  initialCollapsed,
  visibleFlowNodeIds,
} from './architecture-graph';

function flowNode(
  overrides: Partial<ArchitectureMap['userFlows']['nodes'][number]> & {
    id: string;
    label: string;
    kind: 'hub' | 'stage' | 'leaf';
  }
): ArchitectureMap['userFlows']['nodes'][number] {
  return {
    position: { x: 0, y: 0 },
    description: '',
    dataCollected: [],
    requiredToProceed: [],
    zoomRevealAt: 0,
    collapsedByDefault: false,
    ...overrides,
  };
}

const MAP: ArchitectureMap = {
  schemaVersion: '0.1',
  id: 'demo',
  path: 'specs/mappings/demo.architecture.json',
  title: 'Demo',
  description: '',
  dividerY: 400,
  userFlows: {
    nodes: [
      flowNode({ id: 'hub', label: 'Auth', kind: 'hub', collapsedByDefault: true }),
      flowNode({ id: 'login', label: 'Login', kind: 'stage', parentId: 'hub' }),
      flowNode({
        id: 'reset',
        label: 'Reset',
        kind: 'leaf',
        parentId: 'hub',
        zoomRevealAt: 1.2,
      }),
      flowNode({ id: 'billing', label: 'Billing', kind: 'stage' }),
    ],
    edges: [
      { id: 'e1', source: 'hub', target: 'login', label: '' },
      { id: 'e2', source: 'hub', target: 'reset', label: 'recovery' },
      { id: 'e3', source: 'login', target: 'billing', label: 'next' },
    ],
  },
  domainModel: {
    nodes: [
      {
        id: 'user',
        label: 'User',
        kind: 'entity',
        position: { x: 0, y: 500 },
        description: '',
        dataType: '',
      },
      {
        id: 'user.email',
        label: 'email',
        kind: 'field',
        parentId: 'user',
        position: { x: 0, y: 600 },
        description: '',
        dataType: 'email',
      },
    ],
    edges: [{ id: 'd1', source: 'user', target: 'user.email', label: '' }],
  },
  lineage: [
    {
      id: 'l1',
      source: 'login',
      target: 'user.email',
      dataId: 'email',
      label: 'email',
      description: '',
    },
    {
      id: 'l2',
      source: 'reset',
      target: 'user.email',
      label: '',
      description: '',
    },
  ],
};

describe('initialCollapsed', () => {
  it('collects hubs marked collapsedByDefault', () => {
    expect([...initialCollapsed(MAP)]).toEqual(['hub']);
  });
});

describe('ancestorsExpanded', () => {
  it('is true with no parent', () => {
    const byId = new Map(MAP.userFlows.nodes.map(node => [node.id, node]));
    expect(ancestorsExpanded('billing', byId, new Set())).toBe(true);
  });

  it('is false when a parent hub is collapsed', () => {
    const byId = new Map(MAP.userFlows.nodes.map(node => [node.id, node]));
    expect(ancestorsExpanded('login', byId, new Set(['hub']))).toBe(false);
  });
});

describe('visibleFlowNodeIds', () => {
  it('hides children of collapsed hubs', () => {
    const visible = visibleFlowNodeIds(MAP, new Set(['hub']), 1);
    expect(visible.has('hub')).toBe(true);
    expect(visible.has('login')).toBe(false);
    expect(visible.has('billing')).toBe(true);
  });

  it('hides leaf nodes until zoom reaches zoomRevealAt', () => {
    const visible = visibleFlowNodeIds(MAP, new Set(), 1);
    expect(visible.has('login')).toBe(true);
    expect(visible.has('reset')).toBe(false);
  });

  it('reveals leaf nodes once zoom is high enough', () => {
    const visible = visibleFlowNodeIds(MAP, new Set(), 1.2);
    expect(visible.has('reset')).toBe(true);
  });
});

describe('buildArchitectureGraph', () => {
  it('includes domain nodes and labelled edges when flow sources are visible', () => {
    const toggle = vi.fn();
    const graph = buildArchitectureGraph(MAP, new Set(), 1.2, toggle);

    expect(graph.nodes.some(node => node.id === 'user.email')).toBe(true);
    expect(graph.nodes.some(node => node.id === 'reset')).toBe(true);

    const recovery = graph.edges.find(edge => edge.id === 'e2');
    expect(recovery?.label).toBe('recovery');

    const blankDomain = graph.edges.find(edge => edge.id === 'd1');
    expect(blankDomain?.label).toBeUndefined();

    const lineage = graph.edges.find(edge => edge.id === 'l1');
    expect(lineage?.data).toEqual({ kind: 'lineage' });
  });

  it('drops flow and lineage edges whose source is hidden', () => {
    const graph = buildArchitectureGraph(MAP, new Set(['hub']), 1.2, vi.fn());

    expect(graph.edges.some(edge => edge.id === 'e1')).toBe(false);
    expect(graph.edges.some(edge => edge.id === 'l1')).toBe(false);
    expect(graph.edges.some(edge => edge.id === 'e3')).toBe(false);
    expect(graph.nodes.some(node => node.id === 'billing')).toBe(true);
  });

  it('marks hubs as collapsed in node data', () => {
    const graph = buildArchitectureGraph(MAP, new Set(['hub']), 1, vi.fn());
    const hub = graph.nodes.find(node => node.id === 'hub');
    expect(hub?.data.plane).toBe('flow');
    if (hub?.data.plane === 'flow') {
      expect(hub.data.collapsed).toBe(true);
    }
  });
});

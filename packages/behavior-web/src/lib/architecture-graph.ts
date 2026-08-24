import type { ArchitectureFlowNode, ArchitectureMap } from '@eddy/behavior-contracts';
import type { Edge, Node } from '@xyflow/react';
import type { ArchitectureCanvasNodeData, FlowNodeData } from '@/components/architecture-nodes';

export type ArchitectureCanvasNode = Node<ArchitectureCanvasNodeData, 'flowStage' | 'domainModel'>;

/** True when every ancestor hub of `nodeId` is expanded. */
export function ancestorsExpanded(
  nodeId: string,
  byId: Map<string, ArchitectureFlowNode>,
  collapsed: ReadonlySet<string>
): boolean {
  let current = byId.get(nodeId)?.parentId;
  while (current !== undefined) {
    if (collapsed.has(current)) return false;
    current = byId.get(current)?.parentId;
  }
  return true;
}

/** Flow node ids visible at the current collapse + zoom state. */
export function visibleFlowNodeIds(
  map: ArchitectureMap,
  collapsed: ReadonlySet<string>,
  zoom: number
): Set<string> {
  const flowById = new Map(
    map.userFlows.nodes.map(function toEntry(node) {
      return [node.id, node] as const;
    })
  );

  const visible = new Set<string>();

  for (const node of map.userFlows.nodes) {
    if (!ancestorsExpanded(node.id, flowById, collapsed)) continue;
    if (node.kind === 'leaf' && zoom < node.zoomRevealAt) continue;
    visible.add(node.id);
  }

  return visible;
}

/** Initial collapsed hubs from `collapsedByDefault`. */
export function initialCollapsed(map: ArchitectureMap): Set<string> {
  return new Set(
    map.userFlows.nodes
      .filter(function isCollapsedHub(node) {
        return node.kind === 'hub' && node.collapsedByDefault;
      })
      .map(function toId(node) {
        return node.id;
      })
  );
}

/**
 * Builds React Flow nodes/edges honouring collapse and zoom-reveal.
 *
 * Kept pure so visibility rules can be unit-tested without mounting React Flow.
 */
export function buildArchitectureGraph(
  map: ArchitectureMap,
  collapsed: ReadonlySet<string>,
  zoom: number,
  onToggleCollapse: (nodeId: string) => void
): { nodes: ArchitectureCanvasNode[]; edges: Edge[] } {
  const visibleFlowIds = visibleFlowNodeIds(map, collapsed, zoom);

  const flowNodes: ArchitectureCanvasNode[] = map.userFlows.nodes
    .filter(function isVisible(node) {
      return visibleFlowIds.has(node.id);
    })
    .map(function toNode(node) {
      const data: FlowNodeData = {
        plane: 'flow',
        node,
        collapsed: collapsed.has(node.id),
        selected: false,
        onToggleCollapse,
      };
      return {
        id: node.id,
        type: 'flowStage' as const,
        position: node.position,
        data,
        zIndex: 2,
      };
    });

  const domainNodes: ArchitectureCanvasNode[] = map.domainModel.nodes.map(function toNode(node) {
    return {
      id: node.id,
      type: 'domainModel' as const,
      position: node.position,
      data: { plane: 'domain' as const, node, selected: false },
      zIndex: 2,
    };
  });

  const flowEdges: Edge[] = map.userFlows.edges
    .filter(function bothVisible(edge) {
      return visibleFlowIds.has(edge.source) && visibleFlowIds.has(edge.target);
    })
    .map(function toEdge(edge) {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label.length > 0 ? edge.label : undefined,
        type: 'smoothstep',
        style: { stroke: 'var(--primary)' },
      };
    });

  const domainEdges: Edge[] = map.domainModel.edges.map(function toEdge(edge) {
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label.length > 0 ? edge.label : undefined,
      type: 'smoothstep',
      style: { stroke: 'var(--passing)' },
    };
  });

  const lineageEdges: Edge[] = map.lineage
    .filter(function sourceVisible(edge) {
      return visibleFlowIds.has(edge.source);
    })
    .map(function toEdge(edge) {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label.length > 0 ? edge.label : undefined,
        type: 'straight',
        animated: true,
        style: { stroke: 'var(--untested)', strokeDasharray: '6 4' },
        data: { kind: 'lineage' },
      };
    });

  return {
    nodes: [...flowNodes, ...domainNodes],
    edges: [...flowEdges, ...domainEdges, ...lineageEdges],
  };
}

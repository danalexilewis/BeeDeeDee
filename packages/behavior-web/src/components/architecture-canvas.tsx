import type { ArchitectureMap } from '@eddy/behavior-contracts';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  ArchitectureDetailPanel,
  type SelectedArchitectureTarget,
} from '@/components/architecture-detail';
import {
  architectureNodeTypes,
  type ArchitectureCanvasNodeData,
  type FlowNodeData,
} from '@/components/architecture-nodes';
import { cn } from '@/lib/cn';
import '@xyflow/react/dist/style.css';

export type ArchitectureCanvasProps = {
  map: ArchitectureMap;
  className?: string;
};

type CanvasNode = Node<ArchitectureCanvasNodeData, 'flowStage' | 'domainModel'>;

/** True when every ancestor hub of `nodeId` is expanded. */
function ancestorsExpanded(
  nodeId: string,
  byId: Map<string, ArchitectureMap['userFlows']['nodes'][number]>,
  collapsed: ReadonlySet<string>
): boolean {
  let current = byId.get(nodeId)?.parentId;
  while (current !== undefined) {
    if (collapsed.has(current)) return false;
    current = byId.get(current)?.parentId;
  }
  return true;
}

/** Builds React Flow nodes/edges honouring collapse and zoom-reveal. */
function buildGraph(
  map: ArchitectureMap,
  collapsed: ReadonlySet<string>,
  zoom: number,
  onToggleCollapse: (nodeId: string) => void
): { nodes: CanvasNode[]; edges: Edge[] } {
  const flowById = new Map(
    map.userFlows.nodes.map(function toEntry(node) {
      return [node.id, node] as const;
    })
  );

  const visibleFlowIds = new Set<string>();

  for (const node of map.userFlows.nodes) {
    if (!ancestorsExpanded(node.id, flowById, collapsed)) continue;
    if (node.kind === 'leaf' && zoom < node.zoomRevealAt) continue;
    visibleFlowIds.add(node.id);
  }

  const flowNodes: CanvasNode[] = map.userFlows.nodes
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
        type: 'flowStage',
        position: node.position,
        data,
        zIndex: 2,
      };
    });

  const domainNodes: CanvasNode[] = map.domainModel.nodes.map(function toNode(node) {
    return {
      id: node.id,
      type: 'domainModel',
      position: node.position,
      data: { plane: 'domain', node, selected: false },
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

/** Initial collapsed hubs from `collapsedByDefault`. */
function initialCollapsed(map: ArchitectureMap): Set<string> {
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

function ArchitectureCanvasInner({ map, className }: ArchitectureCanvasProps) {
  const { getZoom } = useReactFlow();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => initialCollapsed(map));
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<SelectedArchitectureTarget | undefined>(undefined);

  function onToggleCollapse(nodeId: string): void {
    setCollapsed(function update(previous) {
      const next = new Set(previous);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(
    function rebuild() {
      const graph = buildGraph(map, collapsed, zoom, onToggleCollapse);
      setNodes(graph.nodes);
      setEdges(graph.edges);
    },
    [map, collapsed, zoom, setNodes, setEdges]
  );

  useEffect(
    function resetSelection() {
      setSelected(undefined);
      setCollapsed(initialCollapsed(map));
    },
    [map.id]
  );

  function onSelectionChange({
    nodes: selectedNodes,
    edges: selectedEdges,
  }: OnSelectionChangeParams): void {
    const lineageEdge = selectedEdges.find(function isLineage(edge) {
      return edge.data?.['kind'] === 'lineage';
    });
    if (lineageEdge !== undefined) {
      const authored = map.lineage.find(function find(edge) {
        return edge.id === lineageEdge.id;
      });
      if (authored !== undefined) {
        setSelected({ kind: 'lineage', edge: authored });
        return;
      }
    }

    const first = selectedNodes[0] as CanvasNode | undefined;
    if (first === undefined) {
      setSelected(undefined);
      return;
    }

    if (first.data.plane === 'flow') {
      setSelected({ kind: 'flow', node: first.data.node });
      return;
    }

    setSelected({ kind: 'domain', node: first.data.node });
  }

  return (
    <div data-testid="architecture-canvas" className={cn('flex h-full min-h-0', className)}>
      <div className="relative min-h-0 min-w-0 flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-0 bg-gradient-to-b from-primary/5 to-transparent"
          style={{ height: map.dividerY }}
        />
        <div
          aria-hidden
          data-testid="plane-divider"
          className="pointer-events-none absolute inset-x-0 z-[1] flex items-center gap-3 px-4"
          style={{ top: map.dividerY }}
        >
          <div className="border-border flex-1 border-t border-dashed" />
          <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
            User flows ↑ · Domain model ↓
          </span>
          <div className="border-border flex-1 border-t border-dashed" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-0 bg-gradient-to-t from-passing/10 to-transparent"
          style={{ top: map.dividerY }}
        />

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={architectureNodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onMove={function onMove(_event, viewport) {
            setZoom(viewport.zoom);
          }}
          onInit={function onInit() {
            setZoom(getZoom());
          }}
          fitView
          minZoom={0.4}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          className="bg-transparent"
        >
          <Background gap={20} size={1} color="var(--border)" />
          <Controls showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            className="!bg-card !border-border"
            nodeColor={function color(node) {
              return node.type === 'domainModel' ? 'var(--passing)' : 'var(--primary)';
            }}
          />
        </ReactFlow>
      </div>
      <ArchitectureDetailPanel
        map={map}
        selected={selected}
        className="w-80 shrink-0"
        onOpenFeature={function openFeature(featureId, scenarioId) {
          void navigate({
            to: '/features/$featureId',
            params: { featureId },
            search: scenarioId === undefined ? {} : { scenario: scenarioId },
          });
        }}
      />
    </div>
  );
}

/** Architecture map canvas with React Flow provider boundary. */
export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <ArchitectureCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

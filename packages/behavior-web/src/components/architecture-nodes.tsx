import type {
  ArchitectureDomainNode,
  ArchitectureFlowNode,
} from '@eddy/behavior-contracts';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight, Database, GitBranch } from 'lucide-react';
import { cn } from '@/lib/cn';

export type FlowNodeData = {
  plane: 'flow';
  node: ArchitectureFlowNode;
  collapsed: boolean;
  selected: boolean;
  onToggleCollapse?: (nodeId: string) => void;
};

export type DomainNodeData = {
  plane: 'domain';
  node: ArchitectureDomainNode;
  selected: boolean;
};

export type ArchitectureCanvasNodeData = FlowNodeData | DomainNodeData;

export type FlowCanvasNode = Node<FlowNodeData, 'flowStage'>;
export type DomainCanvasNode = Node<DomainNodeData, 'domainModel'>;
export type ArchitectureCanvasNode = FlowCanvasNode | DomainCanvasNode;

/** User-flow node: hub / stage / leaf with collapse control on hubs. */
export function FlowStageNode({ data }: NodeProps<FlowCanvasNode>) {
  const { node, collapsed, onToggleCollapse } = data;
  const requiredCount = node.requiredToProceed.length;
  const collectedCount = node.dataCollected.length;
  const selected = data.selected;

  return (
    <div
      data-testid={`flow-node-${node.id}`}
      data-kind={node.kind}
      className={cn(
        'border-border bg-card min-w-44 max-w-56 rounded-lg border px-3 py-2 shadow-sm',
        node.kind === 'hub' && 'border-primary/40 bg-primary/5',
        node.kind === 'leaf' && 'border-dashed',
        selected && 'ring-ring ring-2'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !size-2" />
      <div className="flex items-start gap-2">
        {node.kind === 'hub' ? (
          <button
            type="button"
            aria-label={collapsed ? 'Expand hub' : 'Collapse hub'}
            data-testid={`collapse-${node.id}`}
            className="text-muted-foreground hover:text-foreground mt-0.5"
            onClick={function onClick(event) {
              event.stopPropagation();
              onToggleCollapse?.(node.id);
            }}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" aria-hidden />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <GitBranch className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{node.label}</p>
          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">{node.kind}</p>
          {collectedCount === 0 && requiredCount === 0 ? null : (
            <p className="text-muted-foreground mt-1 text-xs">
              {collectedCount} data · {requiredCount} required
            </p>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-primary !size-2" />
    </div>
  );
}

/** Domain-model node: entity or field below the divider. */
export function DomainModelNode({ data }: NodeProps<DomainCanvasNode>) {
  const { node, selected } = data;
  const isField = node.kind === 'field';

  return (
    <div
      data-testid={`domain-node-${node.id}`}
      data-kind={node.kind}
      className={cn(
        'border-border bg-card min-w-36 max-w-48 rounded-lg border px-3 py-2 shadow-sm',
        isField && 'bg-muted/40',
        selected && 'ring-ring ring-2'
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-passing !size-2" />
      <div className="flex items-start gap-2">
        <Database className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm', isField ? 'font-mono text-xs' : 'font-medium')}>
            {node.label}
          </p>
          <p className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {node.kind}
            {node.dataType.length > 0 ? ` · ${node.dataType}` : ''}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-passing !size-2" />
    </div>
  );
}

export const architectureNodeTypes = {
  flowStage: FlowStageNode,
  domainModel: DomainModelNode,
};

import type {
  ArchitectureDataItem,
  ArchitectureDomainNode,
  ArchitectureFlowNode,
  ArchitectureLineageEdge,
  ArchitectureMap,
} from '@eddy/behavior-contracts';
import { cn } from '@/lib/cn';

export type SelectedArchitectureTarget =
  | { kind: 'flow'; node: ArchitectureFlowNode }
  | { kind: 'domain'; node: ArchitectureDomainNode }
  | { kind: 'lineage'; edge: ArchitectureLineageEdge };

export type ArchitectureDetailPanelProps = {
  map: ArchitectureMap;
  selected: SelectedArchitectureTarget | undefined;
  /** Opens the linked feature/scenario from a flow stage. */
  onOpenFeature?: (featureId: string, scenarioId: string | undefined) => void;
  className?: string;
};

/** Resolves a collected datum on a flow node by id. */
function findDataItem(
  node: ArchitectureFlowNode,
  dataId: string | undefined
): ArchitectureDataItem | undefined {
  if (dataId === undefined) return undefined;
  return node.dataCollected.find(function matches(item) {
    return item.id === dataId;
  });
}

/** Side panel: collected data, required gates, and drill-in to features. */
export function ArchitectureDetailPanel({
  map,
  selected,
  onOpenFeature,
  className,
}: ArchitectureDetailPanelProps) {
  if (selected === undefined) {
    return (
      <aside
        data-testid="architecture-detail"
        className={cn('space-y-3 border-l-2 border-[var(--ink)] bg-[var(--paper)] p-4', className)}
      >
        <h2 className="text-sm font-semibold">{map.title}</h2>
        {map.description.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Select a stage or domain field to inspect collected data and lineage.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">{map.description}</p>
        )}
        <p className="text-muted-foreground text-xs">
          Above the line: user flows. Below: normalised domain model. Dashed cross-plane edges are
          data lineage.
        </p>
      </aside>
    );
  }

  if (selected.kind === 'lineage') {
    const edge = selected.edge;
    const source = map.userFlows.nodes.find(function find(node) {
      return node.id === edge.source;
    });
    const target = map.domainModel.nodes.find(function find(node) {
      return node.id === edge.target;
    });
    const datum = source === undefined ? undefined : findDataItem(source, edge.dataId);

    return (
      <aside
        data-testid="architecture-detail"
        className={cn(
          'space-y-4 overflow-auto border-l-2 border-[var(--ink)] bg-[var(--paper)] p-4',
          className
        )}
      >
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold uppercase">Lineage</p>
          <h2 className="text-sm font-semibold">{edge.label.length > 0 ? edge.label : edge.id}</h2>
        </div>
        {edge.description.length > 0 ? (
          <p className="text-muted-foreground text-sm">{edge.description}</p>
        ) : null}
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs uppercase">From stage</dt>
            <dd>{source?.label ?? edge.source}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs uppercase">Into field</dt>
            <dd className="font-mono text-xs">{target?.label ?? edge.target}</dd>
          </div>
          {datum === undefined ? null : (
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Datum</dt>
              <dd>
                {datum.name}
                {datum.required ? ' (required to proceed)' : ''}
              </dd>
            </div>
          )}
        </dl>
      </aside>
    );
  }

  if (selected.kind === 'domain') {
    const node = selected.node;
    const inbound = map.lineage.filter(function toNode(edge) {
      return edge.target === node.id;
    });

    return (
      <aside
        data-testid="architecture-detail"
        className={cn(
          'space-y-4 overflow-auto border-l-2 border-[var(--ink)] bg-[var(--paper)] p-4',
          className
        )}
      >
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold uppercase">
            Domain {node.kind}
          </p>
          <h2 className="text-sm font-semibold">{node.label}</h2>
          {node.dataType.length > 0 ? (
            <p className="text-muted-foreground font-mono text-xs">{node.dataType}</p>
          ) : null}
        </div>
        {node.description.length > 0 ? (
          <p className="text-muted-foreground text-sm">{node.description}</p>
        ) : null}
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            Fed by stages
          </h3>
          {inbound.length === 0 ? (
            <p className="text-muted-foreground text-sm">No lineage edges target this node.</p>
          ) : (
            <ul className="space-y-2">
              {inbound.map(function toEdge(edge) {
                const source = map.userFlows.nodes.find(function find(candidate) {
                  return candidate.id === edge.source;
                });
                return (
                  <li
                    key={edge.id}
                    className="rounded-[var(--radius)] border-2 border-[var(--ink)] p-2 text-sm"
                  >
                    <p className="font-medium">{source?.label ?? edge.source}</p>
                    <p className="text-muted-foreground text-xs">
                      {edge.label.length > 0 ? edge.label : (edge.dataId ?? edge.id)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    );
  }

  const node = selected.node;
  const required = new Set(node.requiredToProceed);
  const outboundLineage = map.lineage.filter(function fromNode(edge) {
    return edge.source === node.id;
  });

  return (
    <aside
      data-testid="architecture-detail"
      className={cn(
        'space-y-4 overflow-auto border-l-2 border-[var(--ink)] bg-[var(--paper)] p-4',
        className
      )}
    >
      <div>
        <p className="text-muted-foreground text-[10px] font-semibold uppercase">
          Flow {node.kind}
        </p>
        <h2 className="text-sm font-semibold">{node.label}</h2>
      </div>
      {node.description.length > 0 ? (
        <p className="text-muted-foreground text-sm">{node.description}</p>
      ) : null}

      {node.featureId === undefined ? null : (
        <button
          type="button"
          data-testid="architecture-drill-in"
          className="inline-flex rounded-[var(--radius)] border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--paper)] shadow-[2px_2px_0_var(--accent)]"
          onClick={function onClick() {
            onOpenFeature?.(node.featureId!, node.scenarioId);
          }}
        >
          Open feature
        </button>
      )}

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
          Data collected
        </h3>
        {node.dataCollected.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing captured at this stage.</p>
        ) : (
          <ul className="space-y-2" data-testid="data-collected">
            {node.dataCollected.map(function toItem(item) {
              return (
                <li
                  key={item.id}
                  className="rounded-[var(--radius)] border-2 border-[var(--ink)] p-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{item.name}</span>
                    {item.required || required.has(item.id) ? (
                      <span className="text-failing text-[10px] font-semibold uppercase">
                        Required
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-[10px] uppercase">Optional</span>
                    )}
                  </div>
                  {item.description.length > 0 ? (
                    <p className="text-muted-foreground mt-1 text-xs">{item.description}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
          Required to proceed
        </h3>
        {node.requiredToProceed.length === 0 ? (
          <p className="text-muted-foreground text-sm">No gate beyond reaching this stage.</p>
        ) : (
          <ul className="list-inside list-disc text-sm" data-testid="required-to-proceed">
            {node.requiredToProceed.map(function toId(id) {
              const item = findDataItem(node, id);
              return <li key={id}>{item?.name ?? id}</li>;
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
          Flows into domain
        </h3>
        {outboundLineage.length === 0 ? (
          <p className="text-muted-foreground text-sm">No lineage from this stage.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {outboundLineage.map(function toEdge(edge) {
              const target = map.domainModel.nodes.find(function find(candidate) {
                return candidate.id === edge.target;
              });
              return (
                <li key={edge.id}>
                  <span className="font-mono text-xs">{target?.label ?? edge.target}</span>
                  {edge.label.length === 0 ? null : (
                    <span className="text-muted-foreground"> · {edge.label}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </aside>
  );
}

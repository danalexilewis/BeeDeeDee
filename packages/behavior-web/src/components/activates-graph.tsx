import type { ActivatesLink } from '@eddy/behavior-contracts';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { cn } from '@/lib/cn';

export type ActivatesGraphProps = {
  links: readonly ActivatesLink[];
  mermaid: string;
  onSelectScenario?: (scenarioId: string) => void;
  className?: string;
};

/** Lists Activates unlock edges and optionally renders a Mermaid flowchart. */
export function ActivatesGraph({
  links,
  mermaid,
  onSelectScenario,
  className,
}: ActivatesGraphProps) {
  if (links.length === 0) return null;

  const resolved = links.filter(function isResolved(link) {
    return link.resolved;
  }).length;

  return (
    <div className={cn('space-y-3', className)} data-testid="activates-graph">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-muted-foreground text-xs font-semibold uppercase">Activates</h3>
        <span className="text-muted-foreground text-xs">
          {resolved}/{links.length} resolved
        </span>
      </div>

      <ul className="space-y-1.5">
        {links.map(function toEdge(link, index) {
          return (
            <li key={`${link.fromScenarioId}-${link.line}-${index}`} className="text-sm">
              <button
                type="button"
                className="text-left hover:underline"
                onClick={function onClick() {
                  onSelectScenario?.(link.fromScenarioId);
                }}
              >
                {link.fromScenarioName}
              </button>
              <span className="text-muted-foreground"> → </span>
              {link.resolved && link.toScenarioId !== undefined ? (
                <button
                  type="button"
                  className="text-sky-700 hover:underline dark:text-sky-400"
                  onClick={function onClick() {
                    onSelectScenario?.(link.toScenarioId!);
                  }}
                >
                  {link.toScenarioName ?? link.text}
                </button>
              ) : (
                <span className="text-failing" title="No matching scenario title">
                  {link.text}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {resolved === 0 ? null : (
        <MermaidDiagram source={mermaid} id={`activates-${links[0]?.fromScenarioId ?? 'graph'}`} />
      )}
    </div>
  );
}

/** Compact outgoing Activates for a single scenario panel. */
export function ScenarioActivates({
  links,
  onSelectScenario,
  className,
}: {
  links: readonly ActivatesLink[];
  onSelectScenario?: (scenarioId: string) => void;
  className?: string;
}) {
  if (links.length === 0) return null;

  return (
    <section className={className} data-testid="scenario-activates">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Unlocks</h3>
      <ul className="space-y-1">
        {links.map(function toLink(link, index) {
          return (
            <li key={`${link.line}-${index}`} className="text-sm">
              {link.resolved && link.toScenarioId !== undefined ? (
                <button
                  type="button"
                  className="text-sky-700 hover:underline dark:text-sky-400"
                  onClick={function onClick() {
                    onSelectScenario?.(link.toScenarioId!);
                  }}
                >
                  {link.toScenarioName ?? link.text}
                </button>
              ) : (
                <span className="text-failing">{link.text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

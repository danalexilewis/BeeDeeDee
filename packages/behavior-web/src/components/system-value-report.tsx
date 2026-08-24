import type { SystemValueItem } from '@eddy/behavior-contracts';
import { cn } from '@/lib/cn';

export type SystemValueReportProps = {
  outputs: readonly SystemValueItem[];
  outcomes: readonly SystemValueItem[];
  className?: string;
};

/** Formats one value-report line with And/But valence. */
function ValueLine({ item, isFirst }: { item: SystemValueItem; isFirst: boolean }) {
  const prefix =
    isFirst && item.connector !== 'but' ? null : item.connector === 'but' ? 'But' : 'And';

  return (
    <li className="text-sm">
      {prefix === null ? null : <span className="text-primary font-medium">{prefix} </span>}
      <span className={item.connector === 'but' ? 'text-failing' : undefined}>{item.text}</span>
    </li>
  );
}

/** Derived System Outputs / Outcomes for a Gurki system. */
export function SystemValueReport({ outputs, outcomes, className }: SystemValueReportProps) {
  if (outputs.length === 0 && outcomes.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)} data-testid="system-value-report">
      {outputs.length === 0 ? null : (
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            System Outputs
          </h3>
          <ul className="space-y-1">
            {outputs.map(function toOutput(item, index) {
              return <ValueLine key={`out-${index}`} item={item} isFirst={index === 0} />;
            })}
          </ul>
        </section>
      )}
      {outcomes.length === 0 ? null : (
        <section>
          <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
            System Outcomes
          </h3>
          <ul className="space-y-1">
            {outcomes.map(function toOutcome(item, index) {
              return <ValueLine key={`oc-${index}`} item={item} isFirst={index === 0} />;
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

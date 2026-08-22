import type { GherkinStep } from '@eddy/behavior-contracts';
import { cn } from '@/lib/cn';

export type GherkinStepsProps = {
  steps: readonly GherkinStep[];
  className?: string;
};

/** Renders a step's doc string or data table argument. */
function StepArgument({ step }: { step: GherkinStep }) {
  if (step.argument === undefined) return null;

  if (step.argument.type === 'doc_string') {
    return (
      <pre className="bg-muted text-muted-foreground mt-1 ml-6 overflow-auto rounded p-2 text-xs">
        {step.argument.content}
      </pre>
    );
  }

  const table = step.argument.content;

  return (
    <table className="mt-1 ml-6 text-xs">
      <thead>
        <tr>
          {table.headers.map(function toHeader(header, index) {
            return (
              <th
                key={`${header}-${index}`}
                scope="col"
                className="border-border border px-2 py-1 text-left"
              >
                {header}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {table.rows.map(function toRow(row, rowIndex) {
          return (
            <tr key={rowIndex}>
              {row.map(function toCell(cell, cellIndex) {
                return (
                  <td
                    key={cellIndex}
                    className="border-border text-muted-foreground border px-2 py-1"
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The Gherkin steps of a scenario, with keywords emphasised. */
export function GherkinSteps({ steps, className }: GherkinStepsProps) {
  if (steps.length === 0) {
    return <p className="text-muted-foreground text-sm">This scenario has no steps.</p>;
  }

  return (
    <ol className={cn('space-y-1', className)} data-testid="gherkin-steps">
      {steps.map(function toStep(step) {
        return (
          <li key={step.id} className="text-sm">
            <span className="text-primary font-medium">{step.keyword.trim()}</span>{' '}
            <span>{step.text}</span>
            <span className="text-muted-foreground ml-2 text-xs tabular-nums">:{step.line}</span>
            <StepArgument step={step} />
          </li>
        );
      })}
    </ol>
  );
}

import { useQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { indexStatusQuery, lintQuery } from '@/api/queries';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { cn } from '@/lib/cn';
import { Route as rootRoute } from './root';

/** Colour per lint severity. */
const SEVERITY_CLASSES = {
  error: 'text-failing',
  warning: 'text-primary',
  info: 'text-muted-foreground',
} as const;

function ProblemsView() {
  const { data: status, isPending: statusPending, isError, error } = useQuery(indexStatusQuery());
  const { data: lint, isPending: lintPending } = useQuery(lintQuery());

  if (statusPending || lintPending) return <LoadingState label="Loading problems" />;
  if (isError) return <ErrorState error={error} />;

  const parseProblems = status?.problems ?? [];
  const lintFindings = lint ?? [];

  if (parseProblems.length === 0 && lintFindings.length === 0) {
    return (
      <EmptyState
        title="No problems found"
        description="Every specification parsed cleanly and passed the lint rules."
      />
    );
  }

  return (
    <div className="h-full space-y-6 overflow-auto p-4">
      {parseProblems.length === 0 ? null : (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Files that could not be parsed ({parseProblems.length})
          </h2>
          <ul className="space-y-2" data-testid="parse-problems">
            {parseProblems.map(function toProblem(problem, index) {
              return (
                <li
                  key={`${problem.path}-${index}`}
                  className="border-failing/30 bg-failing/5 rounded-md border p-3 text-sm"
                >
                  <p className="font-mono text-xs">{problem.path}</p>
                  <p className="text-failing mt-1">{problem.error.message}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {lintFindings.length === 0 ? null : (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Lint findings ({lintFindings.length})</h2>
          <ul className="space-y-1" data-testid="lint-findings">
            {lintFindings.map(function toFinding(finding, index) {
              return (
                <li
                  key={`${finding.path}-${finding.rule}-${index}`}
                  className="border-border rounded-md border p-2 text-sm"
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn('text-xs font-semibold', SEVERITY_CLASSES[finding.severity])}
                    >
                      {finding.severity}
                    </span>
                    <span className="text-muted-foreground font-mono text-xs">
                      {finding.path}
                      {finding.line === undefined ? '' : `:${finding.line}`}
                    </span>
                    <span className="text-muted-foreground text-xs">{finding.rule}</span>
                  </div>
                  <p className="mt-0.5">{finding.message}</p>
                  {finding.suggestedFix === undefined ? null : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Suggested: replace <code>{finding.suggestedFix.from}</code> with{' '}
                      <code>{finding.suggestedFix.to}</code>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: function getParent() {
    return rootRoute;
  },
  path: '/problems',
  component: ProblemsView,
});

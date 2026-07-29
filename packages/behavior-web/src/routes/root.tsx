import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, createRootRoute } from '@tanstack/react-router';
import { Activity, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { subscribeToWorkbenchEvents } from '@/api/events';
import { indexStatusQuery, queryKeys } from '@/api/queries';
import { cn } from '@/lib/cn';

/**
 * Keeps cached data fresh from server-sent events.
 *
 * Requirement 6 wants UI status to follow an ingest within a second, so rather
 * than polling, each event invalidates the queries it could have affected and
 * TanStack Query refetches only what is mounted.
 */
function useWorkbenchEvents(): { connected: boolean; problem: string | undefined } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(
    function subscribe() {
      const unsubscribe = subscribeToWorkbenchEvents(
        function onEvent(event) {
          setConnected(true);
          setProblem(undefined);

          if (event.type === 'index-updated' || event.type === 'spec-changed') {
            void queryClient.invalidateQueries();
            return;
          }

          if (event.type === 'test-status-changed') {
            void queryClient.invalidateQueries({ queryKey: queryKeys.catalog });
            void queryClient.invalidateQueries({ queryKey: queryKeys.scenario(event.scenarioId) });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.testStatus(event.scenarioId),
            });
            void queryClient.invalidateQueries({ queryKey: ['features'] });
            void queryClient.invalidateQueries({ queryKey: ['feature'] });
            return;
          }

          setProblem(event.error.message);
        },
        function onError(reason) {
          setConnected(false);
          setProblem(reason);
        }
      );

      return unsubscribe;
    },
    [queryClient]
  );

  return { connected, problem };
}

/** Index state and live-connection indicator. */
function StatusBar() {
  const { data: status } = useQuery(indexStatusQuery());
  const { connected, problem } = useWorkbenchEvents();

  return (
    <div className="text-muted-foreground flex items-center gap-4 text-xs">
      {status === undefined ? null : (
        <>
          <span data-testid="index-state">
            {status.featureCount} features, {status.scenarioCount} scenarios
          </span>
          {status.problems.length === 0 ? null : (
            <Link
              to="/problems"
              className="text-failing inline-flex items-center gap-1 hover:underline"
            >
              <AlertTriangle className="size-3" aria-hidden />
              {status.problems.length} problem{status.problems.length === 1 ? '' : 's'}
            </Link>
          )}
        </>
      )}
      <span
        data-testid="live-indicator"
        data-connected={connected}
        title={problem ?? (connected ? 'Live updates connected' : 'Connecting')}
        className={cn(
          'inline-flex items-center gap-1',
          connected ? 'text-passing' : 'text-muted-foreground'
        )}
      >
        <Activity className="size-3" aria-hidden />
        {connected ? 'Live' : 'Offline'}
      </span>
    </div>
  );
}

function RootLayout() {
  return (
    <div className="flex h-screen flex-col">
      <header className="border-border flex shrink-0 items-center justify-between border-b px-4 py-2">
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-sm font-semibold">
            Behavior Workbench
          </Link>
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ className: 'text-foreground' }}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Catalog
          </Link>
          <Link
            to="/problems"
            activeProps={{ className: 'text-foreground' }}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Problems
          </Link>
        </nav>
        <StatusBar />
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});

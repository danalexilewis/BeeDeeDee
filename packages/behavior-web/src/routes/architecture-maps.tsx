import { useQuery } from '@tanstack/react-query';
import { Link, createRoute } from '@tanstack/react-router';
import { Network } from 'lucide-react';
import { architectureMapsQuery } from '@/api/queries';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Route as rootRoute } from './root';

/** Lists indexed architecture maps. */
function ArchitectureMapsPage() {
  const { data, isPending, error } = useQuery(architectureMapsQuery());

  if (isPending) return <LoadingState label="Loading architecture maps" />;
  if (error !== null) return <ErrorState error={error} />;
  if (data.length === 0) {
    return (
      <EmptyState
        title="No architecture maps yet"
        description="Add *.architecture.json files under specs/mappings, then re-index."
      />
    );
  }

  return (
    <div className="h-full overflow-auto p-4" data-testid="architecture-maps-page">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Architecture maps</h1>
        <p className="text-muted-foreground text-sm">
          Split-plane canvases of user flow above and domain model below.
        </p>
      </div>
      <ul className="space-y-2">
        {data.map(function toCard(map) {
          return (
            <li key={map.id}>
              <Link
                to="/maps/$mapId"
                params={{ mapId: map.id }}
                data-testid="architecture-map-card"
                className="border-border bg-card hover:border-ring block rounded-lg border p-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Network className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{map.title}</p>
                    <p className="text-muted-foreground truncate text-xs">{map.path}</p>
                    {map.description.length === 0 ? null : (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                        {map.description}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-2 text-xs">
                      {map.flowNodeCount} flow · {map.domainNodeCount} domain · {map.lineageCount}{' '}
                      lineage
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maps',
  component: ArchitectureMapsPage,
});

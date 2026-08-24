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
    <div className="h-full overflow-auto" data-testid="architecture-maps-page">
      <div className="pb-title-bar">Architecture maps</div>
      <div className="p-4">
        <p className="text-muted-foreground mb-4 font-serif text-sm">
          Split-plane canvases of user flow above and domain model below.
        </p>
        <ul className="space-y-3">
          {data.map(function toCard(map) {
            return (
              <li key={map.id}>
                <Link
                  to="/maps/$mapId"
                  params={{ mapId: map.id }}
                  data-testid="architecture-map-card"
                  className="block rounded-[var(--radius)] border-2 border-[var(--ink)] bg-[var(--paper)] p-3 shadow-[2px_2px_0_var(--ink)] transition-[transform,background-color] hover:translate-x-px hover:translate-y-px hover:bg-[var(--paper-muted)] hover:shadow-none"
                >
                  <div className="flex items-start gap-3">
                    <Network className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{map.title}</p>
                      <p className="text-muted-foreground truncate font-mono text-xs">{map.path}</p>
                      {map.description.length === 0 ? null : (
                        <p className="text-muted-foreground mt-1 line-clamp-2 font-serif text-sm">
                          {map.description}
                        </p>
                      )}
                      <p className="text-muted-foreground mt-2 font-mono text-xs">
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
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maps',
  component: ArchitectureMapsPage,
});

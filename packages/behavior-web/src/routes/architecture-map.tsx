import { useQuery } from '@tanstack/react-query';
import { Link, createRoute } from '@tanstack/react-router';
import { architectureMapQuery } from '@/api/queries';
import { ArchitectureCanvas } from '@/components/architecture-canvas';
import { ErrorState, LoadingState } from '@/components/states';
import { Route as rootRoute } from './root';

/** One architecture map on the React Flow canvas. */
function ArchitectureMapPage() {
  const { mapId } = Route.useParams();
  const { data, isPending, error } = useQuery(architectureMapQuery(mapId));

  if (isPending) return <LoadingState label="Loading architecture map" />;
  if (error !== null) return <ErrorState error={error} />;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="architecture-map-page">
      <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Link to="/maps" className="hover:text-foreground hover:underline">
              Maps
            </Link>
            <span>/</span>
            <span className="truncate">{data.path}</span>
          </div>
          <h1 className="truncate text-sm font-semibold">{data.title}</h1>
        </div>
        <p className="text-muted-foreground hidden text-xs sm:block">
          Collapse hubs · zoom for leaf stages · select a node for data detail
        </p>
      </div>
      <ArchitectureCanvas map={data} className="min-h-0 flex-1" />
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/maps/$mapId',
  component: ArchitectureMapPage,
});

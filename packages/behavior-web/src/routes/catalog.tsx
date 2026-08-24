import { featureStatusSchema, type FeatureSummary } from '@eddy/behavior-contracts';
import { useQuery } from '@tanstack/react-query';
import { Link, createRoute, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useRef } from 'react';
import { z } from 'zod';
import { catalogQuery, featuresQuery } from '@/api/queries';
import { CoverageBar } from '@/components/coverage-bar';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { cn } from '@/lib/cn';
import { Route as rootRoute } from './root';

/**
 * Catalog filters live in the URL, validated by Zod.
 *
 * That makes a filtered view shareable and bookmarkable, and means the filter
 * state has exactly one source of truth rather than being mirrored in component
 * state. `tags` is comma-separated to match the API's query format.
 */
const catalogSearchSchema = z.object({
  status: featureStatusSchema.optional(),
  search: z.string().optional(),
  tags: z.string().optional(),
});

export type CatalogSearch = z.infer<typeof catalogSearchSchema>;

/** Row height used by the virtualiser, matching the card's rendered height. */
const ROW_HEIGHT = 92;

/** Above this many features, render only what is on screen. */
const VIRTUALIZE_THRESHOLD = 30;

function FeatureCard({ feature }: { feature: FeatureSummary }) {
  return (
    <Link
      to="/features/$featureId"
      params={{ featureId: feature.id }}
      data-testid="feature-card"
      className="block rounded-[var(--radius)] border-2 border-[var(--ink)] bg-[var(--paper)] p-3 shadow-[2px_2px_0_var(--ink)] transition-[transform,background-color] hover:translate-x-px hover:translate-y-px hover:bg-[var(--paper-muted)] hover:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{feature.title}</p>
          <p className="text-muted-foreground truncate text-xs">{feature.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {feature.dialect === 'gurki' ? (
            <span className="rounded-[var(--radius)] border-2 border-[var(--ink)] px-1.5 py-0.5 font-mono text-xs font-semibold">
              Gurki
            </span>
          ) : null}
          <StatusBadge status={feature.status} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <CoverageBar value={feature.testCoverage} className="max-w-56 flex-1" />
        <span className="text-muted-foreground text-xs">
          {feature.scenarioCount} scenario{feature.scenarioCount === 1 ? '' : 's'}
        </span>
        {feature.dialect === 'gurki' ? (
          <span className="text-muted-foreground text-xs">
            {feature.outputCount} out · {feature.activatesResolvedCount}/{feature.activatesCount}{' '}
            unlocks
          </span>
        ) : null}
        <div className="flex gap-1">
          {feature.tags.slice(0, 3).map(function toTag(tag) {
            return (
              <span
                key={tag}
                className="rounded-[var(--radius)] border border-[var(--ink)] bg-[var(--paper-muted)] px-1.5 py-0.5 font-mono text-xs"
              >
                {tag}
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}

/** Feature list, virtualised once it grows past the threshold. */
function FeatureList({ features }: { features: readonly FeatureSummary[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: features.length,
    getScrollElement: function getScrollElement() {
      return scrollRef.current;
    },
    estimateSize: function estimateSize() {
      return ROW_HEIGHT;
    },
    overscan: 8,
  });

  if (features.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <div ref={scrollRef} className="h-full space-y-2 overflow-auto p-4">
        {features.map(function toCard(feature) {
          return <FeatureCard key={feature.id} feature={feature} />;
        })}
      </div>
    );
  }

  return (
    <div ref={scrollRef} data-testid="virtualized-list" className="h-full overflow-auto p-4">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(function toRow(row) {
          const feature = features[row.index];
          if (feature === undefined) return null;

          return (
            <div
              key={feature.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: ROW_HEIGHT,
                transform: `translateY(${row.start}px)`,
                paddingBottom: 8,
              }}
            >
              <FeatureCard feature={feature} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CatalogView() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: catalog } = useQuery(catalogQuery());
  const {
    data: features,
    isPending,
    isError,
    error,
  } = useQuery(featuresQuery({ status: search.status, search: search.search, tags: search.tags }));

  /** Rewrites one search param, dropping it when cleared. */
  function updateSearch(patch: Partial<CatalogSearch>): void {
    void navigate({
      search: function nextSearch(previous) {
        const merged = { ...previous, ...patch };
        return Object.fromEntries(
          Object.entries(merged).filter(function isSet([, value]) {
            return value !== undefined && value !== '';
          })
        ) as CatalogSearch;
      },
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="pb-title-bar">Catalog</div>
      <div className="shrink-0 space-y-3 border-b-2 border-[var(--ink)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex-1 sm:max-w-xs">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-2.5 left-2 size-4"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search features"
              placeholder="Search features"
              value={search.search ?? ''}
              onChange={function onSearchChange(event) {
                updateSearch({ search: event.target.value });
              }}
              className="w-full rounded-[var(--radius)] border-2 border-[var(--ink)] bg-[var(--paper)] py-2 pr-3 pl-8 text-sm shadow-[2px_2px_0_var(--ink)] focus:outline-none focus:ring-0"
            />
          </label>

          <div className="flex gap-1" role="group" aria-label="Filter by status">
            {(['passing', 'failing', 'untested'] as const).map(function toFilter(status) {
              const active = search.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  aria-pressed={active}
                  onClick={function onToggle() {
                    updateSearch({ status: active ? undefined : status });
                  }}
                  className={cn(
                    'rounded-[var(--radius)] border-2 border-[var(--ink)] px-2 py-1 font-mono text-xs capitalize shadow-[2px_2px_0_var(--ink)] transition-[transform,background-color,box-shadow]',
                    active
                      ? 'bg-[var(--ink)] text-[var(--paper)] shadow-none'
                      : 'bg-[var(--paper)] hover:bg-[var(--paper-muted)]'
                  )}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        {catalog === undefined ? null : (
          <div className="text-muted-foreground flex flex-wrap items-center gap-4 font-mono text-xs">
            <span>
              {catalog.statusCounts.passing} passing, {catalog.statusCounts.failing} failing,{' '}
              {catalog.statusCounts.untested} untested
            </span>
            <span data-testid="overall-coverage">{catalog.overallCoverage}% covered</span>
            <div className="flex flex-wrap gap-1">
              {catalog.tags.map(function toTag(tag) {
                const bare = tag.replace(/^@/, '');
                const active = search.tags === bare;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={function onToggleTag() {
                      updateSearch({ tags: active ? undefined : bare });
                    }}
                    className={cn(
                      'rounded-[var(--radius)] border-2 border-[var(--ink)] px-1.5 py-0.5 transition-colors',
                      active
                        ? 'bg-[var(--ink)] text-[var(--paper)]'
                        : 'bg-[var(--paper-muted)] hover:bg-[var(--paper)]'
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {isPending ? <LoadingState label="Loading catalog" /> : null}
        {isError ? <ErrorState error={error} /> : null}
        {features !== undefined && features.length === 0 ? (
          <EmptyState
            title="No features match these filters"
            description="Clear the search or status filter to see everything indexed."
          />
        ) : null}
        {features !== undefined && features.length > 0 ? <FeatureList features={features} /> : null}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: function getParent() {
    return rootRoute;
  },
  path: '/',
  validateSearch: zodValidator(catalogSearchSchema),
  component: CatalogView,
});

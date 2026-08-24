import type { DiagramLink, ScenarioSummary } from '@eddy/behavior-contracts';
import { useQuery } from '@tanstack/react-query';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels';
import { z } from 'zod';
import { diagramQuery, featureQuery } from '@/api/queries';
import { CoverageBar } from '@/components/coverage-bar';
import { EditorLinks } from '@/components/editor-links';
import { GherkinSteps } from '@/components/gherkin-steps';
import { MermaidDiagram } from '@/components/mermaid-diagram';
import { OutcomeBadge, StatusBadge } from '@/components/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { SystemValueReport } from '@/components/system-value-report';
import { ActivatesGraph, ScenarioActivates } from '@/components/activates-graph';
import { cn } from '@/lib/cn';
import { Route as rootRoute } from './root';

/** The selected scenario is a search param so a three-panel view is linkable. */
const featureSearchSchema = z.object({
  scenario: z.string().optional(),
});

/** Left panel: the feature's scenarios. */
function ScenarioList({
  scenarios,
  selectedId,
  onSelect,
}: {
  scenarios: readonly ScenarioSummary[];
  selectedId: string | undefined;
  onSelect: (scenarioId: string) => void;
}) {
  if (scenarios.length === 0) {
    return <EmptyState title="This feature has no scenarios" />;
  }

  return (
    <ul className="divide-border divide-y" data-testid="scenario-list">
      {scenarios.map(function toItem(scenario) {
        const selected = scenario.id === selectedId;

        return (
          <li key={scenario.id}>
            <button
              type="button"
              data-testid="scenario-list-item"
              aria-current={selected ? 'true' : undefined}
              onClick={function onClick() {
                onSelect(scenario.id);
              }}
              className={cn(
                'hover:bg-muted w-full px-3 py-2 text-left transition-colors',
                selected && 'bg-muted'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm">{scenario.name}</span>
                <OutcomeBadge outcome={scenario.status.overall} flaky={scenario.status.flaky} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {scenario.steps.length} steps
                {scenario.tags.length > 0 ? ` · ${scenario.tags.join(' ')}` : ''}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Middle panel: the selected scenario's steps and test results. */
function ScenarioDetailPanel({
  scenario,
  onSelectScenario,
}: {
  scenario: ScenarioSummary;
  onSelectScenario?: (scenarioId: string) => void;
}) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-medium">{scenario.name}</h2>
          <OutcomeBadge outcome={scenario.status.overall} flaky={scenario.status.flaky} />
        </div>
        {scenario.description.length > 0 ? (
          <p className="text-muted-foreground mt-1 text-sm">{scenario.description}</p>
        ) : null}
      </div>

      <EditorLinks query={{ target: 'scenario', id: scenario.id }} />

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Steps</h3>
        <GherkinSteps steps={scenario.steps} />
      </section>

      <ScenarioActivates links={scenario.activates} onSelectScenario={onSelectScenario} />

      <section>
        <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">Tests</h3>
        {scenario.testLinks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No test covers this scenario yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="test-links">
            {scenario.testLinks.map(function toTest(link) {
              return (
                <li key={link.testId} className="border-border rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs">
                      {link.path}:{link.line}
                    </span>
                    <OutcomeBadge outcome={link.status} />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {link.framework}
                    {link.durationMs === undefined ? '' : ` · ${link.durationMs}ms`}
                  </p>
                  {link.errorMessage === undefined ? null : (
                    <pre
                      data-testid="test-error"
                      className="bg-failing/10 text-failing mt-2 overflow-auto rounded p-2 text-xs"
                    >
                      {link.errorMessage}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Right panel: a linked diagram, rendered inline. */
function DiagramPanel({ links }: { links: readonly DiagramLink[] }) {
  const first = links[0];
  const { data: diagram, isPending } = useQuery({
    ...diagramQuery(first?.diagramId ?? ''),
    enabled: first !== undefined,
  });

  if (first === undefined) {
    return <EmptyState title="No diagram linked" description="No diagram matched this scenario." />;
  }

  if (isPending || diagram === undefined) return <LoadingState label="Loading diagram" />;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{diagram.title}</h3>
        <span className="text-muted-foreground text-xs capitalize">
          {first.relevance} relevance
        </span>
      </div>
      <MermaidDiagram source={diagram.content} id={diagram.id} />
      <p className="text-muted-foreground text-xs">
        {diagram.metadata.nodeCount} nodes · {diagram.metadata.complexity}
      </p>
    </div>
  );
}

function FeatureView() {
  const { featureId } = Route.useParams();
  const { scenario: selectedFromUrl } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  // Panel sizes persist to storage, so the layout survives reloads without a
  // client state library.
  const layout = useDefaultLayout({
    id: 'behavior-feature-panels',
    panelIds: ['scenarios', 'detail', 'diagram'],
  });

  const { data: feature, isPending, isError, error } = useQuery(featureQuery(featureId));

  if (isPending) return <LoadingState label="Loading feature" />;
  if (isError) return <ErrorState error={error} />;
  if (feature === undefined) return <ErrorState error={new Error('Feature not found')} />;

  const selected =
    feature.scenarios.find(function isSelected(candidate) {
      return candidate.id === selectedFromUrl;
    }) ?? feature.scenarios[0];

  function selectScenario(scenarioId: string): void {
    void navigate({ search: { scenario: scenarioId } });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-border shrink-0 border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-semibold">{feature.title}</h1>
            <p className="text-muted-foreground truncate text-xs">{feature.path}</p>
          </div>
          <StatusBadge status={feature.status} />
        </div>
        {feature.description.length > 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">{feature.description}</p>
        ) : null}
        <div className="mt-3 flex items-center gap-4">
          <CoverageBar value={feature.testCoverage} className="max-w-64" />
          <EditorLinks query={{ target: 'feature', id: feature.id }} />
          {feature.dialect === 'gurki' ? (
            <span
              className="border-border text-muted-foreground rounded border px-1.5 py-0.5 text-xs"
              data-testid="dialect-badge"
            >
              Gurki
            </span>
          ) : null}
        </div>
        {feature.dialect === 'gurki' ? (
          <SystemValueReport
            className="mt-4"
            outputs={feature.systemOutputs}
            outcomes={feature.systemOutcomes}
          />
        ) : null}
        {feature.dialect === 'gurki' ? (
          <ActivatesGraph
            className="mt-4"
            links={feature.activatesLinks}
            mermaid={feature.activatesMermaid}
            onSelectScenario={selectScenario}
          />
        ) : null}
      </div>

      <Group orientation="horizontal" className="min-h-0 flex-1" {...layout}>
        <Panel id="scenarios" defaultSize="26%" minSize="16%" className="overflow-auto">
          <ScenarioList
            scenarios={feature.scenarios}
            selectedId={selected?.id}
            onSelect={selectScenario}
          />
        </Panel>

        <Separator className="bg-border hover:bg-ring w-px transition-colors" />

        <Panel id="detail" defaultSize="44%" minSize="24%" className="overflow-auto">
          {selected === undefined ? (
            <EmptyState title="Select a scenario" />
          ) : (
            <ScenarioDetailPanel scenario={selected} onSelectScenario={selectScenario} />
          )}
        </Panel>

        <Separator className="bg-border hover:bg-ring w-px transition-colors" />

        <Panel id="diagram" defaultSize="30%" minSize="18%" className="overflow-auto">
          <DiagramPanel links={selected?.diagramLinks ?? feature.diagramLinks} />
        </Panel>
      </Group>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: function getParent() {
    return rootRoute;
  },
  path: '/features/$featureId',
  validateSearch: zodValidator(featureSearchSchema),
  component: FeatureView,
});

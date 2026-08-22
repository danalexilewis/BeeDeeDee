import type {
  AgentContext,
  CatalogData,
  DiagramContent,
  EditorLink,
  EditorLinkQuery,
  FeatureDetail,
  FeatureFilterInput,
  FeatureSummary,
  IndexStatus,
  LintResult,
  ScenarioDetail,
  TestStatus,
} from '@eddy/behavior-contracts';
import { queryOptions } from '@tanstack/react-query';
import { api, unwrap } from './client.js';

/**
 * Query keys.
 *
 * Grouped so a mutation can invalidate a whole area — after ingesting results,
 * invalidating `['catalog']` and `['scenario']` is enough without listing every
 * scenario id.
 */
export const queryKeys = {
  catalog: ['catalog'] as const,
  features: (filter: FeatureFilterInput) => ['features', filter] as const,
  feature: (featureId: string) => ['feature', featureId] as const,
  scenario: (scenarioId: string) => ['scenario', scenarioId] as const,
  agentContext: (scenarioId: string) => ['agent-context', scenarioId] as const,
  diagram: (diagramId: string) => ['diagram', diagramId] as const,
  testStatus: (scenarioId: string) => ['test-status', scenarioId] as const,
  indexStatus: ['index-status'] as const,
  lint: ['lint'] as const,
  editorLinks: (query: EditorLinkQuery) => ['editor-links', query] as const,
};

export function catalogQuery() {
  return queryOptions({
    queryKey: queryKeys.catalog,
    queryFn: async function fetchCatalog(): Promise<CatalogData> {
      return unwrap(await api.getCatalog());
    },
  });
}

export function featuresQuery(filter: FeatureFilterInput) {
  return queryOptions({
    queryKey: queryKeys.features(filter),
    queryFn: async function fetchFeatures(): Promise<FeatureSummary[]> {
      return unwrap(await api.listFeatures({ query: filter }));
    },
  });
}

export function featureQuery(featureId: string) {
  return queryOptions({
    queryKey: queryKeys.feature(featureId),
    queryFn: async function fetchFeature(): Promise<FeatureDetail> {
      return unwrap(await api.getFeature({ params: { featureId } }));
    },
  });
}

export function scenarioQuery(scenarioId: string) {
  return queryOptions({
    queryKey: queryKeys.scenario(scenarioId),
    queryFn: async function fetchScenario(): Promise<ScenarioDetail> {
      return unwrap(await api.getScenario({ params: { scenarioId } }));
    },
  });
}

export function agentContextQuery(scenarioId: string) {
  return queryOptions({
    queryKey: queryKeys.agentContext(scenarioId),
    queryFn: async function fetchAgentContext(): Promise<AgentContext> {
      return unwrap(await api.getAgentContext({ params: { scenarioId } }));
    },
  });
}

export function diagramQuery(diagramId: string) {
  return queryOptions({
    queryKey: queryKeys.diagram(diagramId),
    queryFn: async function fetchDiagram(): Promise<DiagramContent> {
      return unwrap(await api.getDiagram({ params: { diagramId } }));
    },
  });
}

export function testStatusQuery(scenarioId: string) {
  return queryOptions({
    queryKey: queryKeys.testStatus(scenarioId),
    queryFn: async function fetchTestStatus(): Promise<TestStatus> {
      return unwrap(await api.getTestStatus({ params: { scenarioId } }));
    },
  });
}

export function indexStatusQuery() {
  return queryOptions({
    queryKey: queryKeys.indexStatus,
    queryFn: async function fetchIndexStatus(): Promise<IndexStatus> {
      return unwrap(await api.getIndexStatus());
    },
  });
}

export function lintQuery() {
  return queryOptions({
    queryKey: queryKeys.lint,
    queryFn: async function fetchLint(): Promise<LintResult[]> {
      return unwrap(await api.lintSpecs({ body: {} }));
    },
  });
}

export function editorLinksQuery(query: EditorLinkQuery) {
  return queryOptions({
    queryKey: queryKeys.editorLinks(query),
    queryFn: async function fetchEditorLinks(): Promise<EditorLink[]> {
      return unwrap(await api.getEditorLinks({ query }));
    },
  });
}

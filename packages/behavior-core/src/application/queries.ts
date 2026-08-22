import type {
  CatalogData,
  DiagramContent,
  FeatureDetail,
  FeatureSummary,
  FeatureFilter,
  IndexStatus,
  ScenarioDetail,
  TestStatus,
} from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { normalizeTag } from '../domain/text.js';
import {
  diagramNotFound,
  featureNotFound,
  scenarioNotFound,
  toErrorBody,
  type BehaviorError,
} from '../errors.js';
import type { IndexStorePort } from '../ports/index-store.js';
import type { BehaviorIndex } from './behavior-index.js';
import {
  statusOf,
  toCatalogData,
  toFeatureDetail,
  toFeatureSummary,
  toScenarioDetail,
} from './projections.js';

export type QueryDeps = {
  indexStore: IndexStorePort;
};

/** Dashboard payload. */
export function getCatalog(deps: QueryDeps): Result<CatalogData, BehaviorError> {
  return deps.indexStore.read().map(toCatalogData);
}

/** True when a feature satisfies every provided filter clause. */
function matchesFilter(feature: FeatureSummary, filter: FeatureFilter): boolean {
  if (filter.status !== undefined && feature.status !== filter.status) return false;

  if (filter.minCoverage !== undefined && feature.testCoverage < filter.minCoverage) return false;
  if (filter.maxCoverage !== undefined && feature.testCoverage > filter.maxCoverage) return false;

  if (filter.tags !== undefined && filter.tags.length > 0) {
    const featureTags = new Set(feature.tags.map(normalizeTag));
    const wanted = filter.tags.map(normalizeTag);
    const hasEvery = wanted.every(function isPresent(tag) {
      return featureTags.has(tag);
    });
    if (!hasEvery) return false;
  }

  if (filter.search !== undefined && filter.search.trim().length > 0) {
    const needle = filter.search.trim().toLowerCase();
    const haystack =
      `${feature.title} ${feature.description} ${feature.tags.join(' ')}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

/** Features matching a filter, ordered by title. */
export function listFeatures(
  deps: QueryDeps,
  filter: FeatureFilter
): Result<FeatureSummary[], BehaviorError> {
  return deps.indexStore.read().map(function filterFeatures(index) {
    return [...index.features.values()]
      .map(function toSummary(feature) {
        return toFeatureSummary(index, feature);
      })
      .filter(function keep(feature) {
        return matchesFilter(feature, filter);
      })
      .sort(function byTitle(left, right) {
        return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
      });
  });
}

/** One feature with its scenarios. */
export function getFeature(
  deps: QueryDeps,
  featureId: string
): Result<FeatureDetail, BehaviorError> {
  return deps.indexStore.read().andThen(function find(index) {
    const feature = index.features.get(featureId);
    return feature === undefined
      ? err(featureNotFound(featureId))
      : ok(toFeatureDetail(index, feature));
  });
}

/** One scenario with full source context. */
export function getScenario(
  deps: QueryDeps,
  scenarioId: string
): Result<ScenarioDetail, BehaviorError> {
  return deps.indexStore.read().andThen(function find(index) {
    const scenario = index.scenarios.get(scenarioId);
    return scenario === undefined
      ? err(scenarioNotFound(scenarioId))
      : ok(toScenarioDetail(index, scenario));
  });
}

/** One diagram, with the link that surfaced it for the requesting scenario. */
export function getDiagram(
  deps: QueryDeps,
  diagramId: string
): Result<DiagramContent, BehaviorError> {
  return deps.indexStore.read().andThen(function find(index) {
    const diagram = index.diagrams.get(diagramId);
    if (diagram === undefined) return err(diagramNotFound(diagramId));

    // Reuse the strongest link any scenario has to this diagram, so the caller
    // sees a relevance band rather than a bare file.
    let strongest = undefined as DiagramContent['link'] | undefined;
    for (const scenario of index.scenarios.values()) {
      for (const link of scenario.diagramLinks) {
        if (link.diagramId !== diagramId) continue;
        if (strongest === undefined || link.relevanceScore > strongest.relevanceScore) {
          strongest = link;
        }
      }
    }

    return ok({
      ...diagram,
      link: strongest ?? {
        diagramId: diagram.id,
        type: diagram.type,
        path: diagram.path,
        title: diagram.title,
        relevance: 'low' as const,
        relevanceScore: 0,
      },
    });
  });
}

/** Aggregated test status for one scenario. */
export function getTestStatus(
  deps: QueryDeps,
  scenarioId: string
): Result<TestStatus, BehaviorError> {
  return deps.indexStore.read().andThen(function find(index) {
    return index.scenarios.has(scenarioId)
      ? ok(statusOf(index, scenarioId))
      : err(scenarioNotFound(scenarioId));
  });
}

/** Index lifecycle state and counts. Reports a state even with no index yet. */
export function getIndexStatus(deps: QueryDeps): IndexStatus {
  const state = deps.indexStore.state();
  const index = deps.indexStore.read();

  if (index.isErr()) {
    return {
      state,
      featureCount: 0,
      scenarioCount: 0,
      diagramCount: 0,
      testFileCount: 0,
      lastIndexedAt: null,
      durationMs: null,
      problems: [],
    };
  }

  return toIndexStatus(index.value, state);
}

/** Projects an index onto its status shape. */
export function toIndexStatus(index: BehaviorIndex, state: IndexStatus['state']): IndexStatus {
  return {
    state,
    featureCount: index.features.size,
    scenarioCount: index.scenarios.size,
    diagramCount: index.diagrams.size,
    testFileCount: index.testFileCount,
    lastIndexedAt: index.indexedAt,
    durationMs: index.durationMs,
    problems: index.problems,
  };
}

/** Renders an error for callers that only need the wire body. */
export { toErrorBody };

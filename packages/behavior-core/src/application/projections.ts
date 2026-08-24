import type {
  CatalogData,
  FeatureDetail,
  FeatureSummary,
  ScenarioDetail,
  ScenarioSummary,
  TestStatus,
} from '@eddy/behavior-contracts';
import {
  calculateCoverageMetrics,
  calculateFeatureCoverage,
  countFeatureStatuses,
  type CoverageFeature,
} from '../domain/coverage.js';
import { aggregateScenarioStatus } from '../domain/status.js';
import {
  resultsFor,
  testLinksFor,
  type BehaviorIndex,
  type IndexedFeature,
  type IndexedScenario,
} from './behavior-index.js';

/**
 * Projections from the in-memory index onto the contract's JSON shapes.
 *
 * The index uses Maps and denormalised references for lookup speed; nothing here
 * is serialisable until it passes through these functions, which is deliberate —
 * it keeps the wire format from dictating the internal model.
 */

/** Aggregated status for one scenario. */
export function statusOf(index: BehaviorIndex, scenarioId: string): TestStatus {
  return aggregateScenarioStatus(scenarioId, resultsFor(index, scenarioId));
}

/** Coverage-shaped view of one scenario. */
function toCoverageScenario(index: BehaviorIndex, scenarioId: string) {
  return {
    id: scenarioId,
    hasLinkedTest: testLinksFor(index, scenarioId).length > 0,
    status: statusOf(index, scenarioId),
  };
}

/** Coverage-shaped view of a feature, for the coverage calculations. */
function toCoverageFeature(index: BehaviorIndex, feature: IndexedFeature): CoverageFeature {
  return {
    id: feature.id,
    title: feature.title,
    scenarios: feature.scenarioIds.map(function toScenario(scenarioId) {
      return toCoverageScenario(index, scenarioId);
    }),
  };
}

/** Every feature in coverage shape, in a stable order. */
function allCoverageFeatures(index: BehaviorIndex): CoverageFeature[] {
  return [...index.features.values()]
    .sort(function byId(left, right) {
      return left.id.localeCompare(right.id);
    })
    .map(function toCoverage(feature) {
      return toCoverageFeature(index, feature);
    });
}

/** Projects a scenario onto its summary shape. */
export function toScenarioSummary(
  index: BehaviorIndex,
  scenario: IndexedScenario
): ScenarioSummary {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    steps: scenario.steps,
    tags: scenario.tags,
    testLinks: testLinksFor(index, scenario.id),
    diagramLinks: scenario.diagramLinks,
    status: statusOf(index, scenario.id),
    line: scenario.line,
  };
}

/** Projects a scenario onto its detail shape. */
export function toScenarioDetail(index: BehaviorIndex, scenario: IndexedScenario): ScenarioDetail {
  return {
    ...toScenarioSummary(index, scenario),
    featureId: scenario.featureId,
    featureTitle: scenario.featureTitle,
    featurePath: scenario.featurePath,
    gherkinSource: index.features.get(scenario.featureId)?.source ?? '',
    lastUpdated: index.indexedAt,
  };
}

/** Projects a feature onto its summary shape. */
export function toFeatureSummary(index: BehaviorIndex, feature: IndexedFeature): FeatureSummary {
  const coverage = calculateFeatureCoverage(toCoverageFeature(index, feature));

  return {
    id: feature.id,
    title: feature.title,
    description: feature.description,
    path: feature.path,
    tags: feature.tags,
    scenarioCount: coverage.totalScenarios,
    testCoverage: coverage.coverage,
    status: coverage.status,
    lastUpdated: index.indexedAt,
  };
}

/** Projects a feature onto its detail shape. */
export function toFeatureDetail(index: BehaviorIndex, feature: IndexedFeature): FeatureDetail {
  const detail: FeatureDetail = {
    ...toFeatureSummary(index, feature),
    scenarios: feature.scenarioIds.flatMap(function toScenario(scenarioId) {
      const scenario = index.scenarios.get(scenarioId);
      return scenario === undefined ? [] : [toScenarioSummary(index, scenario)];
    }),
    diagramLinks: feature.diagramLinks,
    rules: feature.rules,
    gherkinSource: feature.source,
    dialect: feature.dialect,
    systemOutputs: feature.systemOutputs,
    systemOutcomes: feature.systemOutcomes,
  };

  return feature.background === undefined ? detail : { ...detail, background: feature.background };
}

/** Builds the catalog payload. */
export function toCatalogData(index: BehaviorIndex): CatalogData {
  const features = [...index.features.values()]
    .sort(function byTitle(left, right) {
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    })
    .map(function toSummary(feature) {
      return toFeatureSummary(index, feature);
    });

  const coverageFeatures = allCoverageFeatures(index);
  const metrics = calculateCoverageMetrics(coverageFeatures);
  const statusCounts = countFeatureStatuses(coverageFeatures);

  const tags = [
    ...new Set(
      features.flatMap(function toTags(feature) {
        return feature.tags;
      })
    ),
  ].sort();

  return {
    features,
    totalScenarios: metrics.totalScenarios,
    overallCoverage: metrics.scenarioCoverage,
    statusCounts,
    tags,
  };
}

import type {
  CoverageMetrics,
  FeatureCoverage,
  FeatureStatus,
  TestStatus,
} from '@eddy/behavior-contracts';
import { isTested } from './status.js';

/** The coverage-relevant slice of a scenario. */
export type CoverageScenario = {
  id: string;
  status: TestStatus;
};

/** The coverage-relevant slice of a feature. */
export type CoverageFeature = {
  id: string;
  title: string;
  scenarios: readonly CoverageScenario[];
};

/** Percentage of `part` within `whole`, rounded to one decimal, 0 when whole is 0. */
export function percentage(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * Rolls scenario statuses up into a feature status.
 *
 * Any failing scenario makes the feature failing. A feature with no tested
 * scenarios is untested. Otherwise it is passing, even when some scenarios remain
 * untested, since coverage reports that gap separately.
 */
export function aggregateFeatureStatus(scenarios: readonly CoverageScenario[]): FeatureStatus {
  if (
    scenarios.some(function isFailing(scenario) {
      return scenario.status.overall === 'fail';
    })
  ) {
    return 'failing';
  }

  const tested = scenarios.filter(function hasTests(scenario) {
    return isTested(scenario.status);
  });

  return tested.length === 0 ? 'untested' : 'passing';
}

/** Coverage for a single feature. */
export function calculateFeatureCoverage(feature: CoverageFeature): FeatureCoverage {
  const totalScenarios = feature.scenarios.length;
  const testedScenarios = feature.scenarios.filter(function hasTests(scenario) {
    return isTested(scenario.status);
  }).length;

  return {
    featureId: feature.id,
    featureTitle: feature.title,
    totalScenarios,
    testedScenarios,
    coverage: percentage(testedScenarios, totalScenarios),
    status: aggregateFeatureStatus(feature.scenarios),
  };
}

/**
 * Project-wide coverage.
 *
 * `scenarioCoverage` is the share of all scenarios that have a test.
 * `featureCoverage` is the share of features that are fully covered, which is a
 * stricter measure and deliberately different from averaging feature coverages.
 */
export function calculateCoverageMetrics(features: readonly CoverageFeature[]): CoverageMetrics {
  const featureMetrics: Record<string, FeatureCoverage> = {};

  let totalScenarios = 0;
  let testedScenarios = 0;
  let fullyCoveredFeatures = 0;

  for (const feature of features) {
    const coverage = calculateFeatureCoverage(feature);
    featureMetrics[feature.id] = coverage;

    totalScenarios += coverage.totalScenarios;
    testedScenarios += coverage.testedScenarios;

    if (coverage.totalScenarios > 0 && coverage.testedScenarios === coverage.totalScenarios) {
      fullyCoveredFeatures += 1;
    }
  }

  return {
    scenarioCoverage: percentage(testedScenarios, totalScenarios),
    featureCoverage: percentage(fullyCoveredFeatures, features.length),
    totalScenarios,
    testedScenarios,
    untestedScenarios: totalScenarios - testedScenarios,
    featureMetrics,
  };
}

/** Tallies features by status, for the catalog header. */
export function countFeatureStatuses(
  features: readonly CoverageFeature[]
): Record<FeatureStatus, number> {
  const counts: Record<FeatureStatus, number> = { passing: 0, failing: 0, untested: 0 };

  for (const feature of features) {
    counts[aggregateFeatureStatus(feature.scenarios)] += 1;
  }

  return counts;
}

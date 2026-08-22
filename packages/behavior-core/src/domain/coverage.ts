import type {
  CoverageMetrics,
  FeatureCoverage,
  FeatureStatus,
  TestStatus,
} from '@eddy/behavior-contracts';

/** The coverage-relevant slice of a scenario. */
export type CoverageScenario = {
  id: string;
  /**
   * Whether any test is linked to this scenario.
   *
   * Coverage asks whether a test exists, not whether it has run. Deriving this
   * from recorded results instead would report a scenario with a brand-new test
   * as uncovered, hiding the very gap coverage exists to show.
   */
  hasLinkedTest: boolean;
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
 * Any failing scenario makes the feature failing. A feature is passing only once
 * something has actually passed, so a feature whose tests exist but have never
 * run reads as untested rather than claiming success it has not earned. Coverage
 * reports the existence of tests separately.
 */
export function aggregateFeatureStatus(scenarios: readonly CoverageScenario[]): FeatureStatus {
  if (
    scenarios.some(function isFailing(scenario) {
      return scenario.status.overall === 'fail';
    })
  ) {
    return 'failing';
  }

  const anyPassed = scenarios.some(function isPassing(scenario) {
    return scenario.status.overall === 'pass';
  });

  return anyPassed ? 'passing' : 'untested';
}

/** Coverage for a single feature. */
export function calculateFeatureCoverage(feature: CoverageFeature): FeatureCoverage {
  const totalScenarios = feature.scenarios.length;
  const testedScenarios = feature.scenarios.filter(function isCovered(scenario) {
    return scenario.hasLinkedTest;
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

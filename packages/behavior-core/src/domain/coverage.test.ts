import type { TestResult } from '@eddy/behavior-contracts';
import { describe, expect, it } from 'vitest';
import {
  aggregateFeatureStatus,
  calculateCoverageMetrics,
  calculateFeatureCoverage,
  countFeatureStatuses,
  percentage,
  type CoverageFeature,
  type CoverageScenario,
} from './coverage.js';
import { aggregateScenarioStatus } from './status.js';

function result(status: TestResult['status'], testId = 't1'): TestResult {
  return {
    testId,
    testName: 'test',
    status,
    timestamp: '2026-07-29T10:00:00.000Z',
    file: 'tests/x.spec.ts',
    tags: [],
  };
}

function scenario(id: string, results: TestResult[] = []): CoverageScenario {
  return { id, status: aggregateScenarioStatus(id, results) };
}

function feature(id: string, scenarios: CoverageScenario[]): CoverageFeature {
  return { id, title: id, scenarios };
}

describe('percentage', () => {
  it.each([
    [0, 0, 0],
    [1, 4, 25],
    [1, 3, 33.3],
    [2, 3, 66.7],
    [3, 3, 100],
    [0, 5, 0],
  ])('reports %i of %i as %o percent', (part, whole, expected) => {
    expect(percentage(part, whole)).toBe(expected);
  });

  it('returns 0 rather than NaN when the whole is zero', () => {
    expect(percentage(5, 0)).toBe(0);
  });
});

describe('aggregateFeatureStatus', () => {
  it('is untested when no scenario has a test', () => {
    expect(aggregateFeatureStatus([scenario('a'), scenario('b')])).toBe('untested');
  });

  it('is passing when every tested scenario passed', () => {
    expect(aggregateFeatureStatus([scenario('a', [result('pass')])])).toBe('passing');
  });

  it('is failing when any scenario failed', () => {
    expect(
      aggregateFeatureStatus([scenario('a', [result('pass')]), scenario('b', [result('fail')])])
    ).toBe('failing');
  });

  it('is passing when some scenarios pass and others are merely untested', () => {
    expect(aggregateFeatureStatus([scenario('a', [result('pass')]), scenario('b')])).toBe(
      'passing'
    );
  });

  it('is untested for a feature with no scenarios at all', () => {
    expect(aggregateFeatureStatus([])).toBe('untested');
  });
});

describe('calculateFeatureCoverage', () => {
  it('counts tested scenarios and derives a percentage', () => {
    const coverage = calculateFeatureCoverage(
      feature('login', [scenario('a', [result('pass')]), scenario('b')])
    );
    expect(coverage).toEqual({
      featureId: 'login',
      featureTitle: 'login',
      totalScenarios: 2,
      testedScenarios: 1,
      coverage: 50,
      status: 'passing',
    });
  });

  it('reports zero coverage for an empty feature without dividing by zero', () => {
    const coverage = calculateFeatureCoverage(feature('empty', []));
    expect(coverage.coverage).toBe(0);
    expect(coverage.status).toBe('untested');
  });
});

describe('calculateCoverageMetrics', () => {
  it('returns zeroes for no features', () => {
    expect(calculateCoverageMetrics([])).toEqual({
      scenarioCoverage: 0,
      featureCoverage: 0,
      totalScenarios: 0,
      testedScenarios: 0,
      untestedScenarios: 0,
      featureMetrics: {},
    });
  });

  it('sums scenario counts across features', () => {
    const metrics = calculateCoverageMetrics([
      feature('a', [scenario('a1', [result('pass')]), scenario('a2')]),
      feature('b', [scenario('b1', [result('fail')])]),
    ]);
    expect(metrics.totalScenarios).toBe(3);
    expect(metrics.testedScenarios).toBe(2);
    expect(metrics.untestedScenarios).toBe(1);
    expect(metrics.scenarioCoverage).toBe(66.7);
  });

  it('measures feature coverage as the share of fully covered features', () => {
    const metrics = calculateCoverageMetrics([
      feature('a', [scenario('a1', [result('pass')])]),
      feature('b', [scenario('b1', [result('pass')]), scenario('b2')]),
    ]);
    // One of two features is fully covered, even though scenario coverage is 66.7%.
    expect(metrics.featureCoverage).toBe(50);
    expect(metrics.scenarioCoverage).toBe(66.7);
  });

  it('does not count an empty feature as fully covered', () => {
    const metrics = calculateCoverageMetrics([feature('empty', [])]);
    expect(metrics.featureCoverage).toBe(0);
  });

  it('keys feature metrics by feature id', () => {
    const metrics = calculateCoverageMetrics([feature('login', [scenario('a')])]);
    expect(Object.keys(metrics.featureMetrics)).toEqual(['login']);
    expect(metrics.featureMetrics.login?.featureId).toBe('login');
  });
});

describe('countFeatureStatuses', () => {
  it('tallies each status', () => {
    const counts = countFeatureStatuses([
      feature('a', [scenario('a1', [result('pass')])]),
      feature('b', [scenario('b1', [result('fail')])]),
      feature('c', [scenario('c1')]),
      feature('d', [scenario('d1', [result('pass')])]),
    ]);
    expect(counts).toEqual({ passing: 2, failing: 1, untested: 1 });
  });

  it('returns zeroes for no features', () => {
    expect(countFeatureStatuses([])).toEqual({ passing: 0, failing: 0, untested: 0 });
  });
});

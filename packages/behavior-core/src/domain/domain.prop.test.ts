import type { TestResult } from '@eddy/behavior-contracts';
import {
  arbFeature,
  arbMermaid,
  arbPhrase,
  arbResultsForOneTest,
  arbTestResults,
  type ArbitraryFeature,
} from '@eddy/test-support';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  calculateCoverageMetrics,
  calculateFeatureCoverage,
  type CoverageFeature,
  type CoverageScenario,
} from './coverage.js';
import { assignScenarioIds, featureIdFromPath } from './ids.js';
import { calculateDiagramRelevance, type RelevanceDiagram } from './relevance.js';
import { aggregateOutcome, aggregateScenarioStatus, detectFlaky, mergeResults } from './status.js';

/** A permutation of the given items, used to prove order independence. */
function arbShuffled<T>(items: readonly T[]): fc.Arbitrary<T[]> {
  return fc.shuffledSubarray([...items], {
    minLength: items.length,
    maxLength: items.length,
  });
}

function passingResult(testId: string): TestResult {
  return {
    testId,
    testName: testId,
    status: 'pass',
    timestamp: '2026-07-29T10:00:00.000Z',
    file: 'tests/x.spec.ts',
    tags: [],
  };
}

function toCoverageFeature(feature: ArbitraryFeature, testedCount: number): CoverageFeature {
  const ids = assignScenarioIds(
    featureIdFromPath('', feature.path),
    feature.scenarios.map(s => s.name)
  );

  const scenarios: CoverageScenario[] = ids.map(function toScenario(id, index) {
    const covered = index < testedCount;
    const results = covered ? [passingResult(`${id}-test`)] : [];
    return { id, hasLinkedTest: covered, status: aggregateScenarioStatus(id, results) };
  });

  return { id: featureIdFromPath('', feature.path), title: feature.title, scenarios };
}

describe('Property 1: indexing is idempotent', () => {
  it('assigns identical scenario ids on repeated runs', () => {
    fc.assert(
      fc.property(arbFeature, function idsAreStable(feature) {
        const names = feature.scenarios.map(s => s.name);
        const featureId = featureIdFromPath('', feature.path);
        expect(assignScenarioIds(featureId, names)).toEqual(assignScenarioIds(featureId, names));
      })
    );
  });

  it('never assigns the same id to two scenarios', () => {
    fc.assert(
      fc.property(arbFeature, function idsAreUnique(feature) {
        const ids = assignScenarioIds(
          featureIdFromPath('', feature.path),
          feature.scenarios.map(s => s.name)
        );
        expect(new Set(ids).size).toBe(ids.length);
      })
    );
  });

  it('re-ingesting the same results changes nothing', () => {
    fc.assert(
      fc.property(arbTestResults, function ingestIsIdempotent(results) {
        const once = mergeResults([], results);
        const twice = mergeResults(once, results);
        expect(new Set(twice.map(r => r.testId))).toEqual(new Set(once.map(r => r.testId)));
        expect(twice).toHaveLength(once.length);
      })
    );
  });
});

describe('Property 2: ingestion order does not matter', () => {
  it('produces the same overall outcome for any ordering', () => {
    fc.assert(
      fc.property(
        arbTestResults.chain(function withShuffle(results) {
          return fc.tuple(fc.constant(results), arbShuffled(results));
        }),
        function outcomeCommutes([original, shuffled]) {
          expect(aggregateOutcome(shuffled)).toBe(aggregateOutcome(original));
        }
      )
    );
  });

  it('produces the same aggregated status for any ordering', () => {
    fc.assert(
      fc.property(
        arbTestResults.chain(function withShuffle(results) {
          return fc.tuple(fc.constant(results), arbShuffled(results));
        }),
        function statusCommutes([original, shuffled]) {
          expect(aggregateScenarioStatus('s', shuffled)).toEqual(
            aggregateScenarioStatus('s', original)
          );
        }
      )
    );
  });

  it('detects flakiness regardless of ordering', () => {
    fc.assert(
      fc.property(
        arbResultsForOneTest.chain(function withShuffle(results) {
          return fc.tuple(fc.constant(results), arbShuffled(results));
        }),
        function flakyCommutes([original, shuffled]) {
          expect(detectFlaky(shuffled)).toBe(detectFlaky(original));
        }
      )
    );
  });
});

describe('Property 3: coverage is monotonic', () => {
  it('never decreases when another scenario gains a test', () => {
    fc.assert(
      fc.property(arbFeature, function coverageGrows(feature) {
        const total = feature.scenarios.length;

        let previous = -1;
        for (let tested = 0; tested <= total; tested += 1) {
          const coverage = calculateFeatureCoverage(toCoverageFeature(feature, tested)).coverage;
          expect(coverage).toBeGreaterThanOrEqual(previous);
          previous = coverage;
        }
      })
    );
  });

  it('reports 100 percent exactly when every scenario is tested', () => {
    fc.assert(
      fc.property(arbFeature, function fullCoverage(feature) {
        const all = calculateFeatureCoverage(toCoverageFeature(feature, feature.scenarios.length));
        expect(all.coverage).toBe(100);
        expect(all.testedScenarios).toBe(all.totalScenarios);
      })
    );
  });

  it('keeps tested and untested counts summing to the total', () => {
    fc.assert(
      fc.property(
        fc.array(arbFeature, { minLength: 1, maxLength: 4 }),
        fc.nat({ max: 3 }),
        function countsAgree(features, testedPerFeature) {
          const metrics = calculateCoverageMetrics(
            features.map(f => toCoverageFeature(f, testedPerFeature))
          );
          expect(metrics.testedScenarios + metrics.untestedScenarios).toBe(metrics.totalScenarios);
        }
      )
    );
  });
});

describe('Property 4: scenario status matches its aggregated results', () => {
  it('is failing exactly when some result failed', () => {
    fc.assert(
      fc.property(arbTestResults, function failureDominates(results) {
        const anyFailed = results.some(r => r.status === 'fail');
        expect(aggregateScenarioStatus('s', results).overall === 'fail').toBe(anyFailed);
      })
    );
  });

  it('is not-run exactly when there are no results or none ran', () => {
    fc.assert(
      fc.property(arbTestResults, function notRunIsPrecise(results) {
        const status = aggregateScenarioStatus('s', results);
        const noneRan = results.every(r => r.status === 'not-run');
        expect(status.overall === 'not-run').toBe(results.length === 0 || noneRan);
      })
    );
  });

  it('reports lastRun as the maximum result timestamp', () => {
    fc.assert(
      fc.property(arbTestResults, function lastRunIsMax(results) {
        const status = aggregateScenarioStatus('s', results);
        if (results.length === 0) {
          expect(status.lastRun).toBeNull();
          return;
        }
        const max = results
          .map(r => r.timestamp)
          .sort()
          .at(-1);
        expect(status.lastRun).toBe(max);
      })
    );
  });

  it('retains every ingested result', () => {
    fc.assert(
      fc.property(arbTestResults, function resultsArePreserved(results) {
        expect(aggregateScenarioStatus('s', results).results).toHaveLength(results.length);
      })
    );
  });
});

describe('Property 5: relevance scores stay within 0 and 1', () => {
  it('never leaves the unit interval for any spec and diagram pairing', () => {
    fc.assert(
      fc.property(arbFeature, arbMermaid, function scoreIsBounded(feature, mermaid) {
        const scenario = feature.scenarios[0]!;
        const diagram: RelevanceDiagram = {
          id: 'd',
          type: 'mermaid',
          path: 'specs/diagrams/d.mmd',
          title: mermaid.title,
          content: mermaid.source,
        };

        const score = calculateDiagramRelevance(
          {
            name: scenario.name,
            featureTitle: feature.title,
            tags: scenario.tags,
            stepTexts: scenario.steps,
          },
          diagram
        );

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(Number.isNaN(score)).toBe(false);
      })
    );
  });

  it('is symmetric under repeated evaluation', () => {
    fc.assert(
      fc.property(arbPhrase, arbMermaid, function scoreIsDeterministic(name, mermaid) {
        const scenario = { name, featureTitle: name, tags: [], stepTexts: [name] };
        const diagram: RelevanceDiagram = {
          id: 'd',
          type: 'mermaid',
          path: 'd.mmd',
          title: mermaid.title,
          content: mermaid.source,
        };
        expect(calculateDiagramRelevance(scenario, diagram)).toBe(
          calculateDiagramRelevance(scenario, diagram)
        );
      })
    );
  });
});

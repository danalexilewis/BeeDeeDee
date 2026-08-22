import type { TestResult } from '@eddy/behavior-contracts';
import { describe, expect, it } from 'vitest';
import {
  aggregateOutcome,
  aggregateScenarioStatus,
  detectFlaky,
  hasResults,
  latestRun,
  mergeResults,
} from './status.js';

function result(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testId: 'tests/login.spec.ts:1',
    testName: 'logs in',
    status: 'pass',
    timestamp: '2026-07-29T10:00:00.000Z',
    file: 'tests/login.spec.ts',
    tags: [],
    ...overrides,
  };
}

describe('aggregateOutcome', () => {
  it('reports not-run with no results', () => {
    expect(aggregateOutcome([])).toBe('not-run');
  });

  it('reports pass when every result passed', () => {
    expect(aggregateOutcome([result(), result({ testId: 't2' })])).toBe('pass');
  });

  it('lets a single failure dominate a set of passes', () => {
    expect(aggregateOutcome([result(), result({ testId: 't2', status: 'fail' })])).toBe('fail');
  });

  it('reports skipped when every result was skipped', () => {
    expect(aggregateOutcome([result({ status: 'skipped' })])).toBe('skipped');
  });

  it('prefers a pass over a skip when both are present', () => {
    expect(aggregateOutcome([result({ status: 'skipped' }), result({ testId: 't2' })])).toBe(
      'pass'
    );
  });

  it('reports not-run when results exist but none ran', () => {
    expect(aggregateOutcome([result({ status: 'not-run' })])).toBe('not-run');
  });

  it('prefers a skip over a not-run, rather than collapsing to not-run', () => {
    // Regression: an earlier implementation required *every* result to be
    // skipped, so this mixed set fell through and reported not-run.
    expect(aggregateOutcome([result({ status: 'skipped' }), result({ status: 'not-run' })])).toBe(
      'skipped'
    );
  });

  it('applies a strict fail over pass over skipped over not-run precedence', () => {
    const all = [
      result({ testId: 'a', status: 'not-run' }),
      result({ testId: 'b', status: 'skipped' }),
      result({ testId: 'c', status: 'pass' }),
      result({ testId: 'd', status: 'fail' }),
    ];
    expect(aggregateOutcome(all)).toBe('fail');
    expect(aggregateOutcome(all.slice(0, 3))).toBe('pass');
    expect(aggregateOutcome(all.slice(0, 2))).toBe('skipped');
    expect(aggregateOutcome(all.slice(0, 1))).toBe('not-run');
  });
});

describe('detectFlaky', () => {
  it('is false for a single consistent test', () => {
    expect(detectFlaky([result(), result()])).toBe(false);
  });

  it('is true when one test both passed and failed', () => {
    expect(detectFlaky([result(), result({ status: 'fail' })])).toBe(true);
  });

  it('is false when different tests disagree', () => {
    expect(detectFlaky([result({ testId: 'a' }), result({ testId: 'b', status: 'fail' })])).toBe(
      false
    );
  });

  it('is false when a test passed and was skipped', () => {
    expect(detectFlaky([result(), result({ status: 'skipped' })])).toBe(false);
  });

  it('detects flakiness across retry attempts', () => {
    expect(
      detectFlaky([result({ attempt: 1, status: 'fail' }), result({ attempt: 2, status: 'pass' })])
    ).toBe(true);
  });
});

describe('latestRun', () => {
  it('is null with no results', () => {
    expect(latestRun([])).toBeNull();
  });

  it('returns the newest timestamp regardless of input order', () => {
    const results = [
      result({ timestamp: '2026-07-29T09:00:00.000Z' }),
      result({ timestamp: '2026-07-29T11:00:00.000Z' }),
      result({ timestamp: '2026-07-29T10:00:00.000Z' }),
    ];
    expect(latestRun(results)).toBe('2026-07-29T11:00:00.000Z');
    expect(latestRun([...results].reverse())).toBe('2026-07-29T11:00:00.000Z');
  });
});

describe('aggregateScenarioStatus', () => {
  it('carries the scenario id through', () => {
    expect(aggregateScenarioStatus('login.happy', []).scenarioId).toBe('login.happy');
  });

  it('orders results oldest first', () => {
    const status = aggregateScenarioStatus('s', [
      result({ testId: 'b', timestamp: '2026-07-29T11:00:00.000Z' }),
      result({ testId: 'a', timestamp: '2026-07-29T09:00:00.000Z' }),
    ]);
    expect(status.results.map(r => r.testId)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const results = [
      result({ testId: 'b', timestamp: '2026-07-29T11:00:00.000Z' }),
      result({ testId: 'a', timestamp: '2026-07-29T09:00:00.000Z' }),
    ];
    aggregateScenarioStatus('s', results);
    expect(results.map(r => r.testId)).toEqual(['b', 'a']);
  });

  it('reports an untested scenario as not-run with a null lastRun', () => {
    const status = aggregateScenarioStatus('s', []);
    expect(status.overall).toBe('not-run');
    expect(status.lastRun).toBeNull();
    expect(status.flaky).toBe(false);
  });
});

describe('hasResults', () => {
  it('is false when nothing has run', () => {
    expect(hasResults(aggregateScenarioStatus('s', []))).toBe(false);
  });

  it('is true even when the only result was skipped, because it still ran', () => {
    expect(hasResults(aggregateScenarioStatus('s', [result({ status: 'skipped' })]))).toBe(true);
  });
});

describe('mergeResults', () => {
  it('keeps results for distinct tests', () => {
    const merged = mergeResults([result({ testId: 'a' })], [result({ testId: 'b' })]);
    expect(merged).toHaveLength(2);
  });

  it('replaces a result for the same test, timestamp, and attempt', () => {
    const merged = mergeResults([result({ status: 'fail' })], [result({ status: 'pass' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.status).toBe('pass');
  });

  it('keeps separate attempts of the same test', () => {
    const merged = mergeResults(
      [result({ attempt: 1, status: 'fail' })],
      [result({ attempt: 2, status: 'pass' })]
    );
    expect(merged).toHaveLength(2);
  });

  it('makes re-ingesting the same report idempotent', () => {
    const incoming = [result({ testId: 'a' }), result({ testId: 'b' })];
    const once = mergeResults([], incoming);
    const twice = mergeResults(once, incoming);
    expect(twice).toEqual(once);
  });
});

import type { TestOutcome, TestResult, TestStatus } from '@eddy/behavior-contracts';

/**
 * Outcomes in descending order of significance. Aggregation reports the most
 * significant outcome present, so a mixed set never collapses to something
 * weaker than what actually happened.
 */
const OUTCOME_PRECEDENCE: readonly TestOutcome[] = ['fail', 'pass', 'skipped', 'not-run'];

/**
 * Rolls a set of test results up into one outcome for a scenario.
 *
 * Failure dominates, because a scenario with any failing test is not passing.
 * Absent any failure a pass wins, then a skip. A scenario with no results, or
 * whose results all went unrun, is `not-run`.
 */
export function aggregateOutcome(results: readonly TestResult[]): TestOutcome {
  if (results.length === 0) return 'not-run';

  const present = new Set(
    results.map(function toStatus(result) {
      return result.status;
    })
  );

  for (const outcome of OUTCOME_PRECEDENCE) {
    if (present.has(outcome)) return outcome;
  }

  return 'not-run';
}

/**
 * Flags a scenario as flaky when the same test produced both a pass and a fail.
 * Retries within one run and disagreement across runs both surface this way.
 */
export function detectFlaky(results: readonly TestResult[]): boolean {
  const outcomesByTest = new Map<string, Set<TestOutcome>>();

  for (const result of results) {
    const outcomes = outcomesByTest.get(result.testId) ?? new Set<TestOutcome>();
    outcomes.add(result.status);
    outcomesByTest.set(result.testId, outcomes);
  }

  for (const outcomes of outcomesByTest.values()) {
    if (outcomes.has('pass') && outcomes.has('fail')) return true;
  }

  return false;
}

/** The most recent timestamp across results, or null when there are none. */
export function latestRun(results: readonly TestResult[]): string | null {
  let latest: string | null = null;

  for (const result of results) {
    if (latest === null || result.timestamp > latest) {
      latest = result.timestamp;
    }
  }

  return latest;
}

/**
 * Builds the aggregated status for one scenario.
 *
 * The result depends only on the set of results, never their order, so ingesting
 * the same reports in a different sequence produces the same status.
 */
export function aggregateScenarioStatus(
  scenarioId: string,
  results: readonly TestResult[]
): TestStatus {
  const ordered = [...results].sort(function byTimestampThenId(left, right) {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp < right.timestamp ? -1 : 1;
    }
    return left.testId.localeCompare(right.testId);
  });

  return {
    scenarioId,
    overall: aggregateOutcome(ordered),
    results: ordered,
    lastRun: latestRun(ordered),
    flaky: detectFlaky(ordered),
  };
}

/** True when a scenario has at least one linked test, regardless of outcome. */
export function isTested(status: TestStatus): boolean {
  return status.results.length > 0;
}

/**
 * Merges newly ingested results into an existing status, replacing prior results
 * for the same test id and run timestamp so repeated ingests are idempotent.
 */
export function mergeResults(
  existing: readonly TestResult[],
  incoming: readonly TestResult[]
): TestResult[] {
  const byKey = new Map<string, TestResult>();

  for (const result of [...existing, ...incoming]) {
    byKey.set(`${result.testId}@${result.timestamp}#${result.attempt ?? 1}`, result);
  }

  return [...byKey.values()];
}

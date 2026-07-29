import type { TestFramework, TestLink } from '@eddy/behavior-contracts';
import { normalizeName, normalizeTag, overlapCoefficient, tokenSet } from './text.js';

/** The matching-relevant slice of a scenario. */
export type MatchableScenario = {
  id: string;
  name: string;
  featureTitle: string;
  tags: readonly string[];
};

/** A test discovered by scanning test files. */
export type MatchableTest = {
  testId: string;
  name: string;
  framework: TestFramework;
  path: string;
  line: number;
  tags: readonly string[];
};

/** A scored scenario-to-test pairing. */
export type TestMatch = {
  scenarioId: string;
  test: MatchableTest;
  confidence: number;
  reason: MatchReason;
};

/** Why a test was matched, ordered from strongest evidence to weakest. */
export type MatchReason = 'explicit-tag' | 'exact-name' | 'name-contains' | 'token-overlap';

/** Tag that pins a test to a scenario id explicitly, e.g. `@scenario:login/happy-path`. */
const EXPLICIT_TAG_PREFIX = 'scenario:';

const CONFIDENCE = {
  explicitTag: 1,
  exactName: 0.9,
  nameContains: 0.7,
  /** Ceiling for the fuzziest signal, kept below nameContains on purpose. */
  tokenOverlapMax: 0.65,
} as const;

/** Reads an explicit scenario id from a test's tags, if present. */
export function explicitScenarioId(test: MatchableTest): string | undefined {
  for (const tag of test.tags) {
    const normalized = normalizeTag(tag);
    if (normalized.startsWith(EXPLICIT_TAG_PREFIX)) {
      const id = normalized.slice(EXPLICIT_TAG_PREFIX.length);
      if (id.length > 0) return id;
    }
  }
  return undefined;
}

/**
 * Scores how likely a test is to exercise a scenario.
 *
 * An explicit `@scenario:<id>` tag wins outright. Otherwise the test name is
 * compared to the scenario name: exact match, then containment, then token
 * overlap. Token overlap is capped below the containment score so a vague word
 * match can never outrank a real one.
 */
export function scoreMatch(
  scenario: MatchableScenario,
  test: MatchableTest
): { confidence: number; reason: MatchReason } {
  if (explicitScenarioId(test) === scenario.id) {
    return { confidence: CONFIDENCE.explicitTag, reason: 'explicit-tag' };
  }

  const scenarioName = normalizeName(scenario.name);
  const testName = normalizeName(test.name);

  if (scenarioName.length > 0 && scenarioName === testName) {
    return { confidence: CONFIDENCE.exactName, reason: 'exact-name' };
  }

  if (
    scenarioName.length > 0 &&
    (testName.includes(scenarioName) || scenarioName.includes(testName))
  ) {
    return { confidence: CONFIDENCE.nameContains, reason: 'name-contains' };
  }

  const scenarioTokens = tokenSet([scenario.name, scenario.featureTitle]);
  const testTokens = tokenSet([test.name, test.path]);
  const overlap = overlapCoefficient(scenarioTokens, testTokens);

  return {
    confidence: overlap * CONFIDENCE.tokenOverlapMax,
    reason: 'token-overlap',
  };
}

/** Converts a match into the link shape the contract exposes. */
export function toTestLink(match: TestMatch): TestLink {
  return {
    testId: match.test.testId,
    framework: match.test.framework,
    path: match.test.path,
    line: match.test.line,
    status: 'not-run',
  };
}

export type MatchOptions = {
  /** Minimum confidence for a pairing to count. */
  threshold?: number;
};

export type MatchResult = {
  /** Links keyed by scenario id, ordered by descending confidence. */
  linksByScenario: Map<string, TestLink[]>;
  /** Scenario id for each matched test, for reverse lookups. */
  scenarioByTestId: Map<string, string>;
  /** Tests that matched no scenario above the threshold. */
  unmatchedTestIds: string[];
};

/**
 * Matches tests to scenarios. Each test is assigned to at most its single best
 * scenario, so one test never inflates coverage across several scenarios.
 */
export function matchTestsToScenarios(
  scenarios: readonly MatchableScenario[],
  tests: readonly MatchableTest[],
  options: MatchOptions = {}
): MatchResult {
  const threshold = options.threshold ?? 0.5;

  const linksByScenario = new Map<string, TestLink[]>();
  const scenarioByTestId = new Map<string, string>();
  const unmatchedTestIds: string[] = [];
  const matchesByScenario = new Map<string, TestMatch[]>();

  for (const test of tests) {
    let best: TestMatch | undefined;

    for (const scenario of scenarios) {
      const { confidence, reason } = scoreMatch(scenario, test);
      if (confidence < threshold) continue;

      const isBetter =
        best === undefined ||
        confidence > best.confidence ||
        (confidence === best.confidence && scenario.id.localeCompare(best.scenarioId) < 0);

      if (isBetter) {
        best = { scenarioId: scenario.id, test, confidence, reason };
      }
    }

    if (best === undefined) {
      unmatchedTestIds.push(test.testId);
      continue;
    }

    scenarioByTestId.set(test.testId, best.scenarioId);
    const existing = matchesByScenario.get(best.scenarioId) ?? [];
    existing.push(best);
    matchesByScenario.set(best.scenarioId, existing);
  }

  for (const [scenarioId, matches] of matchesByScenario) {
    const ordered = matches
      .sort(function byConfidenceThenId(left, right) {
        if (right.confidence !== left.confidence) return right.confidence - left.confidence;
        return left.test.testId.localeCompare(right.test.testId);
      })
      .map(toTestLink);
    linksByScenario.set(scenarioId, ordered);
  }

  return {
    linksByScenario,
    scenarioByTestId,
    unmatchedTestIds: unmatchedTestIds.sort(),
  };
}

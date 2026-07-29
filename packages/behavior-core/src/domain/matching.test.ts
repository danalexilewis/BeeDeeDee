import { describe, expect, it } from 'vitest';
import {
  explicitScenarioId,
  matchTestsToScenarios,
  scoreMatch,
  type MatchableScenario,
  type MatchableTest,
} from './matching.js';

function scenario(overrides: Partial<MatchableScenario> = {}): MatchableScenario {
  return {
    id: 'login.successful-login',
    name: 'Successful login',
    featureTitle: 'User authentication',
    tags: ['@smoke'],
    ...overrides,
  };
}

function test(overrides: Partial<MatchableTest> = {}): MatchableTest {
  return {
    testId: 'tests/e2e/login.spec.ts:12',
    name: 'Successful login',
    framework: 'playwright',
    path: 'tests/e2e/login.spec.ts',
    line: 12,
    tags: [],
    ...overrides,
  };
}

describe('explicitScenarioId', () => {
  it('reads an id from a scenario tag', () => {
    expect(explicitScenarioId(test({ tags: ['@scenario:login.happy'] }))).toBe('login.happy');
  });

  it('ignores unrelated tags', () => {
    expect(explicitScenarioId(test({ tags: ['@smoke'] }))).toBeUndefined();
  });

  it('ignores a scenario tag with no id', () => {
    expect(explicitScenarioId(test({ tags: ['@scenario:'] }))).toBeUndefined();
  });

  it('tolerates a missing @ prefix', () => {
    expect(explicitScenarioId(test({ tags: ['scenario:login.happy'] }))).toBe('login.happy');
  });
});

describe('scoreMatch', () => {
  it('gives full confidence to an explicit tag', () => {
    const match = scoreMatch(
      scenario(),
      test({ name: 'totally different', tags: ['@scenario:login.successful-login'] })
    );
    expect(match).toEqual({ confidence: 1, reason: 'explicit-tag' });
  });

  it('matches an identical name', () => {
    expect(scoreMatch(scenario(), test()).reason).toBe('exact-name');
  });

  it('ignores case and whitespace when comparing names', () => {
    expect(scoreMatch(scenario(), test({ name: '  SUCCESSFUL   LOGIN ' })).reason).toBe(
      'exact-name'
    );
  });

  it('matches a test name that contains the scenario name', () => {
    const match = scoreMatch(scenario(), test({ name: 'Successful login redirects home' }));
    expect(match.reason).toBe('name-contains');
  });

  it('falls back to token overlap for a loose match', () => {
    const match = scoreMatch(scenario(), test({ name: 'login works' }));
    expect(match.reason).toBe('token-overlap');
    expect(match.confidence).toBeGreaterThan(0);
  });

  it('keeps token overlap below a containment match', () => {
    const loose = scoreMatch(scenario(), test({ name: 'login works' }));
    const contains = scoreMatch(scenario(), test({ name: 'Successful login redirects' }));
    expect(loose.confidence).toBeLessThan(contains.confidence);
  });

  it('scores an unrelated test at zero', () => {
    const match = scoreMatch(scenario(), test({ name: 'zzz', path: 'zzz' }));
    expect(match.confidence).toBe(0);
  });
});

describe('matchTestsToScenarios', () => {
  it('links a matching test to its scenario', () => {
    const result = matchTestsToScenarios([scenario()], [test()]);
    expect(result.linksByScenario.get('login.successful-login')).toHaveLength(1);
    expect(result.unmatchedTestIds).toEqual([]);
  });

  it('reports a test that matches nothing', () => {
    const result = matchTestsToScenarios([scenario()], [test({ name: 'zzz', path: 'zzz' })]);
    expect(result.linksByScenario.size).toBe(0);
    expect(result.unmatchedTestIds).toEqual(['tests/e2e/login.spec.ts:12']);
  });

  it('assigns each test to only its best scenario', () => {
    const scenarios = [
      scenario({ id: 'login.a', name: 'Successful login' }),
      scenario({ id: 'login.b', name: 'Successful login attempt from mobile' }),
    ];
    const result = matchTestsToScenarios(scenarios, [test({ name: 'Successful login' })]);

    const totalLinks = [...result.linksByScenario.values()].reduce(function sum(count, links) {
      return count + links.length;
    }, 0);
    expect(totalLinks).toBe(1);
    expect(result.linksByScenario.get('login.a')).toHaveLength(1);
  });

  it('links several tests to one scenario', () => {
    const result = matchTestsToScenarios(
      [scenario()],
      [
        test({ testId: 'a:1', line: 1 }),
        test({ testId: 'b:2', line: 2, name: 'Successful login again' }),
      ]
    );
    expect(result.linksByScenario.get('login.successful-login')).toHaveLength(2);
  });

  it('builds a reverse lookup from test id to scenario', () => {
    const result = matchTestsToScenarios([scenario()], [test()]);
    expect(result.scenarioByTestId.get('tests/e2e/login.spec.ts:12')).toBe(
      'login.successful-login'
    );
  });

  it('respects a raised threshold', () => {
    const result = matchTestsToScenarios([scenario()], [test({ name: 'login works' })], {
      threshold: 0.95,
    });
    expect(result.unmatchedTestIds).toHaveLength(1);
  });

  it('marks new links as not-run until results arrive', () => {
    const result = matchTestsToScenarios([scenario()], [test()]);
    expect(result.linksByScenario.get('login.successful-login')?.[0]?.status).toBe('not-run');
  });

  it('produces the same links regardless of test order', () => {
    const tests = [
      test({ testId: 'a:1', line: 1 }),
      test({ testId: 'b:2', line: 2, name: 'Successful login again' }),
    ];
    const forward = matchTestsToScenarios([scenario()], tests);
    const reverse = matchTestsToScenarios([scenario()], [...tests].reverse());
    expect(reverse.linksByScenario.get('login.successful-login')).toEqual(
      forward.linksByScenario.get('login.successful-login')
    );
  });

  it('handles an empty project', () => {
    const result = matchTestsToScenarios([], []);
    expect(result.linksByScenario.size).toBe(0);
    expect(result.unmatchedTestIds).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseJestStyleReport, toJestStyleOutcome } from './jest-style.js';
import { parseReport } from './index.js';
import { parsePlaywrightReport, toPlaywrightOutcome } from './playwright.js';

const FALLBACK = '2026-07-29T12:00:00.000Z';

describe('toPlaywrightOutcome', () => {
  it.each([
    ['passed', 'pass'],
    ['expected', 'pass'],
    ['failed', 'fail'],
    ['unexpected', 'fail'],
    ['timedOut', 'fail'],
    ['interrupted', 'fail'],
    ['skipped', 'skipped'],
    [undefined, 'not-run'],
    ['something-new', 'not-run'],
  ])('maps %o to %o', (status, expected) => {
    expect(toPlaywrightOutcome(status)).toBe(expected);
  });
});

describe('toJestStyleOutcome', () => {
  it.each([
    ['passed', 'pass'],
    ['failed', 'fail'],
    ['skipped', 'skipped'],
    ['pending', 'skipped'],
    ['todo', 'skipped'],
    [undefined, 'not-run'],
  ])('maps %o to %o', (status, expected) => {
    expect(toJestStyleOutcome(status)).toBe(expected);
  });
});

describe('parsePlaywrightReport', () => {
  it('extracts a result per spec', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            title: 'login.spec.ts',
            file: 'tests/e2e/login.spec.ts',
            specs: [
              {
                title: 'logs in',
                line: 12,
                tests: [{ results: [{ status: 'passed', duration: 120 }] }],
              },
            ],
          },
        ],
      },
      FALLBACK
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      testId: 'tests/e2e/login.spec.ts:12',
      testName: 'login.spec.ts > logs in',
      status: 'pass',
      durationMs: 120,
      line: 12,
    });
  });

  it('flattens nested suites and inherits the file path', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            title: 'outer',
            file: 'tests/e2e/a.spec.ts',
            suites: [
              {
                title: 'inner',
                specs: [{ title: 'works', line: 3, tests: [{ results: [{ status: 'passed' }] }] }],
              },
            ],
          },
        ],
      },
      FALLBACK
    );

    expect(results[0]!.file).toBe('tests/e2e/a.spec.ts');
    expect(results[0]!.testName).toBe('outer > inner > works');
  });

  it('emits one result per retry so flakiness stays visible', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [
              {
                title: 'flaky',
                line: 1,
                tests: [
                  {
                    results: [
                      { status: 'failed', retry: 0 },
                      { status: 'passed', retry: 1 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      FALLBACK
    );

    expect(results).toHaveLength(2);
    expect(results.map(r => r.status)).toEqual(['fail', 'pass']);
    expect(results.map(r => r.attempt)).toEqual([1, 2]);
  });

  it('captures an error message and stack', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [
              {
                title: 'fails',
                line: 1,
                tests: [
                  {
                    results: [{ status: 'failed', error: { message: 'boom', stack: 'at line 1' } }],
                  },
                ],
              },
            ],
          },
        ],
      },
      FALLBACK
    );

    expect(results[0]!.errorMessage).toBe('boom');
    expect(results[0]!.stackTrace).toBe('at line 1');
  });

  it('falls back to the errors array for a message', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [
              {
                title: 'fails',
                line: 1,
                tests: [{ results: [{ status: 'failed', errors: [{ message: 'from array' }] }] }],
              },
            ],
          },
        ],
      },
      FALLBACK
    );
    expect(results[0]!.errorMessage).toBe('from array');
  });

  it('emits a result for a spec with no attempts', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [{ title: 'skipped', line: 1, tests: [{ status: 'skipped' }] }],
          },
        ],
      },
      FALLBACK
    );
    expect(results[0]!.status).toBe('skipped');
    expect(results[0]!.timestamp).toBe(FALLBACK);
  });

  it('returns nothing for an empty report', () => {
    expect(parsePlaywrightReport({}, FALLBACK)).toEqual([]);
    expect(parsePlaywrightReport({ suites: [] }, FALLBACK)).toEqual([]);
  });

  it('carries spec tags through', () => {
    const results = parsePlaywrightReport(
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [
              {
                title: 't',
                line: 1,
                tags: ['@smoke'],
                tests: [{ results: [{ status: 'passed' }] }],
              },
            ],
          },
        ],
      },
      FALLBACK
    );
    expect(results[0]!.tags).toEqual(['@smoke']);
  });
});

describe('parseJestStyleReport', () => {
  it('extracts results with a composed name', () => {
    const results = parseJestStyleReport(
      {
        testResults: [
          {
            name: '/repo/tests/login.test.ts',
            startTime: Date.UTC(2026, 6, 29, 10, 0, 0),
            assertionResults: [
              {
                ancestorTitles: ['Login'],
                title: 'succeeds',
                status: 'passed',
                duration: 12,
                location: { line: 8 },
              },
            ],
          },
        ],
      },
      FALLBACK
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      testName: 'Login > succeeds',
      status: 'pass',
      durationMs: 12,
      line: 8,
      timestamp: '2026-07-29T10:00:00.000Z',
    });
  });

  it('prefers fullName when present', () => {
    const results = parseJestStyleReport(
      {
        testResults: [
          {
            name: 'a.test.ts',
            assertionResults: [{ fullName: 'Login succeeds', status: 'passed' }],
          },
        ],
      },
      FALLBACK
    );
    expect(results[0]!.testName).toBe('Login succeeds');
  });

  it('captures the first failure message', () => {
    const results = parseJestStyleReport(
      {
        testResults: [
          {
            name: 'a.test.ts',
            assertionResults: [
              { fullName: 'fails', status: 'failed', failureMessages: ['first', 'second'] },
            ],
          },
        ],
      },
      FALLBACK
    );
    expect(results[0]!.errorMessage).toBe('first');
  });

  it('falls back to the supplied timestamp when the report has none', () => {
    const results = parseJestStyleReport(
      { testResults: [{ name: 'a.test.ts', assertionResults: [{ fullName: 't' }] }] },
      FALLBACK
    );
    expect(results[0]!.timestamp).toBe(FALLBACK);
  });

  it('tolerates a null duration', () => {
    const results = parseJestStyleReport(
      {
        testResults: [{ name: 'a.test.ts', assertionResults: [{ fullName: 't', duration: null }] }],
      },
      FALLBACK
    );
    expect(results[0]!.durationMs).toBeUndefined();
  });

  it('returns nothing for an empty report', () => {
    expect(parseJestStyleReport({}, FALLBACK)).toEqual([]);
  });
});

describe('parseReport', () => {
  it('dispatches to the Playwright parser', () => {
    const result = parseReport(
      'playwright-json',
      {
        suites: [
          {
            file: 'a.spec.ts',
            specs: [{ title: 't', line: 1, tests: [{ results: [{ status: 'passed' }] }] }],
          },
        ],
      },
      FALLBACK
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toHaveLength(1);
  });

  it.each(['vitest-json', 'jest-json'] as const)(
    'dispatches %o to the Jest-style parser',
    format => {
      const result = parseReport(
        format,
        {
          testResults: [
            { name: 'a.test.ts', assertionResults: [{ fullName: 't', status: 'passed' }] },
          ],
        },
        FALLBACK
      );
      expect(result._unsafeUnwrap()).toHaveLength(1);
    }
  );

  it('reports a schema violation rather than throwing', () => {
    const result = parseReport('playwright-json', { suites: 'not an array' }, FALLBACK);
    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('SchemaValidation');
    if (error.tag === 'SchemaValidation') {
      expect(error.subject).toBe('Playwright report');
      expect(error.issues.length).toBeGreaterThan(0);
      expect(error.issues[0]!.path).toBe('suites');
    }
  });

  it('names the offending format for an unknown one', () => {
    const result = parseReport('junit-xml' as never, {}, FALLBACK);
    expect(result._unsafeUnwrapErr().tag).toBe('UnsupportedReportFormat');
  });

  it('rejects native, which needs no parsing', () => {
    expect(parseReport('native', {}, FALLBACK)._unsafeUnwrapErr().tag).toBe(
      'UnsupportedReportFormat'
    );
  });

  it('tolerates unknown extra keys from a newer reporter version', () => {
    const result = parseReport(
      'playwright-json',
      {
        version: '2.0',
        suites: [
          {
            file: 'a.spec.ts',
            unknownKey: true,
            specs: [{ title: 't', line: 1, tests: [{ results: [{ status: 'passed' }] }] }],
          },
        ],
      },
      FALLBACK
    );
    expect(result.isOk()).toBe(true);
  });
});

import type { IngestRequest, TestResult } from '@eddy/behavior-contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRecordingLogger } from '../adapters/logger.js';
import { createMemoryIndexStore } from '../adapters/memory-index-store.js';
import { createFixedClock } from '../adapters/system-clock.js';
import type { ClockPort } from '../ports/clock.js';
import type { IndexStorePort } from '../ports/index-store.js';
import { createFakeFileSystem, createTestFiles, createTestProject } from '../testing/index.js';
import { indexBehaviorSpecs } from './index-specs.js';
import { ingestTestResults } from './ingest-results.js';
import { getScenario } from './queries.js';

let indexStore: IndexStorePort;
let clock: ClockPort;

const SCENARIO = 'login.successful-login';
const TEST_FILE = 'tests/e2e/login.spec.ts';
const TEST_ID = `${TEST_FILE}:3`;

function nativeResult(overrides: Partial<TestResult> = {}): TestResult {
  return {
    testId: TEST_ID,
    testName: 'Successful login',
    status: 'pass',
    timestamp: '2026-07-29T10:00:00.000Z',
    file: TEST_FILE,
    line: 3,
    tags: [],
    ...overrides,
  };
}

function native(results: TestResult[]): IngestRequest {
  return { format: 'native', results };
}

beforeEach(async () => {
  indexStore = createMemoryIndexStore();
  clock = createFixedClock();
  const index = await indexBehaviorSpecs(
    {
      fileSystem: createFakeFileSystem(createTestFiles()),
      clock,
      logger: createRecordingLogger(),
    },
    { project: createTestProject() }
  );
  indexStore.write(index._unsafeUnwrap());
});

describe('ingestTestResults', () => {
  it('matches a result to its scenario by test id', () => {
    const summary = ingestTestResults(
      { indexStore, clock },
      native([nativeResult()])
    )._unsafeUnwrap();
    expect(summary.ingested).toBe(1);
    expect(summary.matchedScenarios).toBe(1);
    expect(summary.unmatchedTests).toEqual([]);
    expect(summary.scenariosChanged).toEqual([SCENARIO]);
  });

  it('updates the scenario status', () => {
    ingestTestResults({ indexStore, clock }, native([nativeResult()]));
    const scenario = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(scenario.status.overall).toBe('pass');
    expect(scenario.status.lastRun).toBe('2026-07-29T10:00:00.000Z');
  });

  it('updates the status recorded on the test link', () => {
    ingestTestResults({ indexStore, clock }, native([nativeResult({ durationMs: 42 })]));
    const scenario = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(scenario.testLinks[0]!.status).toBe('pass');
    expect(scenario.testLinks[0]!.durationMs).toBe(42);
  });

  it('carries a failure message onto the test link', () => {
    ingestTestResults(
      { indexStore, clock },
      native([nativeResult({ status: 'fail', errorMessage: 'boom' })])
    );
    const scenario = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(scenario.testLinks[0]!.status).toBe('fail');
    expect(scenario.testLinks[0]!.errorMessage).toBe('boom');
  });

  it('reports a result that matches no scenario', () => {
    const summary = ingestTestResults(
      { indexStore, clock },
      native([
        nativeResult({
          testId: 'tests/e2e/other.spec.ts:99',
          file: 'tests/e2e/other.spec.ts',
          line: 99,
        }),
      ])
    )._unsafeUnwrap();

    expect(summary.matchedScenarios).toBe(0);
    expect(summary.unmatchedTests).toEqual(['tests/e2e/other.spec.ts:99']);
  });

  it('falls back to the file path when the line has drifted', () => {
    const summary = ingestTestResults(
      { indexStore, clock },
      native([nativeResult({ testId: `${TEST_FILE}:999`, line: 999 })])
    )._unsafeUnwrap();

    expect(summary.matchedScenarios).toBe(1);
    expect(summary.unmatchedTests).toEqual([]);
  });

  it('is idempotent when the same report is ingested twice', () => {
    const request = native([nativeResult()]);
    ingestTestResults({ indexStore, clock }, request);
    const before = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap().status;

    ingestTestResults({ indexStore, clock }, request);
    const after = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap().status;

    expect(after.results).toHaveLength(before.results.length);
    expect(after).toEqual(before);
  });

  it('reports no change when re-ingesting an identical result', () => {
    const request = native([nativeResult()]);
    ingestTestResults({ indexStore, clock }, request);
    const second = ingestTestResults({ indexStore, clock }, request)._unsafeUnwrap();
    expect(second.scenariosChanged).toEqual([]);
  });

  it('marks a scenario flaky when it both passed and failed', () => {
    ingestTestResults(
      { indexStore, clock },
      native([
        nativeResult({ status: 'fail', timestamp: '2026-07-29T10:00:00.000Z', attempt: 1 }),
        nativeResult({ status: 'pass', timestamp: '2026-07-29T10:01:00.000Z', attempt: 2 }),
      ])
    );

    const scenario = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(scenario.status.flaky).toBe(true);
    expect(scenario.status.overall).toBe('fail');
  });

  it('ingests a Playwright report', () => {
    const summary = ingestTestResults(
      { indexStore, clock },
      {
        format: 'playwright-json',
        report: {
          suites: [
            {
              file: TEST_FILE,
              specs: [
                {
                  title: 'Successful login',
                  line: 3,
                  tests: [{ results: [{ status: 'passed', duration: 10 }] }],
                },
              ],
            },
          ],
        },
      }
    )._unsafeUnwrap();

    expect(summary.matchedScenarios).toBe(1);
    expect(getScenario({ indexStore }, SCENARIO)._unsafeUnwrap().status.overall).toBe('pass');
  });

  it('reports a malformed report rather than throwing', () => {
    const result = ingestTestResults(
      { indexStore, clock },
      { format: 'playwright-json', report: { suites: 'nope' } }
    );
    expect(result._unsafeUnwrapErr().tag).toBe('SchemaValidation');
  });

  it('reports IndexNotReady when no index exists yet', () => {
    const result = ingestTestResults(
      { indexStore: createMemoryIndexStore(), clock },
      native([nativeResult()])
    );
    expect(result._unsafeUnwrapErr().tag).toBe('IndexNotReady');
  });

  it('produces the same status regardless of ingestion order', () => {
    const first = nativeResult({
      status: 'pass',
      timestamp: '2026-07-29T10:00:00.000Z',
      attempt: 1,
    });
    const second = nativeResult({
      status: 'fail',
      timestamp: '2026-07-29T11:00:00.000Z',
      attempt: 2,
    });

    ingestTestResults({ indexStore, clock }, native([first, second]));
    const forward = getScenario({ indexStore }, SCENARIO)._unsafeUnwrap().status;

    // Rebuild and ingest in the opposite order.
    const reverseStore = createMemoryIndexStore();
    return indexBehaviorSpecs(
      {
        fileSystem: createFakeFileSystem(createTestFiles()),
        clock,
        logger: createRecordingLogger(),
      },
      { project: createTestProject() }
    ).map(index => {
      reverseStore.write(index);
      ingestTestResults({ indexStore: reverseStore, clock }, native([second, first]));
      const reverse = getScenario({ indexStore: reverseStore }, SCENARIO)._unsafeUnwrap().status;
      expect(reverse).toEqual(forward);
    });
  });
});

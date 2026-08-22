import type { TestOutcome, TestResult } from '@eddy/behavior-contracts';
import fc from 'fast-check';
import { arbIsoDateTime, arbLine, arbPath, arbPhrase, arbTag, arbWord } from './primitives.js';

/** Any test outcome. */
export const arbTestOutcome: fc.Arbitrary<TestOutcome> = fc.constantFrom<TestOutcome>(
  'pass',
  'fail',
  'skipped',
  'not-run'
);

/** Outcomes that represent an executed test. */
export const arbRanOutcome: fc.Arbitrary<TestOutcome> = fc.constantFrom<TestOutcome>(
  'pass',
  'fail',
  'skipped'
);

/** A single normalised test result. */
export const arbTestResult: fc.Arbitrary<TestResult> = fc.record({
  testId: arbWord.map(function toId(word) {
    return `tests/${word}.spec.ts:1`;
  }),
  testName: arbPhrase,
  status: arbTestOutcome,
  timestamp: arbIsoDateTime,
  file: arbPath('.spec.ts'),
  line: arbLine,
  tags: fc.array(arbTag, { maxLength: 3 }),
});

/** A list of results, possibly empty, as a scenario would accumulate. */
export const arbTestResults: fc.Arbitrary<TestResult[]> = fc.array(arbTestResult, {
  maxLength: 8,
});

/** A non-empty list of results. */
export const arbNonEmptyTestResults: fc.Arbitrary<TestResult[]> = fc.array(arbTestResult, {
  minLength: 1,
  maxLength: 8,
});

/**
 * Results that all belong to one test id, which is the shape flaky detection
 * cares about.
 */
export const arbResultsForOneTest: fc.Arbitrary<TestResult[]> = fc
  .tuple(arbWord, fc.array(fc.tuple(arbRanOutcome, arbIsoDateTime), { minLength: 1, maxLength: 6 }))
  .map(function toResults([word, runs]) {
    return runs.map(function toResult([status, timestamp], index): TestResult {
      return {
        testId: `tests/${word}.spec.ts:1`,
        testName: word,
        status,
        timestamp,
        file: `tests/${word}.spec.ts`,
        line: 1,
        tags: [],
        attempt: index + 1,
      };
    });
  });

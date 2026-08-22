import type { TestOutcome, TestResult } from '@eddy/behavior-contracts';
import { z } from 'zod';
import { testIdFrom } from '../../domain/ids.js';

/**
 * The slice of a Playwright JSON report the workbench reads.
 *
 * Deliberately permissive: unknown keys pass through and optional fields absorb
 * version differences, so a Playwright upgrade does not break ingestion.
 */
const playwrightResultSchema = z.object({
  status: z.string().optional(),
  duration: z.number().optional(),
  startTime: z.string().optional(),
  retry: z.number().optional(),
  error: z.object({ message: z.string().optional(), stack: z.string().optional() }).optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

const playwrightTestSchema = z.object({
  results: z.array(playwrightResultSchema).optional(),
  status: z.string().optional(),
});

const playwrightSpecSchema = z.object({
  title: z.string().optional(),
  file: z.string().optional(),
  line: z.number().optional(),
  ok: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  tests: z.array(playwrightTestSchema).optional(),
});

type PlaywrightSuite = {
  title?: string;
  file?: string;
  specs?: Array<z.infer<typeof playwrightSpecSchema>>;
  suites?: PlaywrightSuite[];
};

const playwrightSuiteSchema: z.ZodType<PlaywrightSuite> = z.lazy(function suite() {
  return z.object({
    title: z.string().optional(),
    file: z.string().optional(),
    specs: z.array(playwrightSpecSchema).optional(),
    suites: z.array(playwrightSuiteSchema).optional(),
  });
});

export const playwrightReportSchema = z.object({
  suites: z.array(playwrightSuiteSchema).optional(),
  stats: z.object({ startTime: z.string().optional() }).optional(),
});

export type PlaywrightReport = z.infer<typeof playwrightReportSchema>;

/** Maps a Playwright status string onto a workbench outcome. */
export function toPlaywrightOutcome(status: string | undefined): TestOutcome {
  switch (status) {
    case 'passed':
    case 'expected':
      return 'pass';
    case 'failed':
    case 'unexpected':
    case 'timedOut':
    case 'interrupted':
      return 'fail';
    case 'skipped':
      return 'skipped';
    default:
      return 'not-run';
  }
}

/** Flattens nested suites into their specs, carrying the file path down. */
function flattenSpecs(
  suites: readonly PlaywrightSuite[],
  inheritedFile: string | undefined,
  titlePath: readonly string[]
): Array<{ spec: z.infer<typeof playwrightSpecSchema>; file: string; titlePath: string[] }> {
  const collected: Array<{
    spec: z.infer<typeof playwrightSpecSchema>;
    file: string;
    titlePath: string[];
  }> = [];

  for (const suite of suites) {
    const file = suite.file ?? inheritedFile;
    const path = suite.title === undefined ? [...titlePath] : [...titlePath, suite.title];

    for (const spec of suite.specs ?? []) {
      collected.push({ spec, file: spec.file ?? file ?? 'unknown', titlePath: path });
    }

    if (suite.suites !== undefined) {
      collected.push(...flattenSpecs(suite.suites, file, path));
    }
  }

  return collected;
}

/**
 * Converts a Playwright JSON report into normalised results.
 *
 * One result is emitted per attempt, so retries remain visible and flaky
 * detection can see a test that failed then passed.
 */
export function parsePlaywrightReport(
  report: PlaywrightReport,
  fallbackTimestamp: string
): TestResult[] {
  const specs = flattenSpecs(report.suites ?? [], undefined, []);
  const results: TestResult[] = [];

  for (const { spec, file, titlePath } of specs) {
    const title = spec.title ?? '';
    const fullName = [...titlePath, title].filter(function isPresent(part) {
      return part.length > 0;
    });
    const line = spec.line ?? 1;

    for (const test of spec.tests ?? []) {
      const attempts = test.results ?? [];

      if (attempts.length === 0) {
        results.push({
          testId: testIdFrom(file, line),
          testName: fullName.join(' > '),
          status: toPlaywrightOutcome(test.status),
          timestamp: fallbackTimestamp,
          file,
          line,
          tags: spec.tags ?? [],
        });
        continue;
      }

      attempts.forEach(function toResult(attempt, index) {
        const message = attempt.error?.message ?? attempt.errors?.[0]?.message;
        results.push({
          testId: testIdFrom(file, line),
          testName: fullName.join(' > '),
          status: toPlaywrightOutcome(attempt.status),
          durationMs: attempt.duration,
          errorMessage: message,
          stackTrace: attempt.error?.stack,
          timestamp: attempt.startTime ?? report.stats?.startTime ?? fallbackTimestamp,
          file,
          line,
          tags: spec.tags ?? [],
          attempt: (attempt.retry ?? index) + 1,
        });
      });
    }
  }

  return results;
}

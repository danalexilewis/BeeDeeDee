import type { TestOutcome, TestResult } from '@eddy/behavior-contracts';
import { z } from 'zod';
import { testIdFrom } from '../../domain/ids.js';

/**
 * Vitest's JSON reporter emits the Jest report shape, so one parser serves both.
 * Permissive by design, for the same reason as the Playwright parser.
 */
const assertionSchema = z.object({
  fullName: z.string().optional(),
  title: z.string().optional(),
  ancestorTitles: z.array(z.string()).optional(),
  status: z.string().optional(),
  duration: z.number().nullable().optional(),
  failureMessages: z.array(z.string()).optional(),
  location: z.object({ line: z.number().optional() }).nullable().optional(),
});

const fileResultSchema = z.object({
  name: z.string().optional(),
  status: z.string().optional(),
  startTime: z.number().optional(),
  assertionResults: z.array(assertionSchema).optional(),
});

export const jestStyleReportSchema = z.object({
  startTime: z.number().optional(),
  testResults: z.array(fileResultSchema).optional(),
});

export type JestStyleReport = z.infer<typeof jestStyleReportSchema>;

/** Maps a Jest or Vitest status string onto a workbench outcome. */
export function toJestStyleOutcome(status: string | undefined): TestOutcome {
  switch (status) {
    case 'passed':
      return 'pass';
    case 'failed':
      return 'fail';
    case 'skipped':
    case 'pending':
    case 'todo':
    case 'disabled':
      return 'skipped';
    default:
      return 'not-run';
  }
}

/** Milliseconds since epoch to an ISO timestamp, falling back when absent. */
function toIso(millis: number | undefined, fallback: string): string {
  if (millis === undefined || !Number.isFinite(millis)) return fallback;
  return new Date(millis).toISOString();
}

/** Converts a Jest or Vitest JSON report into normalised results. */
export function parseJestStyleReport(
  report: JestStyleReport,
  fallbackTimestamp: string
): TestResult[] {
  const results: TestResult[] = [];

  for (const fileResult of report.testResults ?? []) {
    const file = fileResult.name ?? 'unknown';
    const timestamp = toIso(fileResult.startTime ?? report.startTime, fallbackTimestamp);

    for (const assertion of fileResult.assertionResults ?? []) {
      const line = assertion.location?.line ?? 1;
      const name =
        assertion.fullName ??
        [...(assertion.ancestorTitles ?? []), assertion.title ?? '']
          .filter(function isPresent(part) {
            return part.length > 0;
          })
          .join(' > ');

      results.push({
        testId: testIdFrom(file, line),
        testName: name,
        status: toJestStyleOutcome(assertion.status),
        durationMs: assertion.duration ?? undefined,
        errorMessage: assertion.failureMessages?.[0],
        timestamp,
        file,
        line,
        tags: [],
      });
    }
  }

  return results;
}

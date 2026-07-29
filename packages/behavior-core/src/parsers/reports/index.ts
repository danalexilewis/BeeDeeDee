import type { ReportFormat, TestResult } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { schemaValidation, unsupportedReportFormat, type BehaviorError } from '../../errors.js';
import { jestStyleReportSchema, parseJestStyleReport } from './jest-style.js';
import { parsePlaywrightReport, playwrightReportSchema } from './playwright.js';

export * from './jest-style.js';
export * from './playwright.js';

/** Flattens Zod issues into the transport-friendly shape errors carry. */
function toIssues(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.map(function toIssue(issue) {
    return { path: issue.path.map(String).join('.'), message: issue.message };
  });
}

/**
 * Parses a raw test report of the named format into normalised results.
 *
 * `fallbackTimestamp` supplies a run time for reporters that omit one, so every
 * result carries a usable timestamp and status aggregation can order by it.
 */
export function parseReport(
  format: ReportFormat,
  report: unknown,
  fallbackTimestamp: string
): Result<TestResult[], BehaviorError> {
  switch (format) {
    case 'playwright-json': {
      const parsed = playwrightReportSchema.safeParse(report);
      if (!parsed.success) {
        return err(schemaValidation('Playwright report', toIssues(parsed.error)));
      }
      return ok(parsePlaywrightReport(parsed.data, fallbackTimestamp));
    }

    case 'vitest-json':
    case 'jest-json': {
      const parsed = jestStyleReportSchema.safeParse(report);
      if (!parsed.success) {
        const subject = format === 'vitest-json' ? 'Vitest report' : 'Jest report';
        return err(schemaValidation(subject, toIssues(parsed.error)));
      }
      return ok(parseJestStyleReport(parsed.data, fallbackTimestamp));
    }

    case 'native':
      return err(unsupportedReportFormat('native reports are already normalised'));

    default:
      return err(unsupportedReportFormat(String(format)));
  }
}

import { z } from 'zod';
import {
  featureStatusSchema,
  isoDateTimeSchema,
  lineNumberSchema,
  percentageSchema,
  testFrameworkSchema,
  testOutcomeSchema,
} from './common.js';

/** Pointer from a scenario to a test that exercises it. */
export const testLinkSchema = z.object({
  testId: z.string(),
  framework: testFrameworkSchema,
  path: z.string(),
  line: lineNumberSchema,
  status: testOutcomeSchema,
  durationMs: z.number().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

/** A single test execution result, as ingested from a report. */
export const testResultSchema = z.object({
  testId: z.string(),
  testName: z.string(),
  status: testOutcomeSchema,
  durationMs: z.number().nonnegative().optional(),
  errorMessage: z.string().optional(),
  stackTrace: z.string().optional(),
  timestamp: isoDateTimeSchema,
  file: z.string(),
  line: lineNumberSchema.optional(),
  tags: z.array(z.string()).default([]),
  attempt: z.number().int().positive().optional(),
});

/** Aggregated status for one scenario across all of its linked tests. */
export const testStatusSchema = z.object({
  scenarioId: z.string(),
  overall: testOutcomeSchema,
  results: z.array(testResultSchema),
  lastRun: isoDateTimeSchema.nullable(),
  flaky: z.boolean(),
});

/** Coverage roll-up for a single feature. */
export const featureCoverageSchema = z.object({
  featureId: z.string(),
  featureTitle: z.string(),
  totalScenarios: z.number().int().nonnegative(),
  testedScenarios: z.number().int().nonnegative(),
  coverage: percentageSchema,
  status: featureStatusSchema,
});

/** Project-wide coverage metrics. */
export const coverageMetricsSchema = z.object({
  scenarioCoverage: percentageSchema,
  featureCoverage: percentageSchema,
  totalScenarios: z.number().int().nonnegative(),
  testedScenarios: z.number().int().nonnegative(),
  untestedScenarios: z.number().int().nonnegative(),
  featureMetrics: z.record(z.string(), featureCoverageSchema),
});

export type TestLink = z.infer<typeof testLinkSchema>;
export type TestResult = z.infer<typeof testResultSchema>;
export type TestStatus = z.infer<typeof testStatusSchema>;
export type FeatureCoverage = z.infer<typeof featureCoverageSchema>;
export type CoverageMetrics = z.infer<typeof coverageMetricsSchema>;

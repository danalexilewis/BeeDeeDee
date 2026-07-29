import { z } from 'zod';
import { editorTypeSchema } from './common.js';
import { testResultSchema } from './test.js';

/** Report formats the ingest route understands. */
export const reportFormatSchema = z.enum(['playwright-json', 'vitest-json', 'jest-json', 'native']);

/**
 * Test results to ingest. Either already-normalised results, or a raw report
 * that the server parses with the named adapter.
 */
export const ingestRequestSchema = z.union([
  z.object({
    format: z.literal('native'),
    results: z.array(testResultSchema).min(1),
  }),
  z.object({
    format: z.enum(['playwright-json', 'vitest-json', 'jest-json']),
    /** Raw report JSON, passed through to the matching adapter. */
    report: z.unknown(),
  }),
]);

/** What the server did with an ingest request. */
export const ingestSummarySchema = z.object({
  ingested: z.number().int().nonnegative(),
  matchedScenarios: z.number().int().nonnegative(),
  unmatchedTests: z.array(z.string()),
  scenariosChanged: z.array(z.string()),
});

/** Force a re-index, optionally limited to specific paths. */
export const refreshRequestSchema = z.object({
  paths: z.array(z.string()).optional(),
  /** Discard cached parses even when file mtimes are unchanged. */
  force: z.boolean().default(false),
});

/** Lint either the indexed spec tree or an explicit set of paths. */
export const lintRequestSchema = z.object({
  paths: z.array(z.string()).optional(),
});

/** Gherkin source to validate against project conventions. */
export const validateGherkinRequestSchema = z.object({
  gherkin: z.string().min(1),
});

/** Which artifact to build editor deep links for. */
export const editorLinkQuerySchema = z.object({
  target: z.enum(['scenario', 'feature', 'test']),
  id: z.string().min(1),
  editor: editorTypeSchema.optional(),
});

export type ReportFormat = z.infer<typeof reportFormatSchema>;
export type IngestRequest = z.infer<typeof ingestRequestSchema>;
export type IngestSummary = z.infer<typeof ingestSummarySchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type LintRequest = z.infer<typeof lintRequestSchema>;
export type ValidateGherkinRequest = z.infer<typeof validateGherkinRequestSchema>;
export type EditorLinkQuery = z.infer<typeof editorLinkQuerySchema>;

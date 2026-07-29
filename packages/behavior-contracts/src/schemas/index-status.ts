import { z } from 'zod';
import { isoDateTimeSchema } from './common.js';
import { errorSchema } from './error.js';

/** Lifecycle of the in-memory behavior index. */
export const indexStateSchema = z.enum(['idle', 'indexing', 'ready', 'failed']);

/** A file that could not be parsed, surfaced without aborting the whole index. */
export const indexProblemSchema = z.object({
  path: z.string(),
  error: errorSchema,
});

/** Health and shape of the current index. */
export const indexStatusSchema = z.object({
  state: indexStateSchema,
  featureCount: z.number().int().nonnegative(),
  scenarioCount: z.number().int().nonnegative(),
  diagramCount: z.number().int().nonnegative(),
  testFileCount: z.number().int().nonnegative(),
  lastIndexedAt: isoDateTimeSchema.nullable(),
  durationMs: z.number().nonnegative().nullable(),
  /** Files that failed to parse. Requirement 1.5: report and keep going. */
  problems: z.array(indexProblemSchema),
});

export type IndexState = z.infer<typeof indexStateSchema>;
export type IndexProblem = z.infer<typeof indexProblemSchema>;
export type IndexStatus = z.infer<typeof indexStatusSchema>;

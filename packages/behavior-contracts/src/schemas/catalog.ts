import { z } from 'zod';
import { featureStatusSchema, percentageSchema } from './common.js';
import { featureSummarySchema } from './feature.js';

/** Dashboard payload: every feature plus project-level roll-ups. */
export const catalogDataSchema = z.object({
  features: z.array(featureSummarySchema),
  totalScenarios: z.number().int().nonnegative(),
  overallCoverage: percentageSchema,
  statusCounts: z.object({
    passing: z.number().int().nonnegative(),
    failing: z.number().int().nonnegative(),
    untested: z.number().int().nonnegative(),
  }),
  tags: z.array(z.string()),
});

/**
 * Catalog filter state. Also drives the URL search params in the SPA, so every
 * field is optional and coercible from a query string.
 */
export const featureFilterSchema = z.object({
  status: featureStatusSchema.optional(),
  search: z.string().optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform(function toArray(value) {
      if (value === undefined) return undefined;
      return Array.isArray(value) ? value : [value];
    }),
  minCoverage: z.coerce.number().min(0).max(100).optional(),
  maxCoverage: z.coerce.number().min(0).max(100).optional(),
});

export type CatalogData = z.infer<typeof catalogDataSchema>;
export type FeatureFilter = z.infer<typeof featureFilterSchema>;

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
 *
 * `tags` is a single comma-separated string rather than a repeated or bracketed
 * parameter. Array query encodings differ between clients — ts-rest emits
 * `tags[]=a` while Fastify's parser expects `tags=a&tags=a` — and a mismatch
 * silently drops the filter instead of failing. One string form works
 * identically from the typed client, a hand-written fetch, and curl.
 */
export const featureFilterSchema = z.object({
  status: featureStatusSchema.optional(),
  search: z.string().optional(),
  tags: z
    .string()
    .optional()
    .transform(function toTagList(value) {
      if (value === undefined) return undefined;

      const tags = value
        .split(',')
        .map(function trim(tag) {
          return tag.trim();
        })
        .filter(function isNotEmpty(tag) {
          return tag.length > 0;
        });

      return tags.length === 0 ? undefined : tags;
    }),
  minCoverage: z.coerce.number().min(0).max(100).optional(),
  maxCoverage: z.coerce.number().min(0).max(100).optional(),
});

export type CatalogData = z.infer<typeof catalogDataSchema>;
export type FeatureFilter = z.infer<typeof featureFilterSchema>;

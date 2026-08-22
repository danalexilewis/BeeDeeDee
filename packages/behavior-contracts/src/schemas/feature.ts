import { z } from 'zod';
import {
  featureStatusSchema,
  isoDateTimeSchema,
  lineNumberSchema,
  percentageSchema,
} from './common.js';
import { diagramLinkSchema } from './diagram.js';
import { gherkinBackgroundSchema } from './gherkin.js';
import { scenarioSummarySchema } from './scenario.js';

/**
 * A Gherkin Rule block. Scenarios are referenced by id rather than nested, which
 * keeps the schema non-recursive and preserves ts-rest type inference.
 */
export const gherkinRuleSchema = z.object({
  keyword: z.string(),
  name: z.string(),
  description: z.string(),
  scenarioIds: z.array(z.string()),
  line: lineNumberSchema,
});

/** A feature as shown in the catalog. */
export const featureSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  path: z.string(),
  tags: z.array(z.string()),
  scenarioCount: z.number().int().nonnegative(),
  testCoverage: percentageSchema,
  status: featureStatusSchema,
  lastUpdated: isoDateTimeSchema,
});

/** A feature with its scenarios and linked artifacts. */
export const featureDetailSchema = featureSummarySchema.extend({
  scenarios: z.array(scenarioSummarySchema),
  diagramLinks: z.array(diagramLinkSchema),
  background: gherkinBackgroundSchema.optional(),
  rules: z.array(gherkinRuleSchema).default([]),
  gherkinSource: z.string(),
});

export type GherkinRule = z.infer<typeof gherkinRuleSchema>;
export type FeatureSummary = z.infer<typeof featureSummarySchema>;
export type FeatureDetail = z.infer<typeof featureDetailSchema>;

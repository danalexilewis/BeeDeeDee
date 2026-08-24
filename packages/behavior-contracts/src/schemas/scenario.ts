import { z } from 'zod';
import { isoDateTimeSchema, lineNumberSchema } from './common.js';
import { diagramLinkSchema } from './diagram.js';
import { gherkinStepSchema } from './gherkin.js';
import { testLinkSchema, testStatusSchema } from './test.js';

/** An Activates unlock edge between scenarios. */
export const activatesLinkSchema = z.object({
  fromScenarioId: z.string(),
  fromScenarioName: z.string(),
  text: z.string(),
  line: lineNumberSchema,
  toScenarioId: z.string().optional(),
  toScenarioName: z.string().optional(),
  toFeatureId: z.string().optional(),
  resolved: z.boolean(),
});

/** A scenario as listed within a feature. */
export const scenarioSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(gherkinStepSchema),
  tags: z.array(z.string()),
  testLinks: z.array(testLinkSchema),
  diagramLinks: z.array(diagramLinkSchema),
  status: testStatusSchema,
  line: lineNumberSchema,
  activates: z.array(activatesLinkSchema).default([]),
});

/** A scenario with its full source context, as returned by the scenario route. */
export const scenarioDetailSchema = scenarioSummarySchema.extend({
  featureId: z.string(),
  featureTitle: z.string(),
  featurePath: z.string(),
  gherkinSource: z.string(),
  lastUpdated: isoDateTimeSchema,
});

export type ActivatesLink = z.infer<typeof activatesLinkSchema>;
export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>;
export type ScenarioDetail = z.infer<typeof scenarioDetailSchema>;

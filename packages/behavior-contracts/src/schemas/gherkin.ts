import { z } from 'zod';
import { lineNumberSchema } from './common.js';

/** Tabular step argument (a Gherkin data table). */
export const gherkinTableSchema = z.object({
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  line: lineNumberSchema,
});

/** Doc string or data table attached to a step. */
export const gherkinArgumentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('doc_string'),
    content: z.string(),
    line: lineNumberSchema,
  }),
  z.object({
    type: z.literal('table'),
    content: gherkinTableSchema,
    line: lineNumberSchema,
  }),
]);

/** A single Given/When/Then step. */
export const gherkinStepSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  text: z.string(),
  argument: gherkinArgumentSchema.optional(),
  line: lineNumberSchema,
});

/** Background block shared by every scenario in a feature. */
export const gherkinBackgroundSchema = z.object({
  keyword: z.string(),
  name: z.string(),
  description: z.string(),
  steps: z.array(gherkinStepSchema),
  line: lineNumberSchema,
});

export type GherkinTable = z.infer<typeof gherkinTableSchema>;
export type GherkinArgument = z.infer<typeof gherkinArgumentSchema>;
export type GherkinStep = z.infer<typeof gherkinStepSchema>;
export type GherkinBackground = z.infer<typeof gherkinBackgroundSchema>;

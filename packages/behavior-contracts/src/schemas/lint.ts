import { z } from 'zod';
import { lineNumberSchema } from './common.js';
import { severitySchema } from './validation.js';

/** Identifiers of the built-in Gherkin lint rules. */
export const lintRuleSchema = z.enum([
  'missing-feature-description',
  'missing-scenario-name',
  'duplicate-scenario-name',
  'inconsistent-step-keyword',
  'step-without-given',
  'too-many-steps',
  'untagged-feature',
  'empty-scenario',
  'unresolved-activates',
]);

/** A single lint finding. */
export const lintResultSchema = z.object({
  path: z.string(),
  rule: lintRuleSchema,
  severity: severitySchema,
  message: z.string(),
  line: lineNumberSchema.optional(),
  column: z.number().int().positive().optional(),
  suggestedFix: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
});

export type LintRule = z.infer<typeof lintRuleSchema>;
export type LintResult = z.infer<typeof lintResultSchema>;

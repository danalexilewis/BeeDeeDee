import { z } from 'zod';
import { lineNumberSchema, percentageSchema } from './common.js';

/** Severity shared by lint results and validation warnings. */
export const severitySchema = z.enum(['error', 'warning', 'info']);

/** A position within a source file. */
export const sourceLocationSchema = z.object({
  path: z.string().optional(),
  line: lineNumberSchema.optional(),
  column: z.number().int().positive().optional(),
});

/** A problem found while validating agent-authored Gherkin. */
export const validationWarningSchema = z.object({
  message: z.string(),
  severity: severitySchema,
  location: sourceLocationSchema.optional(),
});

/** A proposed change that would improve the validated Gherkin. */
export const validationSuggestionSchema = z.object({
  message: z.string(),
  type: z.enum(['fix', 'improve', 'refactor']),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Outcome of validating Gherkin against project conventions. */
export const validationResultSchema = z.object({
  valid: z.boolean(),
  warnings: z.array(validationWarningSchema),
  suggestions: z.array(validationSuggestionSchema),
  /** How well the input matches existing project conventions, 0-100. */
  compatibility: percentageSchema,
});

export type Severity = z.infer<typeof severitySchema>;
export type SourceLocation = z.infer<typeof sourceLocationSchema>;
export type ValidationWarning = z.infer<typeof validationWarningSchema>;
export type ValidationSuggestion = z.infer<typeof validationSuggestionSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;

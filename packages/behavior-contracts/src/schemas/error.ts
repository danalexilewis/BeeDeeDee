import { z } from 'zod';

/**
 * Every failure mode in the system. `BehaviorError` in @eddy/behavior-core is a
 * tagged union over exactly these tags, so adding a failure mode here is what
 * forces the core union, the HTTP mapping, and the UI to account for it.
 */
export const behaviorErrorTagSchema = z.enum([
  'FileNotFound',
  'ReadFailed',
  'GherkinSyntax',
  'MermaidSyntax',
  'SchemaValidation',
  'ScenarioNotFound',
  'FeatureNotFound',
  'DiagramNotFound',
  'EditorNotSupported',
  'PathEscapesProject',
  'UnsupportedReportFormat',
  'IndexNotReady',
]);

/** Wire representation of a domain error. */
export const errorSchema = z.object({
  tag: behaviorErrorTagSchema,
  message: z.string(),
  /** Tag-specific context, e.g. the offending path or line number. */
  details: z.record(z.string(), z.unknown()).optional(),
});

export type BehaviorErrorTag = z.infer<typeof behaviorErrorTagSchema>;
export type ErrorBody = z.infer<typeof errorSchema>;

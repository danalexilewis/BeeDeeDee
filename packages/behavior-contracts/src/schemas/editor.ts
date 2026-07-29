import { z } from 'zod';
import { editorTypeSchema, lineNumberSchema } from './common.js';

/** Editor preferences resolved from project configuration. */
export const editorConfigSchema = z.object({
  supportedEditors: z.array(editorTypeSchema).min(1),
  openCommand: z.string().default('code'),
});

/** A ready-to-open deep link into a spec or test file. */
export const editorLinkSchema = z.object({
  editor: editorTypeSchema,
  url: z.string(),
  label: z.string(),
  path: z.string(),
  line: lineNumberSchema,
  /** False when the target file is missing, so the UI can disable the link. */
  targetExists: z.boolean(),
});

export type EditorConfig = z.infer<typeof editorConfigSchema>;
export type EditorLink = z.infer<typeof editorLinkSchema>;

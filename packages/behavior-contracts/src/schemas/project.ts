import { z } from 'zod';
import { editorConfigSchema } from './editor.js';

/** Directories the indexer scans for specs. */
export const specPathsSchema = z.object({
  features: z.string().default('specs/features'),
  diagrams: z.string().default('specs/diagrams'),
  /** Architecture map JSON files (`*.architecture.json`). */
  mappings: z.string().default('specs/mappings'),
});

/** Directories the indexer scans for tests. */
export const testPathsSchema = z.object({
  e2e: z.string().default('tests/e2e'),
  components: z.string().default('tests/components'),
  unit: z.string().optional(),
});

/** Resolved project configuration. This is also the shape of `.behaviorrc`. */
export const projectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  specPaths: specPathsSchema,
  testPaths: testPathsSchema,
  editorConfig: editorConfigSchema,
});

export type SpecPaths = z.infer<typeof specPathsSchema>;
export type TestPaths = z.infer<typeof testPathsSchema>;
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

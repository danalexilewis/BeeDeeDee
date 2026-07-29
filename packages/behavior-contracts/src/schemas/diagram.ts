import { z } from 'zod';
import {
  complexitySchema,
  diagramTypeSchema,
  lineNumberSchema,
  relevanceSchema,
  relevanceScoreSchema,
} from './common.js';

/** Pointer from a scenario or feature to a diagram, with a relevance score. */
export const diagramLinkSchema = z.object({
  diagramId: z.string(),
  type: diagramTypeSchema,
  path: z.string(),
  title: z.string(),
  relevance: relevanceSchema,
  relevanceScore: relevanceScoreSchema,
});

/** Structural facts derived from diagram source. */
export const diagramMetadataSchema = z.object({
  lineCount: z.number().int().nonnegative(),
  wordCount: z.number().int().nonnegative(),
  nodeCount: z.number().int().nonnegative(),
  complexity: complexitySchema,
});

/** A parsed diagram with its source text and metadata. */
export const parsedDiagramSchema = z.object({
  id: z.string(),
  type: diagramTypeSchema,
  path: z.string(),
  title: z.string(),
  content: z.string(),
  metadata: diagramMetadataSchema,
  lineNumbers: z.object({
    start: lineNumberSchema,
    end: lineNumberSchema,
  }),
});

/** A diagram plus the link that surfaced it, as returned by the diagram route. */
export const diagramContentSchema = parsedDiagramSchema.extend({
  link: diagramLinkSchema,
});

export type DiagramLink = z.infer<typeof diagramLinkSchema>;
export type DiagramMetadata = z.infer<typeof diagramMetadataSchema>;
export type ParsedDiagram = z.infer<typeof parsedDiagramSchema>;
export type DiagramContent = z.infer<typeof diagramContentSchema>;

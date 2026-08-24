import { z } from 'zod';

/** ISO 8601 timestamp. The wire format carries strings, never Date instances. */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Outcome of a single test execution. */
export const testOutcomeSchema = z.enum(['pass', 'fail', 'skipped', 'not-run']);

/** Rolled-up status of a feature across all of its scenarios. */
export const featureStatusSchema = z.enum(['passing', 'failing', 'untested']);

/** How strongly a diagram relates to a scenario. */
export const relevanceSchema = z.enum(['high', 'medium', 'low']);

/** Editors that support deep linking into spec and test files. */
export const editorTypeSchema = z.enum(['vscode', 'cursor', 'intellij']);

/** Test frameworks whose files and reports can be indexed. */
export const testFrameworkSchema = z.enum(['playwright', 'jest', 'vitest', 'custom']);

/** Diagram formats the indexer recognises. */
export const diagramTypeSchema = z.enum(['mermaid', 'plantuml', 'drawio']);

/** Coarse diagram complexity bucket derived from node and line counts. */
export const complexitySchema = z.enum(['simple', 'moderate', 'complex']);

/** Whole-number percentage between 0 and 100. */
export const percentageSchema = z.number().min(0).max(100);

/** Normalised relevance score between 0 and 1 inclusive. */
export const relevanceScoreSchema = z.number().min(0).max(1);

/** One-based line number within a source file. */
export const lineNumberSchema = z.number().int().positive();

export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type TestOutcome = z.infer<typeof testOutcomeSchema>;
export type FeatureStatus = z.infer<typeof featureStatusSchema>;
export type Relevance = z.infer<typeof relevanceSchema>;
export type EditorType = z.infer<typeof editorTypeSchema>;
export type TestFramework = z.infer<typeof testFrameworkSchema>;
export type DiagramType = z.infer<typeof diagramTypeSchema>;
export type Complexity = z.infer<typeof complexitySchema>;

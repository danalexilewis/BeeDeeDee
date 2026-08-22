import { z } from 'zod';
import { lineNumberSchema } from './common.js';
import { diagramContentSchema } from './diagram.js';
import { scenarioDetailSchema, scenarioSummarySchema } from './scenario.js';
import { testResultSchema } from './test.js';

/** A span of source code relevant to a scenario. */
export const codeReferenceSchema = z.object({
  path: z.string(),
  startLine: lineNumberSchema,
  endLine: lineNumberSchema,
  context: z.string(),
  type: z.enum(['implementation', 'test', 'config', 'utility']),
});

/** Something an agent could usefully do next. */
export const agentActionSchema = z.object({
  type: z.enum(['generate-test', 'fix-scenario', 'add-diagram', 'improve-coverage']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedMinutes: z.number().int().positive(),
});

/** Everything an agent needs to reason about one scenario. */
export const agentContextSchema = z.object({
  scenario: scenarioDetailSchema,
  relatedScenarios: z.array(scenarioSummarySchema),
  testResults: z.array(testResultSchema),
  diagrams: z.array(diagramContentSchema),
  codeReferences: z.array(codeReferenceSchema),
  suggestedActions: z.array(agentActionSchema),
});

export type CodeReference = z.infer<typeof codeReferenceSchema>;
export type AgentAction = z.infer<typeof agentActionSchema>;
export type AgentContext = z.infer<typeof agentContextSchema>;

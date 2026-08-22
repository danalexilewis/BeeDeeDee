import { z } from 'zod';
import { isoDateTimeSchema, testOutcomeSchema } from './common.js';
import { errorSchema } from './error.js';

/**
 * Server-sent events pushed over `GET /api/events`. This lives in contracts so
 * the server and the SPA agree on the payload even though SSE sits outside the
 * ts-rest router.
 */
export const workbenchEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('index-updated'),
    at: isoDateTimeSchema,
    featureCount: z.number().int().nonnegative(),
    scenarioCount: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('test-status-changed'),
    at: isoDateTimeSchema,
    scenarioId: z.string(),
    status: testOutcomeSchema,
  }),
  z.object({
    type: z.literal('spec-changed'),
    at: isoDateTimeSchema,
    path: z.string(),
    change: z.enum(['added', 'changed', 'removed']),
  }),
  z.object({
    type: z.literal('index-failed'),
    at: isoDateTimeSchema,
    error: errorSchema,
  }),
]);

/** Event names used as the SSE `event:` field. */
export const workbenchEventTypeSchema = z.enum([
  'index-updated',
  'test-status-changed',
  'spec-changed',
  'index-failed',
]);

export type WorkbenchEvent = z.infer<typeof workbenchEventSchema>;
export type WorkbenchEventType = z.infer<typeof workbenchEventTypeSchema>;

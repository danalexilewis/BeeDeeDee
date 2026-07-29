import { generateOpenApi } from '@ts-rest/open-api';
import { behaviorContract } from './contract.js';

/**
 * Generates an OpenAPI document from the ts-rest contract.
 *
 * The contract stays the single source of truth: the document is derived, never
 * hand-maintained, so it cannot describe a route the server does not implement.
 *
 * Server-sent events are absent by design. OpenAPI describes request/response
 * pairs, and `GET /api/events` is a stream; `workbenchEventSchema` documents its
 * payload instead.
 */
export function generateBehaviorOpenApi(): ReturnType<typeof generateOpenApi> {
  return generateOpenApi(
    behaviorContract,
    {
      info: {
        title: 'Behavior Workbench API',
        version: '0.1.0',
        description:
          'Local API for browsing Gherkin specifications, linked tests, and diagrams. ' +
          'Served by `behavior serve` alongside the web UI.',
      },
      servers: [{ url: 'http://127.0.0.1:4000', description: 'Local workbench' }],
      tags: [
        { name: 'catalog', description: 'Features and project-level roll-ups' },
        { name: 'scenarios', description: 'Individual scenarios and agent context' },
        { name: 'tests', description: 'Result ingestion and status' },
        { name: 'index', description: 'Index lifecycle' },
        { name: 'quality', description: 'Linting and Gherkin validation' },
      ],
    },
    { setOperationId: true }
  );
}

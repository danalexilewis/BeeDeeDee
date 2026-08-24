import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { agentContextSchema } from './schemas/agent.js';
import { architectureMapSchema, architectureMapSummarySchema } from './schemas/architecture-map.js';
import { catalogDataSchema, featureFilterSchema } from './schemas/catalog.js';
import { diagramContentSchema } from './schemas/diagram.js';
import { editorLinkSchema } from './schemas/editor.js';
import { errorSchema } from './schemas/error.js';
import { featureDetailSchema, featureSummarySchema } from './schemas/feature.js';
import { indexStatusSchema } from './schemas/index-status.js';
import { lintResultSchema } from './schemas/lint.js';
import {
  editorLinkQuerySchema,
  ingestRequestSchema,
  ingestSummarySchema,
  lintRequestSchema,
  refreshRequestSchema,
  validateGherkinRequestSchema,
} from './schemas/requests.js';
import { scenarioDetailSchema } from './schemas/scenario.js';
import { testStatusSchema } from './schemas/test.js';
import { validationResultSchema } from './schemas/validation.js';

const c = initContract();

/**
 * The single HTTP surface of the workbench. The server implements it, the SPA
 * consumes it, and both derive their types from it.
 */
export const behaviorContract = c.router(
  {
    getCatalog: {
      method: 'GET',
      path: '/catalog',
      summary: 'Dashboard payload: all features with status and coverage roll-ups',
      responses: {
        200: catalogDataSchema,
        503: errorSchema,
      },
    },

    listFeatures: {
      method: 'GET',
      path: '/features',
      summary: 'Features matching a filter',
      query: featureFilterSchema,
      responses: {
        200: z.array(featureSummarySchema),
        503: errorSchema,
      },
    },

    getFeature: {
      method: 'GET',
      path: '/features/:featureId',
      summary: 'One feature with its scenarios and linked artifacts',
      responses: {
        200: featureDetailSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    getScenario: {
      method: 'GET',
      path: '/scenarios/:scenarioId',
      summary: 'One scenario with full source context',
      responses: {
        200: scenarioDetailSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    getAgentContext: {
      method: 'GET',
      path: '/scenarios/:scenarioId/context',
      summary: 'Everything an agent needs to reason about a scenario',
      responses: {
        200: agentContextSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    getDiagram: {
      method: 'GET',
      path: '/diagrams/:diagramId',
      summary: 'Diagram source and metadata',
      responses: {
        200: diagramContentSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    listArchitectureMaps: {
      method: 'GET',
      path: '/architecture-maps',
      summary: 'Architecture maps indexed from specPaths.mappings',
      responses: {
        200: z.array(architectureMapSummarySchema),
        503: errorSchema,
      },
    },

    getArchitectureMap: {
      method: 'GET',
      path: '/architecture-maps/:mapId',
      summary: 'One architecture map for the split flow / domain canvas',
      responses: {
        200: architectureMapSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    ingestTestResults: {
      method: 'POST',
      path: '/tests/results',
      summary: 'Ingest test results and update scenario status',
      body: ingestRequestSchema,
      responses: {
        202: ingestSummarySchema,
        422: errorSchema,
        503: errorSchema,
      },
    },

    getTestStatus: {
      method: 'GET',
      path: '/tests/:scenarioId/status',
      summary: 'Aggregated test status for one scenario',
      responses: {
        200: testStatusSchema,
        404: errorSchema,
        503: errorSchema,
      },
    },

    refreshIndex: {
      method: 'POST',
      path: '/index/refresh',
      summary: 'Re-index specs, optionally limited to given paths',
      body: refreshRequestSchema,
      responses: {
        202: indexStatusSchema,
        503: errorSchema,
      },
    },

    getIndexStatus: {
      method: 'GET',
      path: '/index/status',
      summary: 'Index lifecycle state, counts, and per-file problems',
      responses: {
        200: indexStatusSchema,
      },
    },

    lintSpecs: {
      method: 'POST',
      path: '/lint',
      summary: 'Lint Gherkin specs for style and best-practice violations',
      body: lintRequestSchema,
      responses: {
        200: z.array(lintResultSchema),
        503: errorSchema,
      },
    },

    validateGherkin: {
      method: 'POST',
      path: '/gherkin/validate',
      summary: 'Validate Gherkin against project conventions',
      body: validateGherkinRequestSchema,
      responses: {
        200: validationResultSchema,
        503: errorSchema,
      },
    },

    getEditorLinks: {
      method: 'GET',
      path: '/editor-links',
      summary: 'Editor deep links for a scenario, feature, or test',
      query: editorLinkQuerySchema,
      responses: {
        200: z.array(editorLinkSchema),
        404: errorSchema,
        503: errorSchema,
      },
    },
  },
  {
    pathPrefix: '/api',
    strictStatusCodes: true,
    commonResponses: {
      500: errorSchema,
    },
  }
);

/** Route keys of the contract, useful for exhaustive checks. */
export type BehaviorRouteKey = keyof typeof behaviorContract;

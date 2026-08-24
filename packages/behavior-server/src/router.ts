import { behaviorContract, type ErrorBody } from '@eddy/behavior-contracts';
import {
  generateAgentContext,
  generateEditorLinks,
  getArchitectureMap,
  getCatalog,
  getDiagram,
  getFeature,
  getScenario,
  getTestStatus,
  ingestTestResults,
  lintSpecs,
  listArchitectureMaps,
  listFeatures,
  validateGherkin,
  type BehaviorError,
  type ClockPort,
  type FileSystemPort,
  type IndexStorePort,
} from '@eddy/behavior-core';
import { initServer } from '@ts-rest/fastify';
import type { Result } from 'neverthrow';
import { toDeclaredHttpResponse, type ErrorStatus } from './http-errors.js';
import type { Indexer } from './indexer.js';

export type RouterDeps = {
  indexStore: IndexStorePort;
  fileSystem: FileSystemPort;
  clock: ClockPort;
  indexer: Indexer;
  projectRoot: string;
};

const s = initServer();

/** Error statuses shared by every read route: not-ready, and server fault. */
const READ_ERRORS = [503, 500] as const satisfies readonly ErrorStatus[];

/** Read routes addressing a single entity can also 404. */
const LOOKUP_ERRORS = [404, 503, 500] as const satisfies readonly ErrorStatus[];

/** Ingestion can reject the payload as well. */
const INGEST_ERRORS = [422, 503, 500] as const satisfies readonly ErrorStatus[];

/**
 * Renders a use case result as a ts-rest response.
 *
 * Every handler funnels through this, so route code never branches on error tags
 * and the status mapping stays in one place.
 */
function respond<TBody, TSuccess extends number, TAllowed extends ErrorStatus>(
  result: Result<TBody, BehaviorError>,
  successStatus: TSuccess,
  allowedErrors: readonly TAllowed[]
): { status: TSuccess; body: TBody } | { status: TAllowed | 500; body: ErrorBody } {
  if (result.isOk()) return { status: successStatus, body: result.value };
  return toDeclaredHttpResponse(result.error, allowedErrors);
}

/**
 * The contract implementation.
 *
 * Handlers are deliberately thin: the contract's Zod schemas parse the request,
 * one use case does the work, and the Result is mapped to HTTP. No business logic
 * lives here.
 */
export function createBehaviorRouter(deps: RouterDeps) {
  const { indexStore, fileSystem, clock, indexer, projectRoot } = deps;
  const queryDeps = { indexStore };

  return s.router(behaviorContract, {
    getCatalog: async () => respond(getCatalog(queryDeps), 200, READ_ERRORS),

    listFeatures: async ({ query }) => respond(listFeatures(queryDeps, query), 200, READ_ERRORS),

    getFeature: async ({ params }) =>
      respond(getFeature(queryDeps, params.featureId), 200, LOOKUP_ERRORS),

    getScenario: async ({ params }) =>
      respond(getScenario(queryDeps, params.scenarioId), 200, LOOKUP_ERRORS),

    getAgentContext: async ({ params }) =>
      respond(generateAgentContext(queryDeps, params.scenarioId), 200, LOOKUP_ERRORS),

    getDiagram: async ({ params }) =>
      respond(getDiagram(queryDeps, params.diagramId), 200, LOOKUP_ERRORS),

    listArchitectureMaps: async () => respond(listArchitectureMaps(queryDeps), 200, READ_ERRORS),

    getArchitectureMap: async ({ params }) =>
      respond(getArchitectureMap(queryDeps, params.mapId), 200, LOOKUP_ERRORS),

    ingestTestResults: async ({ body }) => {
      const result = ingestTestResults({ indexStore, clock }, body);

      if (result.isOk()) {
        // Tell connected clients which scenarios moved, so the UI updates
        // without polling.
        for (const scenarioId of result.value.scenariosChanged) {
          const status = getTestStatus(queryDeps, scenarioId);
          if (status.isOk()) indexer.publishScenarioStatus(scenarioId, status.value.overall);
        }
      }

      return respond(result, 202, INGEST_ERRORS);
    },

    getTestStatus: async ({ params }) =>
      respond(getTestStatus(queryDeps, params.scenarioId), 200, LOOKUP_ERRORS),

    refreshIndex: async () => ({ status: 202 as const, body: await indexer.refresh() }),

    getIndexStatus: async () => ({ status: 200 as const, body: indexer.status() }),

    lintSpecs: async ({ body }) =>
      respond(lintSpecs({ indexStore, fileSystem }, body.paths), 200, READ_ERRORS),

    validateGherkin: async ({ body }) =>
      respond(validateGherkin(queryDeps, body.gherkin), 200, READ_ERRORS),

    getEditorLinks: async ({ query }) => {
      const result = await generateEditorLinks({ indexStore, fileSystem, projectRoot }, query);
      return respond(result, 200, LOOKUP_ERRORS);
    },
  });
}

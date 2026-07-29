import { behaviorContract } from '@eddy/behavior-contracts';
import { createFixedClock, createRecordingLogger } from '@eddy/behavior-core';
import {
  createFakeFileSystem,
  createTestFiles,
  createTestProject,
} from '@eddy/behavior-core/testing';
import { initClient, type ApiFetcher } from '@ts-rest/core';
import { createServer, type BehaviorServer } from '../server.js';

/**
 * A server wired to in-memory adapters, plus a contract client that dispatches
 * through `fastify.inject()`.
 *
 * Driving the tests through the generated client rather than raw inject calls
 * means the request builder, the Zod validation, the handler, and the response
 * validation are all exercised on the same path the SPA uses.
 */
export type Harness = {
  server: BehaviorServer;
  client: ReturnType<typeof createContractClient>;
  logger: ReturnType<typeof createRecordingLogger>;
  close(): Promise<void>;
};

/** Adapts ts-rest's fetcher onto Fastify's in-process injection. */
function createContractClient(server: BehaviorServer) {
  const api: ApiFetcher = async function inject({ path, method, headers, body }) {
    const response = await server.app.inject({
      method: method as 'GET' | 'POST',
      url: path,
      headers: headers as Record<string, string>,
      ...(body === undefined ? {} : { payload: body as string }),
    });

    const contentType = response.headers['content-type'];
    const isJson = typeof contentType === 'string' && contentType.includes('application/json');

    return {
      status: response.statusCode,
      body: isJson && response.body.length > 0 ? response.json() : response.body,
      headers: new Headers(),
    };
  };

  return initClient(behaviorContract, {
    baseUrl: '',
    baseHeaders: { 'content-type': 'application/json' },
    api,
  });
}

export type HarnessOptions = {
  /** Project files, defaulting to the standard fixture set. */
  files?: Record<string, string>;
  /** Skip the initial scan, to observe the not-ready state. */
  skipInitialIndex?: boolean;
};

/** Boots a server against in-memory files and returns a driving harness. */
export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const logger = createRecordingLogger();
  const server = createServer({
    project: createTestProject(),
    projectRoot: '/repo',
    fileSystem: createFakeFileSystem(options.files ?? createTestFiles()),
    clock: createFixedClock(),
    logger,
    watch: false,
  });

  if (options.skipInitialIndex === true) {
    await server.app.ready();
  } else {
    await server.start();
  }

  return {
    server,
    client: createContractClient(server),
    logger,
    async close() {
      await server.close();
    },
  };
}

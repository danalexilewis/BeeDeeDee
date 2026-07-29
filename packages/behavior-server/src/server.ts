import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { behaviorContract, type ProjectMetadata } from '@eddy/behavior-contracts';
import {
  createConsoleLogger,
  createMemoryIndexStore,
  createNodeFileSystem,
  createSystemClock,
  type ClockPort,
  type FileSystemPort,
  type IndexStorePort,
  type LoggerPort,
} from '@eddy/behavior-core';
import fastifyStatic from '@fastify/static';
import { initServer } from '@ts-rest/fastify';
import Fastify, { type FastifyInstance } from 'fastify';
import { createEventBus, toSseFrame, type EventBus } from './events.js';
import { createIndexer, type Indexer } from './indexer.js';
import { createBehaviorRouter } from './router.js';
import { createWatcher, type Watcher } from './watcher.js';

export type CreateServerOptions = {
  project: ProjectMetadata;
  /** Absolute path to the project being inspected. */
  projectRoot: string;
  /** Directory holding the built SPA. Omit to run API-only. */
  webRoot?: string;
  /** Watch spec directories and re-index on change. Off by default in tests. */
  watch?: boolean;
  watchDebounceMs?: number;
  logger?: LoggerPort;
  clock?: ClockPort;
  fileSystem?: FileSystemPort;
  indexStore?: IndexStorePort;
};

export type BehaviorServer = {
  app: FastifyInstance;
  indexer: Indexer;
  events: EventBus;
  /** Runs the first scan and starts watching, if enabled. */
  start(): Promise<void>;
  listen(port: number, host?: string): Promise<string>;
  close(): Promise<void>;
};

/**
 * Assembles the server.
 *
 * This is the composition root: the only place that picks concrete adapters. Each
 * one can be overridden, which is how integration tests run against an in-memory
 * filesystem and a fixed clock without touching disk.
 */
export function createServer(options: CreateServerOptions): BehaviorServer {
  const projectRoot = resolve(options.projectRoot);

  const logger = options.logger ?? createConsoleLogger('info');
  const clock = options.clock ?? createSystemClock();
  const fileSystem = options.fileSystem ?? createNodeFileSystem(projectRoot);
  const indexStore = options.indexStore ?? createMemoryIndexStore();
  const events = createEventBus();

  const indexer = createIndexer({
    fileSystem,
    clock,
    logger,
    indexStore,
    events,
    project: options.project,
  });

  const app = Fastify({ logger: false });
  let watcher: Watcher | undefined;

  const s = initServer();
  s.registerRouter(
    behaviorContract,
    createBehaviorRouter({ indexStore, fileSystem, clock, indexer, projectRoot }),
    app,
    { responseValidation: true }
  );

  /**
   * Server-sent events.
   *
   * Sits outside the ts-rest router because the contract describes
   * request/response pairs, not streams. The payload schema is still shared via
   * workbenchEventSchema so both ends agree.
   */
  app.get('/api/events', function subscribe(request, reply) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // An immediate comment frame flushes headers so the client's onopen fires
    // even when no event has happened yet.
    reply.raw.write(': connected\n\n');

    const unsubscribe = events.subscribe(function send(event) {
      reply.raw.write(toSseFrame(event));
    });

    const heartbeat = setInterval(function ping() {
      reply.raw.write(': heartbeat\n\n');
    }, 30_000);

    request.raw.on('close', function cleanUp() {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get('/api/health', async function health() {
    return { status: 'ok', state: indexer.status().state };
  });

  return {
    app,
    indexer,
    events,

    async start() {
      if (options.webRoot !== undefined && existsSync(options.webRoot)) {
        await app.register(fastifyStatic, { root: resolve(options.webRoot), prefix: '/' });

        // Client-side routes must fall through to the SPA shell, while unknown
        // API paths stay JSON so a typo in a fetch does not return HTML.
        app.setNotFoundHandler(function spaFallback(request, reply) {
          if (request.url.startsWith('/api')) {
            return reply
              .code(404)
              .send({ tag: 'FileNotFound', message: `No such route: ${request.url}` });
          }
          return reply.sendFile('index.html');
        });
      }

      await app.ready();
      await indexer.refresh();

      if (options.watch === true) {
        watcher = createWatcher({
          indexer,
          logger,
          project: options.project,
          projectRoot,
          ...(options.watchDebounceMs === undefined ? {} : { debounceMs: options.watchDebounceMs }),
        });

        // Wait for chokidar to attach, so a change made right after start() is
        // seen rather than silently missed during its initial walk.
        await watcher.ready;
      }
    },

    async listen(port, host = '127.0.0.1') {
      return app.listen({ port, host });
    },

    async close() {
      await watcher?.close();
      await app.close();
    },
  };
}

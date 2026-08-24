import { resolve } from 'node:path';
import type { ProjectMetadata } from '@eddy/behavior-contracts';
import type { LoggerPort } from '@eddy/behavior-core';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Indexer } from './indexer.js';

export type WatcherDeps = {
  indexer: Indexer;
  logger: LoggerPort;
  project: ProjectMetadata;
  projectRoot: string;
  /**
   * How long to wait for changes to settle before re-indexing.
   *
   * Requirement 7.4 asks for simultaneous changes to be batched. A single save
   * from an editor can emit several events, and a git checkout emits hundreds.
   */
  debounceMs?: number;
};

export type Watcher = {
  /**
   * Resolves once the watcher is actually attached.
   *
   * chokidar's initial directory walk is asynchronous, so a change made between
   * construction and readiness is missed entirely. Callers that need watching to
   * be live before they continue must await this.
   */
  ready: Promise<void>;
  close(): Promise<void>;
};

const DEFAULT_DEBOUNCE_MS = 150;

/**
 * Watches spec and test directories and re-indexes after changes settle.
 *
 * The watcher only ever schedules work; the scan itself runs on the indexer,
 * which joins concurrent callers into one pass. That combination is what keeps a
 * burst of filesystem events from turning into a queue of overlapping walks.
 */
export function createWatcher(deps: WatcherDeps): Watcher {
  const { indexer, logger, project, projectRoot } = deps;
  const debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const directories = [
    project.specPaths.features,
    project.specPaths.diagrams,
    project.specPaths.mappings,
    project.testPaths.e2e,
    project.testPaths.components,
    ...(project.testPaths.unit === undefined ? [] : [project.testPaths.unit]),
  ].map(function toAbsolute(directory) {
    return resolve(projectRoot, directory);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  function scheduleReindex(): void {
    if (timer !== undefined) clearTimeout(timer);

    timer = setTimeout(function reindex() {
      timer = undefined;
      void indexer.refresh();
    }, debounceMs);
  }

  const watcher: FSWatcher = chokidar.watch(directories, {
    ignoreInitial: true,
    ignored: ['**/node_modules/**', '**/.git/**'],
    // Wait for a file to stop growing before reporting it, so a spec saved by a
    // formatter is read once rather than mid-write.
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
  });

  function onChange(change: 'added' | 'changed' | 'removed') {
    return function handle(path: string): void {
      logger.debug('Spec change detected', { path, change });
      indexer.publishSpecChange(path, change);
      scheduleReindex();
    };
  }

  watcher.on('add', onChange('added'));
  watcher.on('change', onChange('changed'));
  watcher.on('unlink', onChange('removed'));
  watcher.on('error', function onError(error: unknown) {
    logger.warn('Watcher error', {
      reason: error instanceof Error ? error.message : String(error),
    });
  });

  const ready = new Promise<void>(function resolveOnReady(resolve) {
    watcher.once('ready', function onReady() {
      resolve();
    });
  });

  return {
    ready,

    async close() {
      if (timer !== undefined) clearTimeout(timer);
      await watcher.close();
    },
  };
}

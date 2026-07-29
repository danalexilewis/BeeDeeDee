import type { ProjectMetadata } from '@eddy/behavior-contracts';
import {
  indexBehaviorSpecs,
  toIndexStatus,
  type BehaviorError,
  type ClockPort,
  type FileSystemPort,
  type IndexStorePort,
  type LoggerPort,
} from '@eddy/behavior-core';
import type { IndexStatus } from '@eddy/behavior-contracts';
import { describeError, toErrorBody } from '@eddy/behavior-core';
import type { EventBus } from './events.js';

export type IndexerDeps = {
  fileSystem: FileSystemPort;
  clock: ClockPort;
  logger: LoggerPort;
  indexStore: IndexStorePort;
  events: EventBus;
  project: ProjectMetadata;
};

/**
 * Owns the index lifecycle: runs scans, publishes what changed, and keeps
 * concurrent requests from starting overlapping scans.
 */
export type Indexer = {
  /** Runs a scan, returning the resulting status. */
  refresh(): Promise<IndexStatus>;
  /** Current status without scanning. */
  status(): IndexStatus;
  /** Publishes a status change for one scenario. */
  publishScenarioStatus(scenarioId: string, status: 'pass' | 'fail' | 'skipped' | 'not-run'): void;
  /** Publishes a spec file change. */
  publishSpecChange(path: string, change: 'added' | 'changed' | 'removed'): void;
};

export function createIndexer(deps: IndexerDeps): Indexer {
  const { fileSystem, clock, logger, indexStore, events, project } = deps;

  /**
   * The scan currently in flight, if any.
   *
   * A second caller joins the running scan rather than starting its own, so a
   * burst of file changes or parallel requests cannot spawn overlapping walks of
   * the same tree.
   */
  let inFlight: Promise<IndexStatus> | undefined;

  function currentStatus(): IndexStatus {
    const index = indexStore.read();
    return index.isOk()
      ? toIndexStatus(index.value, indexStore.state())
      : {
          state: indexStore.state(),
          featureCount: 0,
          scenarioCount: 0,
          diagramCount: 0,
          testFileCount: 0,
          lastIndexedAt: null,
          durationMs: null,
          problems: [],
        };
  }

  function onFailure(error: BehaviorError): IndexStatus {
    indexStore.markFailed();
    logger.error('Indexing failed', { reason: describeError(error) });
    events.publish({ type: 'index-failed', at: clock.nowIso(), error: toErrorBody(error) });
    return currentStatus();
  }

  async function runScan(): Promise<IndexStatus> {
    indexStore.markIndexing();

    const result = await indexBehaviorSpecs({ fileSystem, clock, logger }, { project });

    if (result.isErr()) return onFailure(result.error);

    indexStore.write(result.value);

    events.publish({
      type: 'index-updated',
      at: clock.nowIso(),
      featureCount: result.value.features.size,
      scenarioCount: result.value.scenarios.size,
    });

    return currentStatus();
  }

  return {
    async refresh() {
      if (inFlight !== undefined) return inFlight;

      inFlight = runScan().finally(function clear() {
        inFlight = undefined;
      });

      return inFlight;
    },

    status() {
      return currentStatus();
    },

    publishScenarioStatus(scenarioId, status) {
      events.publish({
        type: 'test-status-changed',
        at: clock.nowIso(),
        scenarioId,
        status,
      });
    },

    publishSpecChange(path, change) {
      events.publish({ type: 'spec-changed', at: clock.nowIso(), path, change });
    },
  };
}

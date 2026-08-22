import type { WorkbenchEvent } from '@eddy/behavior-contracts';
import {
  createFixedClock,
  createMemoryIndexStore,
  createRecordingLogger,
  type IndexStorePort,
} from '@eddy/behavior-core';
import {
  createFakeFileSystem,
  createTestFiles,
  createTestProject,
} from '@eddy/behavior-core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEventBus } from './events.js';
import { createIndexer, type Indexer } from './indexer.js';

let indexStore: IndexStorePort;
let events: ReturnType<typeof createEventBus>;
let received: WorkbenchEvent[];

function makeIndexer(files: Record<string, string>, options = {}): Indexer {
  return createIndexer({
    fileSystem: createFakeFileSystem(files, options),
    clock: createFixedClock(),
    logger: createRecordingLogger(),
    indexStore,
    events,
    project: createTestProject(),
  });
}

beforeEach(() => {
  indexStore = createMemoryIndexStore();
  events = createEventBus();
  received = [];
  events.subscribe(event => received.push(event));
});

describe('createIndexer', () => {
  it('reports an idle status before any scan', () => {
    const status = makeIndexer(createTestFiles()).status();
    expect(status.state).toBe('idle');
    expect(status.featureCount).toBe(0);
    expect(status.lastIndexedAt).toBeNull();
  });

  it('populates the store on refresh', async () => {
    const indexer = makeIndexer(createTestFiles());
    const status = await indexer.refresh();

    expect(status.state).toBe('ready');
    expect(status.featureCount).toBe(2);
    expect(status.scenarioCount).toBe(3);
    expect(indexStore.read().isOk()).toBe(true);
  });

  it('publishes an index-updated event on success', async () => {
    await makeIndexer(createTestFiles()).refresh();
    expect(received).toEqual([
      {
        type: 'index-updated',
        at: '2026-01-01T00:00:00.000Z',
        featureCount: 2,
        scenarioCount: 3,
      },
    ]);
  });

  it('joins concurrent refreshes into a single scan', async () => {
    // A burst of file changes or parallel requests must not spawn overlapping
    // walks of the same tree.
    const indexer = makeIndexer(createTestFiles());
    const [first, second, third] = await Promise.all([
      indexer.refresh(),
      indexer.refresh(),
      indexer.refresh(),
    ]);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(received.filter(event => event.type === 'index-updated')).toHaveLength(1);
  });

  it('starts a fresh scan once the previous one has settled', async () => {
    const indexer = makeIndexer(createTestFiles());
    await indexer.refresh();
    await indexer.refresh();
    expect(received.filter(event => event.type === 'index-updated')).toHaveLength(2);
  });

  it('marks the store failed and publishes on an unrecoverable scan error', async () => {
    const indexer = makeIndexer(createTestFiles(), { unlistable: ['specs/features'] });
    const status = await indexer.refresh();

    expect(status.state).toBe('failed');
    expect(received.some(event => event.type === 'index-failed')).toBe(true);
  });

  it('keeps a previous index readable after a later scan fails', async () => {
    const good = makeIndexer(createTestFiles());
    await good.refresh();

    const bad = makeIndexer(createTestFiles(), { unlistable: ['specs/features'] });
    const status = await bad.refresh();

    expect(status.state).toBe('failed');
    expect(status.featureCount).toBe(2);
  });

  it('records parse problems in the status without failing', async () => {
    const indexer = makeIndexer({
      ...createTestFiles(),
      'specs/features/broken.feature': 'Feature: B\n  Scenario: S\n    Given x\n  Nonsense\n',
    });

    const status = await indexer.refresh();
    expect(status.state).toBe('ready');
    expect(status.problems).toHaveLength(1);
  });

  it('publishes a scenario status change', () => {
    makeIndexer(createTestFiles()).publishScenarioStatus('login.successful-login', 'fail');
    expect(received).toEqual([
      {
        type: 'test-status-changed',
        at: '2026-01-01T00:00:00.000Z',
        scenarioId: 'login.successful-login',
        status: 'fail',
      },
    ]);
  });

  it('publishes a spec file change', () => {
    makeIndexer(createTestFiles()).publishSpecChange('specs/features/login.feature', 'changed');
    expect(received).toEqual([
      {
        type: 'spec-changed',
        at: '2026-01-01T00:00:00.000Z',
        path: 'specs/features/login.feature',
        change: 'changed',
      },
    ]);
  });
});

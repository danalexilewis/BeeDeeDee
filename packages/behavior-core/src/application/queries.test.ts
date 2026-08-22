import { beforeEach, describe, expect, it } from 'vitest';
import { createRecordingLogger } from '../adapters/logger.js';
import { createMemoryIndexStore } from '../adapters/memory-index-store.js';
import { createFixedClock } from '../adapters/system-clock.js';
import type { IndexStorePort } from '../ports/index-store.js';
import { createFakeFileSystem, createTestFiles, createTestProject } from '../testing/index.js';
import { indexBehaviorSpecs } from './index-specs.js';
import {
  getCatalog,
  getDiagram,
  getFeature,
  getIndexStatus,
  getScenario,
  getTestStatus,
  listFeatures,
} from './queries.js';

let indexStore: IndexStorePort;

beforeEach(async () => {
  indexStore = createMemoryIndexStore();
  const index = await indexBehaviorSpecs(
    {
      fileSystem: createFakeFileSystem(createTestFiles()),
      clock: createFixedClock(),
      logger: createRecordingLogger(),
    },
    { project: createTestProject() }
  );
  indexStore.write(index._unsafeUnwrap());
});

describe('getCatalog', () => {
  it('lists every feature with coverage and status', () => {
    const catalog = getCatalog({ indexStore })._unsafeUnwrap();
    expect(catalog.features.map(f => f.id)).toEqual(['billing', 'login']);
    expect(catalog.totalScenarios).toBe(3);
    expect(catalog.statusCounts.untested).toBeGreaterThan(0);
  });

  it('collects the distinct tags in use', () => {
    expect(getCatalog({ indexStore })._unsafeUnwrap().tags).toEqual(['@auth', '@billing']);
  });

  it('reports IndexNotReady before the first scan', () => {
    const empty = createMemoryIndexStore();
    expect(getCatalog({ indexStore: empty })._unsafeUnwrapErr().tag).toBe('IndexNotReady');
  });

  it('returns a JSON-serialisable payload with no Maps leaking out', () => {
    const catalog = getCatalog({ indexStore })._unsafeUnwrap();
    expect(JSON.parse(JSON.stringify(catalog))).toEqual(catalog);
  });
});

describe('listFeatures', () => {
  it('returns everything for an empty filter', () => {
    expect(listFeatures({ indexStore }, {})._unsafeUnwrap()).toHaveLength(2);
  });

  it('filters by status', () => {
    const untested = listFeatures({ indexStore }, { status: 'untested' })._unsafeUnwrap();
    expect(untested.every(f => f.status === 'untested')).toBe(true);
  });

  it('filters by tag, ignoring the @ prefix', () => {
    expect(listFeatures({ indexStore }, { tags: ['auth'] })._unsafeUnwrap()).toHaveLength(1);
    expect(listFeatures({ indexStore }, { tags: ['@auth'] })._unsafeUnwrap()).toHaveLength(1);
  });

  it('requires every requested tag to be present', () => {
    expect(listFeatures({ indexStore }, { tags: ['auth', 'billing'] })._unsafeUnwrap()).toEqual([]);
  });

  it('searches title and description', () => {
    expect(listFeatures({ indexStore }, { search: 'invoiced' })._unsafeUnwrap()).toHaveLength(1);
    expect(listFeatures({ indexStore }, { search: 'LOGIN' })._unsafeUnwrap()).toHaveLength(1);
  });

  it('returns nothing for a search that matches nothing', () => {
    expect(listFeatures({ indexStore }, { search: 'zzzz' })._unsafeUnwrap()).toEqual([]);
  });

  it('filters by coverage bounds', () => {
    expect(listFeatures({ indexStore }, { maxCoverage: 0 })._unsafeUnwrap().length).toBeGreaterThan(
      0
    );
    expect(listFeatures({ indexStore }, { minCoverage: 100 })._unsafeUnwrap()).toEqual([]);
  });

  it('ignores a blank search string', () => {
    expect(listFeatures({ indexStore }, { search: '   ' })._unsafeUnwrap()).toHaveLength(2);
  });
});

describe('getFeature', () => {
  it('returns a feature with its scenarios', () => {
    const feature = getFeature({ indexStore }, 'login')._unsafeUnwrap();
    expect(feature.title).toBe('Login');
    expect(feature.scenarios).toHaveLength(2);
    expect(feature.gherkinSource).toContain('Feature: Login');
  });

  it('reports a missing feature', () => {
    const error = getFeature({ indexStore }, 'nope')._unsafeUnwrapErr();
    expect(error.tag).toBe('FeatureNotFound');
  });

  it('defaults rules to an empty array', () => {
    expect(getFeature({ indexStore }, 'login')._unsafeUnwrap().rules).toEqual([]);
  });
});

describe('getScenario', () => {
  it('returns a scenario with its feature context', () => {
    const scenario = getScenario({ indexStore }, 'login.successful-login')._unsafeUnwrap();
    expect(scenario.name).toBe('Successful login');
    expect(scenario.featureId).toBe('login');
    expect(scenario.featurePath).toBe('specs/features/login.feature');
    expect(scenario.steps).toHaveLength(3);
  });

  it('reports a missing scenario', () => {
    expect(getScenario({ indexStore }, 'nope')._unsafeUnwrapErr().tag).toBe('ScenarioNotFound');
  });

  it('reports not-run status before any results arrive', () => {
    const scenario = getScenario({ indexStore }, 'login.successful-login')._unsafeUnwrap();
    expect(scenario.status.overall).toBe('not-run');
    expect(scenario.status.lastRun).toBeNull();
  });
});

describe('getDiagram', () => {
  it('returns diagram content with its strongest link', () => {
    const diagram = getDiagram({ indexStore }, 'login')._unsafeUnwrap();
    expect(diagram.title).toBe('Login flow');
    expect(diagram.link.diagramId).toBe('login');
    expect(diagram.link.relevanceScore).toBeGreaterThan(0);
  });

  it('reports a missing diagram', () => {
    expect(getDiagram({ indexStore }, 'nope')._unsafeUnwrapErr().tag).toBe('DiagramNotFound');
  });
});

describe('getTestStatus', () => {
  it('returns aggregated status for a known scenario', () => {
    const status = getTestStatus({ indexStore }, 'login.successful-login')._unsafeUnwrap();
    expect(status.scenarioId).toBe('login.successful-login');
    expect(status.overall).toBe('not-run');
  });

  it('reports a missing scenario', () => {
    expect(getTestStatus({ indexStore }, 'nope')._unsafeUnwrapErr().tag).toBe('ScenarioNotFound');
  });
});

describe('getIndexStatus', () => {
  it('reports counts once the index is ready', () => {
    const status = getIndexStatus({ indexStore });
    expect(status.state).toBe('ready');
    expect(status.featureCount).toBe(2);
    expect(status.scenarioCount).toBe(3);
    expect(status.diagramCount).toBe(1);
    expect(status.lastIndexedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('reports an idle state with zero counts before the first scan', () => {
    const status = getIndexStatus({ indexStore: createMemoryIndexStore() });
    expect(status.state).toBe('idle');
    expect(status.featureCount).toBe(0);
    expect(status.lastIndexedAt).toBeNull();
    expect(status.problems).toEqual([]);
  });

  it('reports an indexing state while a scan runs', () => {
    const store = createMemoryIndexStore();
    store.markIndexing();
    expect(getIndexStatus({ indexStore: store }).state).toBe('indexing');
  });

  it('keeps the previous index visible after a failed scan', () => {
    indexStore.markFailed();
    const status = getIndexStatus({ indexStore });
    expect(status.state).toBe('failed');
    expect(status.featureCount).toBe(2);
  });
});

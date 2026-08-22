import { describe, expect, it } from 'vitest';
import { createSilentLogger } from '../adapters/logger.js';
import { createMemoryIndexStore } from '../adapters/memory-index-store.js';
import { createSystemClock } from '../adapters/system-clock.js';
import { createFakeFileSystem, createTestProject } from '../testing/fakes.js';
import { indexBehaviorSpecs } from './index-specs.js';
import { getCatalog, getFeature, getScenario, listFeatures } from './queries.js';

/**
 * Performance targets from design.md.
 *
 * These run against an in-memory filesystem, so they measure parsing, linking,
 * and projection rather than disk throughput. That is the part of the budget the
 * code controls; disk speed varies by machine and would make the assertions
 * flaky rather than informative.
 */
const INDEX_BUDGET_MS = 30_000;
const NAVIGATION_BUDGET_MS = 100;
const MEMORY_BUDGET_BYTES = 500 * 1024 * 1024;

/** Scenarios per generated feature, close to what a real spec tree looks like. */
const SCENARIOS_PER_FEATURE = 10;

/** Builds a project with the requested number of scenarios. */
function generateProject(scenarioCount: number): Record<string, string> {
  const files: Record<string, string> = {};
  const featureCount = Math.ceil(scenarioCount / SCENARIOS_PER_FEATURE);

  for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
    const scenarios = Array.from(
      { length: SCENARIOS_PER_FEATURE },
      function toScenario(_unused, scenarioIndex) {
        return [
          `  @area${featureIndex % 7}`,
          `  Scenario: Behaviour ${featureIndex}-${scenarioIndex} completes`,
          `    Given a prepared account for case ${scenarioIndex}`,
          `    When the operator submits form ${scenarioIndex}`,
          `    Then the ledger records entry ${scenarioIndex}`,
          `    And a receipt is issued`,
        ].join('\n');
      }
    );

    files[`specs/features/area${featureIndex % 7}/feature-${featureIndex}.feature`] = [
      `@area${featureIndex % 7}`,
      `Feature: Area ${featureIndex % 7} feature ${featureIndex}`,
      `  Behaviour covered by area ${featureIndex % 7}.`,
      '',
      ...scenarios,
      '',
    ].join('\n');

    if (featureIndex % 10 === 0) {
      files[`specs/diagrams/area-${featureIndex}.mmd`] = [
        '---',
        `title: Area ${featureIndex} flow`,
        '---',
        'flowchart TD',
        '  operator --> form',
        '  form --> ledger',
        '  ledger --> receipt',
      ].join('\n');
    }

    if (featureIndex % 4 === 0) {
      files[`tests/e2e/feature-${featureIndex}.spec.ts`] = [
        "import { test } from '@playwright/test';",
        '',
        `test('Behaviour ${featureIndex}-0 completes', async () => {});`,
        `test('Behaviour ${featureIndex}-1 completes', async () => {});`,
      ].join('\n');
    }
  }

  return files;
}

/** Heap in use after collecting garbage, when the runtime allows it. */
function heapUsedBytes(): number {
  globalThis.gc?.();
  return process.memoryUsage().heapUsed;
}

describe('indexing performance', () => {
  it(
    `indexes 1000+ scenarios within ${INDEX_BUDGET_MS / 1000}s`,
    async () => {
      const files = generateProject(1000);
      const deps = {
        fileSystem: createFakeFileSystem(files),
        clock: createSystemClock(),
        logger: createSilentLogger(),
      };

      const before = heapUsedBytes();
      const startedAt = performance.now();

      const result = await indexBehaviorSpecs(deps, { project: createTestProject() });

      const elapsedMs = performance.now() - startedAt;
      const index = result._unsafeUnwrap();

      expect(index.scenarios.size).toBeGreaterThanOrEqual(1000);
      expect(index.problems).toEqual([]);
      expect(elapsedMs).toBeLessThan(INDEX_BUDGET_MS);

      // Reported alongside the assertion so a regression is visible in the log
      // before it becomes a failure.
      expect(index.durationMs).toBeLessThan(INDEX_BUDGET_MS);

      const growthBytes = heapUsedBytes() - before;
      expect(growthBytes).toBeLessThan(MEMORY_BUDGET_BYTES);
    },
    INDEX_BUDGET_MS + 30_000
  );

  it(
    'stays within budget for 5000 scenarios',
    async () => {
      const files = generateProject(5000);
      const deps = {
        fileSystem: createFakeFileSystem(files),
        clock: createSystemClock(),
        logger: createSilentLogger(),
      };

      const startedAt = performance.now();
      const result = await indexBehaviorSpecs(deps, { project: createTestProject() });
      const elapsedMs = performance.now() - startedAt;

      expect(result.isOk()).toBe(true);
      expect(elapsedMs).toBeLessThan(INDEX_BUDGET_MS);
    },
    INDEX_BUDGET_MS + 60_000
  );
});

describe('read performance at scale', () => {
  it(
    `answers catalog and detail reads within ${NAVIGATION_BUDGET_MS}ms`,
    async () => {
      const files = generateProject(1000);
      const indexed = await indexBehaviorSpecs(
        {
          fileSystem: createFakeFileSystem(files),
          clock: createSystemClock(),
          logger: createSilentLogger(),
        },
        { project: createTestProject() }
      );

      const indexStore = createMemoryIndexStore();
      indexStore.write(indexed._unsafeUnwrap());
      const deps = { indexStore };

      /** Median of several runs, so one scheduling hiccup cannot fail the build. */
      function medianMs(operation: () => void): number {
        const samples = Array.from({ length: 5 }, function measure() {
          const startedAt = performance.now();
          operation();
          return performance.now() - startedAt;
        }).sort(function ascending(left, right) {
          return left - right;
        });
        return samples[2] ?? 0;
      }

      const featureId = [...indexed._unsafeUnwrap().features.keys()][0]!;
      const scenarioId = [...indexed._unsafeUnwrap().scenarios.keys()][0]!;

      expect(
        medianMs(function readCatalog() {
          getCatalog(deps)._unsafeUnwrap();
        })
      ).toBeLessThan(NAVIGATION_BUDGET_MS);

      expect(
        medianMs(function readFeature() {
          getFeature(deps, featureId)._unsafeUnwrap();
        })
      ).toBeLessThan(NAVIGATION_BUDGET_MS);

      expect(
        medianMs(function readScenario() {
          getScenario(deps, scenarioId)._unsafeUnwrap();
        })
      ).toBeLessThan(NAVIGATION_BUDGET_MS);

      expect(
        medianMs(function search() {
          listFeatures(deps, { search: 'ledger' })._unsafeUnwrap();
        })
      ).toBeLessThan(NAVIGATION_BUDGET_MS);
    },
    INDEX_BUDGET_MS + 30_000
  );
});

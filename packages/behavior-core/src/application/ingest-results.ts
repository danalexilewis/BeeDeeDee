import type { IngestRequest, IngestSummary, TestLink, TestResult } from '@eddy/behavior-contracts';
import { ok, type Result } from 'neverthrow';
import { testIdFrom } from '../domain/ids.js';
import { mergeResults } from '../domain/status.js';
import { parseReport } from '../parsers/reports/index.js';
import type { ClockPort } from '../ports/clock.js';
import type { IndexStorePort } from '../ports/index-store.js';
import type { BehaviorError } from '../errors.js';
import type { BehaviorIndex } from './behavior-index.js';
import { statusOf } from './projections.js';

export type IngestDeps = {
  indexStore: IndexStorePort;
  clock: ClockPort;
};

/**
 * Finds the scenario a result belongs to.
 *
 * Prefers the exact test id recorded at index time. Falls back to matching by
 * file path, because a report's line number can drift from the indexed one when
 * the file changed after indexing but before the run was ingested.
 */
function scenarioForResult(index: BehaviorIndex, result: TestResult): string | undefined {
  const direct = index.scenarioByTestId.get(result.testId);
  if (direct !== undefined) return direct;

  if (result.line !== undefined) {
    const byLine = index.scenarioByTestId.get(testIdFrom(result.file, result.line));
    if (byLine !== undefined) return byLine;
  }

  for (const [testId, scenarioId] of index.scenarioByTestId) {
    if (testId.startsWith(`${result.file}:`)) return scenarioId;
  }

  return undefined;
}

/** Refreshes the status recorded on a scenario's test links after ingestion. */
function refreshLinkStatuses(index: BehaviorIndex, scenarioId: string): void {
  const links = index.testLinks.get(scenarioId);
  if (links === undefined) return;

  const results = index.results.get(scenarioId) ?? [];

  const updated: TestLink[] = links.map(function withStatus(link) {
    const forLink = results.filter(function belongs(result) {
      return result.testId === link.testId;
    });

    const latest = forLink.at(-1);
    if (latest === undefined) return link;

    const next: TestLink = { ...link, status: latest.status };
    if (latest.durationMs !== undefined) next.durationMs = latest.durationMs;
    if (latest.errorMessage !== undefined) next.errorMessage = latest.errorMessage;
    return next;
  });

  index.testLinks.set(scenarioId, updated);
}

/**
 * Ingests test results and updates scenario status.
 *
 * Re-ingesting the same report is idempotent: results are keyed by test id, run
 * timestamp, and attempt, so a repeated upload replaces rather than accumulates.
 */
export function ingestTestResults(
  deps: IngestDeps,
  request: IngestRequest
): Result<IngestSummary, BehaviorError> {
  const fallbackTimestamp = deps.clock.nowIso();

  const resultsResult: Result<TestResult[], BehaviorError> =
    request.format === 'native'
      ? ok(request.results)
      : parseReport(request.format, request.report, fallbackTimestamp);

  return resultsResult.andThen(function apply(results) {
    return deps.indexStore.read().map(function update(index) {
      const unmatchedTests: string[] = [];
      const changed = new Set<string>();

      const groupedByScenario = new Map<string, TestResult[]>();

      for (const result of results) {
        const scenarioId = scenarioForResult(index, result);
        if (scenarioId === undefined) {
          unmatchedTests.push(result.testId);
          continue;
        }

        const group = groupedByScenario.get(scenarioId) ?? [];
        group.push(result);
        groupedByScenario.set(scenarioId, group);
      }

      for (const [scenarioId, group] of groupedByScenario) {
        const before = statusOf(index, scenarioId);
        index.results.set(scenarioId, mergeResults(index.results.get(scenarioId) ?? [], group));
        refreshLinkStatuses(index, scenarioId);

        const after = statusOf(index, scenarioId);
        if (before.overall !== after.overall || before.lastRun !== after.lastRun) {
          changed.add(scenarioId);
        }
      }

      deps.indexStore.write(index);

      return {
        ingested: results.length,
        matchedScenarios: groupedByScenario.size,
        unmatchedTests: [...new Set(unmatchedTests)].sort(),
        scenariosChanged: [...changed].sort(),
      };
    });
  });
}

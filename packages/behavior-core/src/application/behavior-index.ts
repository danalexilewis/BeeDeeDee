import type {
  IndexProblem,
  ParsedDiagram,
  ProjectMetadata,
  TestLink,
  TestResult,
} from '@eddy/behavior-contracts';
import type { DiagramLink, GherkinBackground, GherkinRule } from '@eddy/behavior-contracts';
import type { ParsedScenario } from '../parsers/gherkin.js';

/** A feature as held in the index, before projection to a wire shape. */
export type IndexedFeature = {
  id: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
  line: number;
  background?: GherkinBackground;
  rules: GherkinRule[];
  scenarioIds: string[];
  diagramLinks: DiagramLink[];
  source: string;
};

/** A scenario as held in the index, with its parent feature denormalised on. */
export type IndexedScenario = ParsedScenario & {
  featureId: string;
  featureTitle: string;
  featurePath: string;
  diagramLinks: DiagramLink[];
};

/**
 * The in-memory behavior index.
 *
 * Maps rather than records, because lookups dominate and the index is never
 * serialised directly. Use cases project it into the contract's JSON shapes on
 * read, which is also where Maps would otherwise leak out as `{}`.
 */
export type BehaviorIndex = {
  project: ProjectMetadata;
  features: Map<string, IndexedFeature>;
  scenarios: Map<string, IndexedScenario>;
  diagrams: Map<string, ParsedDiagram>;
  /** Tests linked to each scenario, by scenario id. */
  testLinks: Map<string, TestLink[]>;
  /** Ingested results per scenario, by scenario id. */
  results: Map<string, TestResult[]>;
  /** Reverse lookup for ingestion, by test id. */
  scenarioByTestId: Map<string, string>;
  testFileCount: number;
  /** Files that failed to parse. Requirement 1.5: report and keep going. */
  problems: IndexProblem[];
  indexedAt: string;
  durationMs: number;
};

/** An index with no content, used before the first scan completes. */
export function emptyIndex(project: ProjectMetadata, indexedAt: string): BehaviorIndex {
  return {
    project,
    features: new Map(),
    scenarios: new Map(),
    diagrams: new Map(),
    testLinks: new Map(),
    results: new Map(),
    scenarioByTestId: new Map(),
    testFileCount: 0,
    problems: [],
    indexedAt,
    durationMs: 0,
  };
}

/** All results recorded for a scenario, or an empty list. */
export function resultsFor(index: BehaviorIndex, scenarioId: string): TestResult[] {
  return index.results.get(scenarioId) ?? [];
}

/** All test links recorded for a scenario, or an empty list. */
export function testLinksFor(index: BehaviorIndex, scenarioId: string): TestLink[] {
  return index.testLinks.get(scenarioId) ?? [];
}

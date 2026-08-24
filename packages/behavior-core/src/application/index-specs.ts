import type { IndexProblem, ProjectMetadata } from '@eddy/behavior-contracts';
import { ResultAsync, type Result } from 'neverthrow';
import { linkDiagramsToScenario, type RelevanceDiagram } from '../domain/relevance.js';
import { matchTestsToScenarios, type MatchableScenario } from '../domain/matching.js';
import { resolveActivatesEdges } from '../domain/activates.js';
import { partitionResults, toErrorBody, type BehaviorError } from '../errors.js';
import {
  parseAllArchitectureMaps,
  parseAllMermaid,
  parseAllSpecDocuments,
  parseAllTestFiles,
  type SourceFile,
} from '../parsers/batch.js';
import type { ParsedFeatureDocument } from '../parsers/gherkin.js';
import type { ParsedGurkiFeatureDocument } from '../parsers/gurki.js';
import type { ClockPort } from '../ports/clock.js';
import type { FileSystemPort } from '../ports/file-system.js';
import type { LoggerPort } from '../ports/logger.js';
import {
  emptyIndex,
  type BehaviorIndex,
  type IndexedFeature,
  type IndexedScenario,
} from './behavior-index.js';

const FEATURE_EXTENSIONS = ['.feature', '.spec.md'] as const;
const DIAGRAM_EXTENSIONS = ['.mmd', '.mermaid'] as const;
const ARCHITECTURE_MAP_EXTENSIONS = ['.architecture.json'] as const;
const TEST_EXTENSIONS = ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx', '.spec.js', '.test.js'];

export type IndexDeps = {
  fileSystem: FileSystemPort;
  clock: ClockPort;
  logger: LoggerPort;
};

export type IndexSpecsInput = {
  project: ProjectMetadata;
};

/** Reads every path, keeping the files that could be read. */
function readAll(
  fileSystem: FileSystemPort,
  paths: readonly string[]
): ResultAsync<{ values: SourceFile[]; errors: BehaviorError[] }, BehaviorError> {
  return ResultAsync.fromSafePromise(
    Promise.all(
      paths.map(async function readOne(path): Promise<Result<SourceFile, BehaviorError>> {
        const result = await fileSystem.readFile(path);
        return result.map(function toFile(content) {
          return { path, content };
        });
      })
    )
  ).map(partitionResults);
}

/** Lists files across several directories, tolerating absent ones. */
function listAcross(
  fileSystem: FileSystemPort,
  directories: readonly string[],
  extensions: readonly string[]
): ResultAsync<string[], BehaviorError> {
  return ResultAsync.combine(
    directories.map(function listOne(directory) {
      return fileSystem.listFiles(directory, extensions);
    })
  ).map(function flatten(groups) {
    return [...new Set(groups.flat())].sort();
  });
}

/** Converts a batch of errors into the index's problem list. */
function toProblems(errors: readonly BehaviorError[]): IndexProblem[] {
  return errors.map(function toProblem(error): IndexProblem {
    const body = toErrorBody(error);
    const path = typeof body.details?.['path'] === 'string' ? body.details['path'] : 'unknown';
    return { path, error: body };
  });
}

/**
 * Scans the project and builds the behavior index.
 *
 * Never fails on a single bad file: parse failures land in `problems` with their
 * line numbers while everything else is indexed, which is what Requirement 1.5
 * asks for. The whole scan only fails if a spec directory cannot be listed at
 * all, since that means the project configuration is wrong.
 */
export function indexBehaviorSpecs(
  deps: IndexDeps,
  input: IndexSpecsInput
): ResultAsync<BehaviorIndex, BehaviorError> {
  const { fileSystem, clock, logger } = deps;
  const { project } = input;
  const startedAt = clock.monotonicMs();

  const testDirectories = [
    project.testPaths.e2e,
    project.testPaths.components,
    ...(project.testPaths.unit === undefined ? [] : [project.testPaths.unit]),
  ];

  return ResultAsync.combine([
    fileSystem.listFiles(project.specPaths.features, FEATURE_EXTENSIONS),
    fileSystem.listFiles(project.specPaths.diagrams, DIAGRAM_EXTENSIONS),
    fileSystem.listFiles(project.specPaths.mappings, ARCHITECTURE_MAP_EXTENSIONS),
    listAcross(fileSystem, testDirectories, TEST_EXTENSIONS),
  ])
    .andThen(function readEverything([featurePaths, diagramPaths, mapPaths, testPaths]) {
      return ResultAsync.combine([
        readAll(fileSystem, featurePaths),
        readAll(fileSystem, diagramPaths),
        readAll(fileSystem, mapPaths),
        readAll(fileSystem, testPaths),
      ]).map(function withCounts(batches) {
        return { batches, testFileCount: testPaths.length };
      });
    })
    .map(function build({ batches, testFileCount }) {
      const [featureFiles, diagramFiles, mapFiles, testFiles] = batches;

      const features = parseAllSpecDocuments(featureFiles.values, project.specPaths.features);
      const diagrams = parseAllMermaid(diagramFiles.values, project.specPaths.diagrams);
      const architectureMaps = parseAllArchitectureMaps(
        mapFiles.values,
        project.specPaths.mappings
      );
      const tests = parseAllTestFiles(testFiles.values);

      const index = emptyIndex(project, clock.nowIso());
      index.testFileCount = testFileCount;
      index.problems = toProblems([
        ...featureFiles.errors,
        ...diagramFiles.errors,
        ...mapFiles.errors,
        ...testFiles.errors,
        ...features.errors,
        ...diagrams.errors,
        ...architectureMaps.errors,
        ...tests.errors,
      ]);

      for (const diagram of diagrams.values) {
        index.diagrams.set(diagram.id, diagram);
      }

      for (const map of architectureMaps.values) {
        index.architectureMaps.set(map.id, map);
      }

      const relevanceDiagrams: RelevanceDiagram[] = diagrams.values.map(
        function toRelevance(diagram) {
          return {
            id: diagram.id,
            type: diagram.type,
            path: diagram.path,
            title: diagram.title,
            content: diagram.content,
          };
        }
      );

      const matchableScenarios: MatchableScenario[] = [];

      for (const document of features.values) {
        const gurki = isGurkiDocument(document) ? document : undefined;
        const indexedFeature: IndexedFeature = {
          id: document.featureId,
          title: document.title,
          description: document.description,
          path: document.path,
          tags: document.tags,
          line: document.line,
          rules: document.rules,
          scenarioIds: document.scenarios.map(function toId(scenario) {
            return scenario.id;
          }),
          diagramLinks: [],
          source: document.source,
          dialect: gurki === undefined ? 'gherkin' : 'gurki',
          systemOutputs: gurki?.systemOutputs ?? [],
          systemOutcomes: gurki?.systemOutcomes ?? [],
          activatesLinks: [],
        };
        if (document.background !== undefined) indexedFeature.background = document.background;

        const featureDiagramIds = new Set<string>();

        for (const scenario of document.scenarios) {
          const diagramLinks = linkDiagramsToScenario(
            {
              name: scenario.name,
              featureTitle: document.title,
              tags: scenario.tags,
              stepTexts: scenario.steps.map(function toText(step) {
                return step.text;
              }),
            },
            relevanceDiagrams
          );

          for (const link of diagramLinks) featureDiagramIds.add(link.diagramId);

          const indexedScenario: IndexedScenario = {
            ...scenario,
            featureId: document.featureId,
            featureTitle: document.title,
            featurePath: document.path,
            diagramLinks,
          };

          index.scenarios.set(scenario.id, indexedScenario);
          matchableScenarios.push({
            id: scenario.id,
            name: scenario.name,
            featureTitle: document.title,
            tags: scenario.tags,
          });
        }

        // Feature-level diagram links are the union of its scenarios', kept in a
        // stable order so repeated indexing produces an identical index.
        indexedFeature.diagramLinks = [...featureDiagramIds]
          .sort()
          .flatMap(function toLink(diagramId) {
            for (const scenarioId of indexedFeature.scenarioIds) {
              const link = index.scenarios
                .get(scenarioId)
                ?.diagramLinks.find(function matches(candidate) {
                  return candidate.diagramId === diagramId;
                });
              if (link !== undefined) return [link];
            }
            return [];
          });

        index.features.set(document.featureId, indexedFeature);
      }

      const allActivates = resolveActivatesEdges(
        [...index.scenarios.values()].map(function toActivatesScenario(scenario) {
          return {
            id: scenario.id,
            name: scenario.name,
            featureId: scenario.featureId,
            steps: scenario.steps,
          };
        })
      );

      for (const feature of index.features.values()) {
        feature.activatesLinks = allActivates.filter(function inFeature(edge) {
          return feature.scenarioIds.includes(edge.fromScenarioId);
        });
      }

      const matches = matchTestsToScenarios(matchableScenarios, tests.values);
      index.testLinks = matches.linksByScenario;
      index.scenarioByTestId = matches.scenarioByTestId;

      index.durationMs = Math.max(0, clock.monotonicMs() - startedAt);

      logger.info('Indexed behavior specs', {
        features: index.features.size,
        scenarios: index.scenarios.size,
        diagrams: index.diagrams.size,
        architectureMaps: index.architectureMaps.size,
        testFiles: index.testFileCount,
        problems: index.problems.length,
        durationMs: index.durationMs,
      });

      return index;
    });
}

/** Narrows a parsed document to the Gurki-enriched shape. */
function isGurkiDocument(
  document: ParsedFeatureDocument | ParsedGurkiFeatureDocument
): document is ParsedGurkiFeatureDocument {
  return 'dialect' in document && document.dialect === 'gurki';
}

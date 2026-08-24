import type { ReportFormat } from '@eddy/behavior-contracts';
import {
  createConsoleLogger,
  createMemoryIndexStore,
  createNodeFileSystem,
  createSilentLogger,
  createSystemClock,
  generateEditorLinks,
  getCatalog,
  indexBehaviorSpecs,
  ingestTestResults,
  lintSpecs,
  toIndexStatus,
  type BehaviorError,
  type ClockPort,
  type FileSystemPort,
  type LoggerPort,
} from '@eddy/behavior-core';
import { resolve } from 'node:path';
import { defaultConfig, configTemplate, loadConfig, type ResolvedConfig } from './config.js';
import {
  formatIndexStatus,
  formatLintResults,
  hasLintErrors,
  reportError,
  type OutputPort,
} from './output.js';

/**
 * Everything a command needs from the outside world.
 *
 * Injected rather than constructed inside each command, so integration tests can
 * run against an in-memory filesystem and capture output without spawning a
 * process.
 */
export type CommandDeps = {
  fileSystem: FileSystemPort;
  clock: ClockPort;
  logger: LoggerPort;
  output: OutputPort;
  projectRoot: string;
};

/** Builds the real dependencies for a project root. */
export function createCommandDeps(
  projectRoot: string,
  output: OutputPort,
  verbose = false
): CommandDeps {
  const root = resolve(projectRoot);
  return {
    fileSystem: createNodeFileSystem(root),
    clock: createSystemClock(),
    logger: verbose ? createConsoleLogger('debug') : createSilentLogger(),
    output,
    projectRoot: root,
  };
}

/** Loads config, reporting a malformed file rather than falling back silently. */
async function resolveConfig(deps: CommandDeps): Promise<ResolvedConfig | BehaviorError> {
  const result = await loadConfig(deps.fileSystem, deps.projectRoot);
  return result.isOk() ? result.value : result.error;
}

/** Writes a `.behaviorrc` if one does not already exist. */
export async function runInit(deps: CommandDeps, force: boolean): Promise<number> {
  const existing = await deps.fileSystem.fileExists('.behaviorrc');
  if (existing.isErr()) return reportError(deps.output, existing.error);

  if (existing.value && !force) {
    deps.output.writeError('error: .behaviorrc already exists, pass --force to overwrite');
    return 1;
  }

  const config = defaultConfig(deps.projectRoot);
  const written = await deps.fileSystem.writeFile(
    '.behaviorrc',
    configTemplate(config.project.name)
  );
  if (written.isErr()) return reportError(deps.output, written.error);

  deps.output.write('Wrote .behaviorrc');
  deps.output.write('');
  deps.output.write('Next steps:');
  deps.output.write(`  put feature files in ${config.project.specPaths.features}`);
  deps.output.write(`  put diagrams in ${config.project.specPaths.diagrams}`);
  deps.output.write(`  put architecture maps in ${config.project.specPaths.mappings}`);
  deps.output.write('  run `behavior index` to check what is found');
  return 0;
}

/** Scans the project and reports what was indexed. */
export async function runIndex(deps: CommandDeps, asJson: boolean): Promise<number> {
  const config = await resolveConfig(deps);
  if (!('project' in config)) return reportError(deps.output, config);

  const result = await indexBehaviorSpecs(deps, { project: config.project });
  if (result.isErr()) return reportError(deps.output, result.error);

  const status = toIndexStatus(result.value, 'ready');

  if (asJson) {
    deps.output.write(JSON.stringify(status, null, 2));
  } else {
    for (const line of formatIndexStatus(status)) deps.output.write(line);
  }

  // Parse problems are reported but do not fail the command: the index is still
  // usable, and Requirement 1.5 treats them as findings rather than failures.
  return 0;
}

/** Ingests a test report and reports what matched. */
export async function runIngestTests(
  deps: CommandDeps,
  reportPath: string,
  format: ReportFormat
): Promise<number> {
  const config = await resolveConfig(deps);
  if (!('project' in config)) return reportError(deps.output, config);

  const contents = await deps.fileSystem.readFile(reportPath);
  if (contents.isErr()) return reportError(deps.output, contents.error);

  let report: unknown;
  try {
    report = JSON.parse(contents.value);
  } catch (thrown) {
    deps.output.writeError(
      `error: ${reportPath} is not valid JSON: ${thrown instanceof Error ? thrown.message : 'parse failed'}`
    );
    return 1;
  }

  const indexed = await indexBehaviorSpecs(deps, { project: config.project });
  if (indexed.isErr()) return reportError(deps.output, indexed.error);

  const indexStore = createMemoryIndexStore();
  indexStore.write(indexed.value);

  const summary = ingestTestResults(
    { indexStore, clock: deps.clock },
    format === 'native' ? { format: 'native', results: report as never } : { format, report }
  );

  if (summary.isErr()) return reportError(deps.output, summary.error);

  deps.output.write(`ingested:  ${summary.value.ingested}`);
  deps.output.write(`matched:   ${summary.value.matchedScenarios} scenarios`);
  deps.output.write(`changed:   ${summary.value.scenariosChanged.length} scenarios`);

  if (summary.value.unmatchedTests.length > 0) {
    deps.output.write('');
    deps.output.write(`unmatched tests (${summary.value.unmatchedTests.length}):`);
    for (const testId of summary.value.unmatchedTests) deps.output.write(`  ${testId}`);
  }

  return 0;
}

/** Lints the project's specs. Exits non-zero when a finding is an error. */
export async function runLint(deps: CommandDeps, paths: readonly string[]): Promise<number> {
  const config = await resolveConfig(deps);
  if (!('project' in config)) return reportError(deps.output, config);

  const indexed = await indexBehaviorSpecs(deps, { project: config.project });
  if (indexed.isErr()) return reportError(deps.output, indexed.error);

  const indexStore = createMemoryIndexStore();
  indexStore.write(indexed.value);

  const results = lintSpecs(
    { indexStore, fileSystem: deps.fileSystem },
    paths.length > 0 ? paths : undefined
  );
  if (results.isErr()) return reportError(deps.output, results.error);

  for (const line of formatLintResults(results.value)) deps.output.write(line);

  return hasLintErrors(results.value) ? 1 : 0;
}

/**
 * Checks that every editor link resolves to a file that exists.
 *
 * Requirement 5 wants dead links surfaced; a spec that moved leaves links behind
 * that would otherwise open an editor onto nothing.
 */
export async function runValidateLinks(deps: CommandDeps): Promise<number> {
  const config = await resolveConfig(deps);
  if (!('project' in config)) return reportError(deps.output, config);

  const indexed = await indexBehaviorSpecs(deps, { project: config.project });
  if (indexed.isErr()) return reportError(deps.output, indexed.error);

  const indexStore = createMemoryIndexStore();
  indexStore.write(indexed.value);

  const dead: string[] = [];
  let checked = 0;

  for (const scenarioId of indexed.value.scenarios.keys()) {
    const links = await generateEditorLinks(
      { indexStore, fileSystem: deps.fileSystem, projectRoot: deps.projectRoot },
      { target: 'scenario', id: scenarioId }
    );
    if (links.isErr()) return reportError(deps.output, links.error);

    for (const link of links.value) {
      checked += 1;
      if (!link.targetExists) dead.push(`${scenarioId} -> ${link.path}`);
    }
  }

  deps.output.write(`checked ${checked} links across ${indexed.value.scenarios.size} scenarios`);

  if (dead.length === 0) {
    deps.output.write('all links resolve');
    return 0;
  }

  deps.output.write('');
  deps.output.write(`dead links (${dead.length}):`);
  for (const entry of dead) deps.output.write(`  ${entry}`);
  return 1;
}

/** Export formats the CLI can emit. */
export type ExportFormat = 'json' | 'csv' | 'markdown';

/** Escapes a CSV field. */
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Writes the indexed catalog in the requested format. */
export async function runExport(deps: CommandDeps, format: ExportFormat): Promise<number> {
  const config = await resolveConfig(deps);
  if (!('project' in config)) return reportError(deps.output, config);

  const indexed = await indexBehaviorSpecs(deps, { project: config.project });
  if (indexed.isErr()) return reportError(deps.output, indexed.error);

  const indexStore = createMemoryIndexStore();
  indexStore.write(indexed.value);

  const catalog = getCatalog({ indexStore });
  if (catalog.isErr()) return reportError(deps.output, catalog.error);

  if (format === 'json') {
    deps.output.write(JSON.stringify(catalog.value, null, 2));
    return 0;
  }

  if (format === 'csv') {
    deps.output.write('id,title,path,scenarios,coverage,status,tags');
    for (const feature of catalog.value.features) {
      deps.output.write(
        [
          csvField(feature.id),
          csvField(feature.title),
          csvField(feature.path),
          csvField(feature.scenarioCount),
          csvField(feature.testCoverage),
          csvField(feature.status),
          csvField(feature.tags.join(' ')),
        ].join(',')
      );
    }
    return 0;
  }

  deps.output.write(`# ${config.project.name} behavior catalog`);
  deps.output.write('');
  deps.output.write(
    `${catalog.value.features.length} features, ${catalog.value.totalScenarios} scenarios, ${catalog.value.overallCoverage}% covered`
  );
  deps.output.write('');
  deps.output.write('| Feature | Scenarios | Coverage | Status |');
  deps.output.write('| --- | --- | --- | --- |');
  for (const feature of catalog.value.features) {
    deps.output.write(
      `| ${feature.title} | ${feature.scenarioCount} | ${feature.testCoverage}% | ${feature.status} |`
    );
  }
  return 0;
}

#!/usr/bin/env node
import { Command } from 'commander';
import {
  createCommandDeps,
  runExport,
  runIndex,
  runIngestTests,
  runInit,
  runLint,
  runValidateLinks,
  type ExportFormat,
} from './commands.js';
import { createStdioOutput } from './output.js';
import { runServe } from './serve.js';

/**
 * Builds the CLI.
 *
 * Every command is a thin adapter: parse arguments, call one function, translate
 * the numeric result into an exit code. No business logic lives here.
 */
export function createProgram(): Command {
  const program = new Command();
  const output = createStdioOutput();

  program
    .name('behavior')
    .description('Browse, govern, and test application behavior from your specs')
    .version('0.1.0')
    .option('-C, --cwd <path>', 'project root to operate on', process.cwd())
    .option('-v, --verbose', 'log progress while working', false);

  /** Dependencies for the root options currently parsed. */
  function deps() {
    const options = program.opts<{ cwd: string; verbose: boolean }>();
    return createCommandDeps(options.cwd, output, options.verbose);
  }

  program
    .command('init')
    .description('write a .behaviorrc for this project')
    .option('--force', 'overwrite an existing .behaviorrc', false)
    .action(async function init(options: { force: boolean }) {
      process.exitCode = await runInit(deps(), options.force);
    });

  program
    .command('index')
    .description('scan the project and report what was found')
    .option('--json', 'emit the index status as JSON', false)
    .action(async function index(options: { json: boolean }) {
      process.exitCode = await runIndex(deps(), options.json);
    });

  program
    .command('serve')
    .description('start the workbench UI and API')
    .option('-p, --port <number>', 'port to listen on', function toPort(value) {
      return Number.parseInt(value, 10);
    })
    .option('-H, --host <host>', 'host to bind')
    .option('--no-watch', 'do not re-index when spec files change')
    .option('--api-only', 'serve the API without the UI bundle', false)
    .action(async function serve(options: {
      port?: number;
      host?: string;
      watch: boolean;
      apiOnly: boolean;
    }) {
      process.exitCode = await runServe(deps(), output, {
        ...(options.port === undefined ? {} : { port: options.port }),
        ...(options.host === undefined ? {} : { host: options.host }),
        watch: options.watch,
        apiOnly: options.apiOnly,
      });
    });

  program
    .command('ingest-tests <report>')
    .description('ingest a test report and report which scenarios it matched')
    .option(
      '-f, --format <format>',
      'playwright-json, vitest-json, jest-json, or native',
      'playwright-json'
    )
    .action(async function ingest(report: string, options: { format: string }) {
      const allowed = ['playwright-json', 'vitest-json', 'jest-json', 'native'];
      if (!allowed.includes(options.format)) {
        output.writeError(
          `error: unknown format ${options.format}, expected ${allowed.join(', ')}`
        );
        process.exitCode = 1;
        return;
      }
      process.exitCode = await runIngestTests(deps(), report, options.format as never);
    });

  program
    .command('lint [paths...]')
    .description('check specs for style and best-practice problems')
    .action(async function lint(paths: string[]) {
      process.exitCode = await runLint(deps(), paths);
    });

  program
    .command('validate-links')
    .description('check that every editor deep link resolves to a real file')
    .action(async function validateLinks() {
      process.exitCode = await runValidateLinks(deps());
    });

  program
    .command('export')
    .description('write the behavior catalog to stdout')
    .option('-f, --format <format>', 'json, csv, or markdown', 'json')
    .action(async function exportCatalog(options: { format: string }) {
      const allowed = ['json', 'csv', 'markdown'];
      if (!allowed.includes(options.format)) {
        output.writeError(
          `error: unknown format ${options.format}, expected ${allowed.join(', ')}`
        );
        process.exitCode = 1;
        return;
      }
      process.exitCode = await runExport(deps(), options.format as ExportFormat);
    });

  program.addHelpText(
    'after',
    `
Examples:
  behavior init                              write a starter .behaviorrc
  behavior index                             see what would be indexed
  behavior serve                             open the workbench
  behavior ingest-tests results.json         update status from a Playwright run
  behavior lint                              check spec quality
  behavior export --format markdown          write a catalog summary
`
  );

  return program;
}

await createProgram().parseAsync();

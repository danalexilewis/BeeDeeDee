import { createConsoleLogger, createSystemClock } from '@eddy/behavior-core';
import { createServer } from '@eddy/behavior-server';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { reportError, type OutputPort } from './output.js';
import type { CommandDeps } from './commands.js';

/**
 * Locates the built SPA.
 *
 * Installed as a package the assets sit beside the CLI's own dist; run from the
 * repo they sit in the sibling web package. Checking both means `behavior serve`
 * works in development and after publishing without configuration.
 */
export function findWebRoot(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url));

  const candidates = [
    join(here, '../web'),
    join(here, '../../behavior-web/dist'),
    join(here, '../../../behavior-web/dist'),
  ];

  return candidates.find(function exists(candidate) {
    return existsSync(join(candidate, 'index.html'));
  });
}

export type ServeOptions = {
  port?: number;
  host?: string;
  /** Watch spec directories and re-index on change. */
  watch: boolean;
  /** Serve the API only, for use behind the Vite dev server. */
  apiOnly: boolean;
};

/**
 * Starts the workbench.
 *
 * One process serves the API and, unless `--api-only`, the built SPA as well, so
 * a user runs a single command and opens one URL.
 */
export async function runServe(
  deps: CommandDeps,
  output: OutputPort,
  options: ServeOptions
): Promise<number> {
  const config = await loadConfig(deps.fileSystem, deps.projectRoot);
  if (config.isErr()) return reportError(output, config.error);

  const port = options.port ?? config.value.server.port;
  const host = options.host ?? config.value.server.host;
  const webRoot = options.apiOnly ? undefined : findWebRoot();

  const server = createServer({
    project: config.value.project,
    projectRoot: resolve(deps.projectRoot),
    logger: createConsoleLogger('info'),
    clock: createSystemClock(),
    watch: options.watch,
    ...(webRoot === undefined ? {} : { webRoot }),
  });

  await server.start();
  const address = await server.listen(port, host);

  const status = server.indexer.status();
  output.write(`Behavior Workbench listening on ${address}`);
  output.write(
    `Indexed ${status.featureCount} features and ${status.scenarioCount} scenarios${
      status.problems.length > 0 ? `, ${status.problems.length} problems` : ''
    }`
  );
  if (webRoot === undefined && !options.apiOnly) {
    output.write('The UI bundle was not found; run `pnpm --filter @eddy/behavior-web build`.');
  }
  if (options.watch) output.write('Watching spec directories for changes.');

  /** Shuts down once, however many signals arrive. */
  let closing = false;
  async function shutdown(): Promise<void> {
    if (closing) return;
    closing = true;
    output.write('Shutting down.');
    await server.close();
    process.exit(0);
  }

  process.once('SIGINT', function onSigint() {
    void shutdown();
  });
  process.once('SIGTERM', function onSigterm() {
    void shutdown();
  });

  // Resolving here would end the process, so serve stays pending until a signal.
  return new Promise<number>(function neverResolve() {});
}

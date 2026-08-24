import type { ProjectMetadata } from '@eddy/behavior-contracts';
import { basename, resolve } from 'node:path';

export type McpArgs = {
  projectRoot: string;
  allowWrites: boolean;
};

/**
 * Parses the argument list.
 *
 * Deliberately minimal: an MCP server is launched by a host from a config file,
 * not typed at a prompt, so a full argument parser would add a dependency for no
 * gain. Unknown flags are ignored rather than fatal, since refusing to start
 * would be worse than skipping something we do not recognise.
 *
 * Lives apart from `bin.ts` because that module connects to stdio on import, so
 * importing it in a test would start a server.
 */
export function parseArgs(argv: readonly string[]): McpArgs {
  let projectRoot = process.cwd();
  let allowWrites = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--allow-writes') {
      allowWrites = true;
      continue;
    }

    if (arg === '--project' || arg === '-C') {
      const value = argv[index + 1];
      if (value !== undefined) {
        projectRoot = value;
        index += 1;
      }
      continue;
    }

    if (arg !== undefined && arg.startsWith('--project=')) {
      projectRoot = arg.slice('--project='.length);
    }
  }

  return { projectRoot: resolve(projectRoot), allowWrites };
}

/** Default project settings, matching the CLI's conventional layout. */
export function defaultProject(projectRoot: string): ProjectMetadata {
  return {
    id: basename(projectRoot),
    name: basename(projectRoot),
    rootPath: projectRoot,
    specPaths: {
      features: 'specs/features',
      diagrams: 'specs/diagrams',
      mappings: 'specs/mappings',
    },
    testPaths: { e2e: 'tests/e2e', components: 'tests/components' },
    editorConfig: { supportedEditors: ['vscode', 'cursor'], openCommand: 'code' },
  };
}

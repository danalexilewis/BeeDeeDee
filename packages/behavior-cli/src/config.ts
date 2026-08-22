import { projectMetadataSchema, type ProjectMetadata } from '@eddy/behavior-contracts';
import { schemaValidation, type BehaviorError, type FileSystemPort } from '@eddy/behavior-core';
import type { ResultAsync } from 'neverthrow';
import { err, ok, okAsync, type Result } from 'neverthrow';
import { basename, resolve } from 'node:path';
import { z } from 'zod';

/** Filenames searched for project configuration, in order of preference. */
export const CONFIG_FILENAMES = ['.behaviorrc', '.behaviorrc.json'] as const;

/**
 * The `.behaviorrc` file format.
 *
 * Every field is optional: the point of the file is to override defaults, not to
 * restate them. `id` and `rootPath` are derived rather than configured, since
 * they follow from where the file lives.
 */
export const behaviorConfigSchema = z.object({
  name: z.string().min(1).optional(),
  specPaths: z
    .object({
      features: z.string().min(1).optional(),
      diagrams: z.string().min(1).optional(),
      mappings: z.string().min(1).optional(),
    })
    .optional(),
  testPaths: z
    .object({
      e2e: z.string().min(1).optional(),
      components: z.string().min(1).optional(),
      unit: z.string().min(1).optional(),
    })
    .optional(),
  editorConfig: z
    .object({
      supportedEditors: z
        .array(z.enum(['vscode', 'cursor', 'kiro', 'intellij']))
        .min(1)
        .optional(),
      openCommand: z.string().min(1).optional(),
    })
    .optional(),
  server: z
    .object({
      port: z.number().int().min(1).max(65535).optional(),
      host: z.string().min(1).optional(),
    })
    .optional(),
});

export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;

/** Resolved settings: project metadata plus CLI-only options. */
export type ResolvedConfig = {
  project: ProjectMetadata;
  server: { port: number; host: string };
  /** Path of the file the settings came from, or undefined when defaulted. */
  sourcePath: string | undefined;
};

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = '127.0.0.1';

/** Settings for a project with no configuration file. */
export function defaultConfig(projectRoot: string): ResolvedConfig {
  const root = resolve(projectRoot);

  return {
    project: {
      id: basename(root),
      name: basename(root),
      rootPath: root,
      specPaths: { features: 'specs/features', diagrams: 'specs/diagrams' },
      testPaths: { e2e: 'tests/e2e', components: 'tests/components' },
      editorConfig: { supportedEditors: ['vscode', 'cursor'], openCommand: 'code' },
    },
    server: { port: DEFAULT_PORT, host: DEFAULT_HOST },
    sourcePath: undefined,
  };
}

/** Flattens Zod issues into the shape SchemaValidation carries. */
function toIssues(error: z.ZodError) {
  return error.issues.map(function toIssue(issue) {
    return { path: issue.path.map(String).join('.'), message: issue.message };
  });
}

/** Merges a parsed config file over the defaults. */
export function applyConfig(
  base: ResolvedConfig,
  config: BehaviorConfig,
  sourcePath: string
): ResolvedConfig {
  const project: ProjectMetadata = {
    ...base.project,
    name: config.name ?? base.project.name,
    specPaths: { ...base.project.specPaths, ...config.specPaths },
    testPaths: { ...base.project.testPaths, ...config.testPaths },
    editorConfig: { ...base.project.editorConfig, ...config.editorConfig },
  };

  return {
    project: projectMetadataSchema.parse(project),
    server: { ...base.server, ...config.server },
    sourcePath,
  };
}

/** Parses configuration file contents. */
export function parseConfig(contents: string, path: string): Result<BehaviorConfig, BehaviorError> {
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch (thrown) {
    return err(
      schemaValidation(path, [
        { path: '', message: thrown instanceof Error ? thrown.message : 'invalid JSON' },
      ])
    );
  }

  const parsed = behaviorConfigSchema.safeParse(raw);
  return parsed.success ? ok(parsed.data) : err(schemaValidation(path, toIssues(parsed.error)));
}

/**
 * Loads configuration from the project root.
 *
 * A missing file is not an error: the defaults describe the conventional layout,
 * so the workbench works on a project that has never been configured. A file that
 * exists but is malformed *is* an error, because silently ignoring it would leave
 * the user staring at the wrong directories.
 */
export function loadConfig(
  fileSystem: FileSystemPort,
  projectRoot: string
): ResultAsync<ResolvedConfig, BehaviorError> {
  const base = defaultConfig(projectRoot);

  function tryNext(index: number): ResultAsync<ResolvedConfig, BehaviorError> {
    const filename = CONFIG_FILENAMES[index];
    if (filename === undefined) return okAsync(base);

    return fileSystem.fileExists(filename).andThen(function readIfPresent(exists) {
      if (!exists) return tryNext(index + 1);

      return fileSystem.readFile(filename).andThen(function parse(contents) {
        return parseConfig(contents, filename).map(function merge(config) {
          return applyConfig(base, config, filename);
        });
      });
    });
  }

  return tryNext(0);
}

/** The configuration file written by `behavior init`. */
export function configTemplate(projectName: string): string {
  const template: BehaviorConfig = {
    name: projectName,
    specPaths: { features: 'specs/features', diagrams: 'specs/diagrams' },
    testPaths: { e2e: 'tests/e2e', components: 'tests/components' },
    editorConfig: { supportedEditors: ['vscode', 'cursor'], openCommand: 'code' },
    server: { port: DEFAULT_PORT, host: DEFAULT_HOST },
  };

  return `${JSON.stringify(template, null, 2)}\n`;
}

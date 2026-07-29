import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import fastGlob from 'fast-glob';
import { ResultAsync, errAsync, okAsync } from 'neverthrow';
import { pathEscapesProject, readFailed, type BehaviorError } from '../errors.js';
import type { FileSystemPort } from '../ports/file-system.js';

/** Error codes that mean "not there", as opposed to a real failure. */
const MISSING_CODES = new Set(['ENOENT', 'ENOTDIR']);

/** True when a rejection is a filesystem "missing path" error. */
export function isMissingPathError(thrown: unknown): boolean {
  return (
    typeof thrown === 'object' &&
    thrown !== null &&
    'code' in thrown &&
    MISSING_CODES.has(String((thrown as { code: unknown }).code))
  );
}

/** Renders a rejection as a message suitable for `ReadFailed`. */
function reasonOf(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/**
 * Creates a filesystem adapter confined to `projectRoot`.
 *
 * Every path is resolved and then checked to still sit beneath the root, so
 * `../../etc/passwd` and absolute paths outside the project fail with
 * `PathEscapesProject` before any I/O happens. This is the boundary the design's
 * security section asks for, and the only place in the codebase that touches
 * `node:fs`.
 */
export function createNodeFileSystem(projectRoot: string): FileSystemPort {
  const root = resolve(projectRoot);

  /** Resolves a project-relative path, refusing anything outside the root. */
  function resolveWithin(path: string): ResultAsync<string, BehaviorError> {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(root, path);
    const relativeToRoot = relative(root, absolute);

    const escapes =
      relativeToRoot.startsWith(`..${sep}`) ||
      relativeToRoot === '..' ||
      isAbsolute(relativeToRoot);

    return escapes ? errAsync(pathEscapesProject(path)) : okAsync(absolute);
  }

  /** True when the path is an existing directory. */
  function directoryExists(absolute: string): ResultAsync<boolean, BehaviorError> {
    return ResultAsync.fromPromise(
      stat(absolute).then(
        function toIsDirectory(stats) {
          return stats.isDirectory();
        },
        function toFalseOrRethrow(thrown: unknown) {
          if (isMissingPathError(thrown)) return false;
          throw thrown;
        }
      ),
      function toError(thrown): BehaviorError {
        return readFailed(absolute, reasonOf(thrown));
      }
    );
  }

  return {
    listFiles(directory, extensions) {
      return resolveWithin(directory).andThen(function scan(absoluteDirectory) {
        return directoryExists(absoluteDirectory).andThen(function globIfPresent(exists) {
          // An absent optional spec or test directory is not a failure. A
          // directory that exists but cannot be read is, and must not be
          // mistaken for an empty one.
          if (!exists) return okAsync<string[], BehaviorError>([]);

          const patterns = extensions.map(function toPattern(extension) {
            const suffix = extension.startsWith('.') ? extension : `.${extension}`;
            return `**/*${suffix}`;
          });

          return ResultAsync.fromPromise(
            fastGlob(patterns, {
              cwd: absoluteDirectory,
              onlyFiles: true,
              dot: false,
              followSymbolicLinks: false,
              ignore: ['**/node_modules/**'],
            }),
            function toError(thrown): BehaviorError {
              return readFailed(directory, reasonOf(thrown));
            }
          ).map(function toProjectRelative(matches) {
            return matches
              .map(function toRelativePath(match) {
                return relative(root, join(absoluteDirectory, match)).split(sep).join('/');
              })
              .sort();
          });
        });
      });
    },

    readFile(path) {
      return resolveWithin(path).andThen(function read(absolute) {
        return ResultAsync.fromPromise(
          readFile(absolute, 'utf8'),
          function toError(thrown): BehaviorError {
            return readFailed(path, reasonOf(thrown));
          }
        );
      });
    },

    writeFile(path, content) {
      return resolveWithin(path).andThen(function write(absolute) {
        return ResultAsync.fromPromise(
          mkdir(dirname(absolute), { recursive: true }).then(function thenWrite() {
            return writeFile(absolute, content, 'utf8');
          }),
          function toError(thrown): BehaviorError {
            return readFailed(path, reasonOf(thrown));
          }
        ).map(function toVoid() {
          return undefined;
        });
      });
    },

    fileExists(path) {
      return resolveWithin(path).andThen(function check(absolute) {
        return ResultAsync.fromPromise(
          stat(absolute).then(
            function toIsFile(stats) {
              return stats.isFile();
            },
            function toFalseOrRethrow(thrown: unknown) {
              if (isMissingPathError(thrown)) return false;
              throw thrown;
            }
          ),
          function toError(thrown): BehaviorError {
            return readFailed(path, reasonOf(thrown));
          }
        );
      });
    },
  };
}

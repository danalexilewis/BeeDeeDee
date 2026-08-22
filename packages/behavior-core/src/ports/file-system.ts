import type { ResultAsync } from 'neverthrow';
import type { BehaviorError } from '../errors.js';

/**
 * Filesystem access, as the application layer sees it.
 *
 * Implementations are responsible for confining every path to the project root;
 * a path that escapes must fail with `PathEscapesProject` rather than reading.
 */
export type FileSystemPort = {
  /**
   * Lists files beneath a directory whose names end with one of the extensions,
   * recursively, returning paths relative to the project root.
   *
   * A directory that does not exist yields an empty list rather than an error,
   * because optional spec and test directories are legitimately absent.
   */
  listFiles(directory: string, extensions: readonly string[]): ResultAsync<string[], BehaviorError>;

  /** Reads a UTF-8 text file. */
  readFile(path: string): ResultAsync<string, BehaviorError>;

  /** Writes a UTF-8 text file, creating parent directories as needed. */
  writeFile(path: string, content: string): ResultAsync<void, BehaviorError>;

  /** True when the path exists and is a readable file. */
  fileExists(path: string): ResultAsync<boolean, BehaviorError>;
};

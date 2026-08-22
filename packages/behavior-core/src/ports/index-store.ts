import type { Result } from 'neverthrow';
import type { BehaviorError } from '../errors.js';
import type { BehaviorIndex } from '../application/behavior-index.js';
import type { IndexState } from '@eddy/behavior-contracts';

/**
 * Holds the current index.
 *
 * Synchronous on purpose: the store is an in-process cache, and making every
 * read a `ResultAsync` would push async plumbing through the whole read path for
 * no benefit. Reads return a `Result` so a caller arriving before the first scan
 * gets `IndexNotReady` rather than a null check.
 */
export type IndexStorePort = {
  /** The current index, or `IndexNotReady` before the first successful scan. */
  read(): Result<BehaviorIndex, BehaviorError>;

  /** Replaces the index and marks the store ready. */
  write(index: BehaviorIndex): void;

  /** Current lifecycle state, which is observable even when no index exists. */
  state(): IndexState;

  /** Records that a scan has begun, for status reporting. */
  markIndexing(): void;

  /** Records that a scan failed, leaving any previous index in place. */
  markFailed(): void;
};

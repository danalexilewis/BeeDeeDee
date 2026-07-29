import type { IndexState } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import type { BehaviorIndex } from '../application/behavior-index.js';
import { indexNotReady, type BehaviorError } from '../errors.js';
import type { IndexStorePort } from '../ports/index-store.js';

/**
 * Holds the index in memory for the life of the process.
 *
 * A failed scan leaves the previous index in place, so a spec file saved
 * mid-edit degrades the reported state without emptying the catalog the user is
 * looking at.
 */
export function createMemoryIndexStore(): IndexStorePort {
  let current: BehaviorIndex | undefined;
  let state: IndexState = 'idle';

  return {
    read(): Result<BehaviorIndex, BehaviorError> {
      return current === undefined ? err(indexNotReady()) : ok(current);
    },

    write(index) {
      current = index;
      state = 'ready';
    },

    state() {
      return state;
    },

    markIndexing() {
      state = 'indexing';
    },

    markFailed() {
      state = 'failed';
    },
  };
}

/** An index store pre-loaded with a given index, for tests. */
export function createMemoryIndexStoreWith(index: BehaviorIndex): IndexStorePort {
  const store = createMemoryIndexStore();
  store.write(index);
  return store;
}

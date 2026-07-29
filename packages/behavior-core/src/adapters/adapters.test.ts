import { describe, expect, it, vi } from 'vitest';
import { createConsoleLogger, createRecordingLogger, createSilentLogger } from './logger.js';
import { createMemoryIndexStore, createMemoryIndexStoreWith } from './memory-index-store.js';
import { createFixedClock, createSystemClock } from './system-clock.js';
import { emptyIndex } from '../application/behavior-index.js';
import { createTestProject } from '../testing/fakes.js';

const AT = '2026-01-01T00:00:00.000Z';

function anIndex() {
  return emptyIndex(createTestProject(), AT);
}

describe('createSystemClock', () => {
  it('returns a parseable ISO timestamp', () => {
    const iso = createSystemClock().nowIso();
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
  });

  it('returns a non-negative monotonic reading', () => {
    expect(createSystemClock().monotonicMs()).toBeGreaterThanOrEqual(0);
  });
});

describe('createFixedClock', () => {
  it('does not move on its own', () => {
    const clock = createFixedClock(AT);
    expect(clock.nowIso()).toBe(AT);
    expect(clock.nowIso()).toBe(AT);
  });

  it('advances only when told to', () => {
    const clock = createFixedClock(AT);
    clock.advanceMs(1500);
    expect(clock.nowIso()).toBe('2026-01-01T00:00:01.500Z');
    expect(clock.monotonicMs()).toBe(1500);
  });

  it('starts its monotonic reading at zero', () => {
    expect(createFixedClock(AT).monotonicMs()).toBe(0);
  });
});

describe('createMemoryIndexStore', () => {
  it('starts idle with nothing to read', () => {
    const store = createMemoryIndexStore();
    expect(store.state()).toBe('idle');
    expect(store.read()._unsafeUnwrapErr().tag).toBe('IndexNotReady');
  });

  it('becomes ready once written', () => {
    const store = createMemoryIndexStore();
    store.write(anIndex());
    expect(store.state()).toBe('ready');
    expect(store.read().isOk()).toBe(true);
  });

  it('reports an indexing state during a scan', () => {
    const store = createMemoryIndexStore();
    store.markIndexing();
    expect(store.state()).toBe('indexing');
  });

  it('keeps a previous index readable after a failed scan', () => {
    const store = createMemoryIndexStore();
    store.write(anIndex());
    store.markFailed();

    expect(store.state()).toBe('failed');
    expect(store.read().isOk()).toBe(true);
  });

  it('replaces the index on a subsequent write', () => {
    const store = createMemoryIndexStore();
    store.write(anIndex());

    const replacement = anIndex();
    replacement.testFileCount = 7;
    store.write(replacement);

    expect(store.read()._unsafeUnwrap().testFileCount).toBe(7);
  });

  it('can be pre-loaded for tests', () => {
    const store = createMemoryIndexStoreWith(anIndex());
    expect(store.state()).toBe('ready');
  });
});

describe('createRecordingLogger', () => {
  it('records every level with its context', () => {
    const logger = createRecordingLogger();
    logger.debug('d');
    logger.info('i', { a: 1 });
    logger.warn('w');
    logger.error('e');

    expect(logger.entries.map(entry => entry.level)).toEqual(['debug', 'info', 'warn', 'error']);
    expect(logger.entries[1]!.context).toEqual({ a: 1 });
  });

  it('omits context when none was given', () => {
    const logger = createRecordingLogger();
    logger.info('no context');
    expect(logger.entries[0]).toEqual({ level: 'info', message: 'no context' });
  });
});

describe('createSilentLogger', () => {
  it('accepts every level without throwing', () => {
    const logger = createSilentLogger();
    expect(() => {
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
    }).not.toThrow();
  });
});

describe('createConsoleLogger', () => {
  it('suppresses levels below the threshold', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const logger = createConsoleLogger('warn');

    logger.debug('hidden');
    logger.info('hidden');
    expect(log).not.toHaveBeenCalled();

    log.mockRestore();
  });

  it('routes warnings to console.warn and errors to console.error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createConsoleLogger('debug');
    logger.warn('careful');
    logger.error('broken', { code: 1 });

    expect(warn).toHaveBeenCalledWith('[warn] careful');
    expect(error).toHaveBeenCalledWith('[error] broken {"code":1}');

    warn.mockRestore();
    error.mockRestore();
  });

  it('writes info to console.log', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    createConsoleLogger('info').info('hello');
    expect(log).toHaveBeenCalledWith('[info] hello');
    log.mockRestore();
  });
});

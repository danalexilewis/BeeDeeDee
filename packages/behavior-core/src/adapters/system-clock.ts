import type { ClockPort } from '../ports/clock.js';

/** The real clock. */
export function createSystemClock(): ClockPort {
  return {
    nowIso() {
      return new Date().toISOString();
    },
    monotonicMs() {
      return performance.now();
    },
  };
}

/**
 * A clock that advances only when told to, so tests can assert exact timestamps
 * and durations.
 */
export function createFixedClock(startIso = '2026-01-01T00:00:00.000Z'): ClockPort & {
  advanceMs(millis: number): void;
} {
  let current = new Date(startIso).getTime();
  let monotonic = 0;

  return {
    nowIso() {
      return new Date(current).toISOString();
    },
    monotonicMs() {
      return monotonic;
    },
    advanceMs(millis) {
      current += millis;
      monotonic += millis;
    },
  };
}

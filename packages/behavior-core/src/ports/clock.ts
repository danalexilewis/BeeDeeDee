/**
 * Time, as the application layer sees it.
 *
 * Injecting time keeps indexing timestamps and durations deterministic in tests
 * without freezing the global clock.
 */
export type ClockPort = {
  /** Current time as an ISO 8601 string, the wire format for timestamps. */
  nowIso(): string;

  /** Monotonic-ish millisecond reading, for measuring durations. */
  monotonicMs(): number;
};

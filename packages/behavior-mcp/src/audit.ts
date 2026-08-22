import type { ClockPort } from '@eddy/behavior-core';

/** One recorded agent interaction. */
export type AuditEntry = {
  at: string;
  tool: string;
  /** Arguments, with anything long truncated so the log stays readable. */
  input: Record<string, unknown>;
  outcome: 'ok' | 'error' | 'denied';
  detail?: string;
};

/**
 * Records every agent interaction.
 *
 * The design's security section asks for an audit trail: an agent acting on a
 * developer's specs should leave a record of what it asked for and what it was
 * allowed to do, particularly for denied writes.
 */
export type AuditLog = {
  record(entry: Omit<AuditEntry, 'at'>): void;
  entries(): readonly AuditEntry[];
};

/** Longest argument value kept verbatim before truncation. */
const MAX_VALUE_LENGTH = 200;

/** Shortens long values so one large payload cannot bury the rest of the log. */
export function summariseInput(input: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
      summary[key] = `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} chars)`;
      continue;
    }
    summary[key] = value;
  }

  return summary;
}

export type AuditLogOptions = {
  clock: ClockPort;
  /** Called for each entry, so a host can persist or display the trail. */
  sink?: (entry: AuditEntry) => void;
  /** Entries retained in memory; older ones are dropped. */
  limit?: number;
};

const DEFAULT_LIMIT = 500;

export function createAuditLog(options: AuditLogOptions): AuditLog {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const entries: AuditEntry[] = [];

  return {
    record(entry) {
      const full: AuditEntry = {
        at: options.clock.nowIso(),
        tool: entry.tool,
        input: summariseInput(entry.input),
        outcome: entry.outcome,
        ...(entry.detail === undefined ? {} : { detail: entry.detail }),
      };

      entries.push(full);
      if (entries.length > limit) entries.shift();

      options.sink?.(full);
    },

    entries() {
      return entries;
    },
  };
}

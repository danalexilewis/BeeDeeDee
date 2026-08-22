import type { LoggerPort } from '../ports/logger.js';

/** Log levels in ascending order of severity. */
const LEVELS = ['debug', 'info', 'warn', 'error'] as const;

type Level = (typeof LEVELS)[number];

/** A logger that writes to the console at or above the given level. */
export function createConsoleLogger(minimumLevel: Level = 'info'): LoggerPort {
  const threshold = LEVELS.indexOf(minimumLevel);

  function write(level: Level, message: string, context?: Record<string, unknown>): void {
    if (LEVELS.indexOf(level) < threshold) return;

    const line = `[${level}] ${message}`;
    const payload = context === undefined ? '' : ` ${JSON.stringify(context)}`;

    if (level === 'error') console.error(`${line}${payload}`);
    else if (level === 'warn') console.warn(`${line}${payload}`);
    else console.log(`${line}${payload}`);
  }

  return {
    debug(message, context) {
      write('debug', message, context);
    },
    info(message, context) {
      write('info', message, context);
    },
    warn(message, context) {
      write('warn', message, context);
    },
    error(message, context) {
      write('error', message, context);
    },
  };
}

/** A logger that discards everything, for tests and the MCP stdio transport. */
export function createSilentLogger(): LoggerPort {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

/** A logger that records calls, for asserting on log output in tests. */
export function createRecordingLogger(): LoggerPort & {
  entries: Array<{ level: Level; message: string; context?: Record<string, unknown> }>;
} {
  const entries: Array<{ level: Level; message: string; context?: Record<string, unknown> }> = [];

  function record(level: Level) {
    return function log(message: string, context?: Record<string, unknown>): void {
      entries.push(context === undefined ? { level, message } : { level, message, context });
    };
  }

  return {
    entries,
    debug: record('debug'),
    info: record('info'),
    warn: record('warn'),
    error: record('error'),
  };
}

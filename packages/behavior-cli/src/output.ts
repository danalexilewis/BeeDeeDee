import type { IndexStatus, LintResult } from '@eddy/behavior-contracts';
import { describeError, type BehaviorError } from '@eddy/behavior-core';

/** Where command output goes, injected so tests can capture it. */
export type OutputPort = {
  write(line: string): void;
  writeError(line: string): void;
};

/** Writes to the real streams. */
export function createStdioOutput(): OutputPort {
  return {
    write(line) {
      process.stdout.write(`${line}\n`);
    },
    writeError(line) {
      process.stderr.write(`${line}\n`);
    },
  };
}

/** Collects output in memory, for asserting on it. */
export function createMemoryOutput(): OutputPort & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];

  return {
    lines,
    errors,
    write(line) {
      lines.push(line);
    },
    writeError(line) {
      errors.push(line);
    },
  };
}

/** Reports a failure and yields the process exit code. */
export function reportError(output: OutputPort, error: BehaviorError): number {
  output.writeError(`error: ${describeError(error)}`);
  return 1;
}

/** Human-readable summary of an index scan. */
export function formatIndexStatus(status: IndexStatus): string[] {
  const lines = [
    `state:      ${status.state}`,
    `features:   ${status.featureCount}`,
    `scenarios:  ${status.scenarioCount}`,
    `diagrams:   ${status.diagramCount}`,
    `test files: ${status.testFileCount}`,
  ];

  if (status.durationMs !== null) lines.push(`duration:   ${status.durationMs}ms`);

  if (status.problems.length > 0) {
    lines.push('', `problems (${status.problems.length}):`);
    for (const problem of status.problems) {
      lines.push(`  ${problem.path}: ${problem.error.message}`);
    }
  }

  return lines;
}

/** Lint findings, one per line, in a form editors can parse. */
export function formatLintResults(results: readonly LintResult[]): string[] {
  if (results.length === 0) return ['No lint findings.'];

  return results.map(function toLine(result) {
    const position = result.line === undefined ? '' : `:${result.line}`;
    return `${result.path}${position} ${result.severity} ${result.rule}: ${result.message}`;
  });
}

/** True when any finding is severe enough to fail the command. */
export function hasLintErrors(results: readonly LintResult[]): boolean {
  return results.some(function isError(result) {
    return result.severity === 'error';
  });
}

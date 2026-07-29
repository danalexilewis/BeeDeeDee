import { Result } from 'neverthrow';
import type { ParsedDiagram } from '@eddy/behavior-contracts';
import type { MatchableTest } from '../domain/matching.js';
import { partitionResults, type BehaviorError } from '../errors.js';
import { parseGherkinContent, type ParsedFeatureDocument } from './gherkin.js';
import { parseMermaidContent } from './mermaid.js';
import { parseTestFileContent } from './test-file.js';

/** A file's path and contents, as handed to the parsers. */
export type SourceFile = {
  path: string;
  content: string;
};

/** Successful parses alongside the failures that did not stop them. */
export type BatchOutcome<T> = {
  values: T[];
  errors: BehaviorError[];
};

/**
 * Parses every feature file, keeping the good ones.
 *
 * Requirement 1.5: a file with a syntax error is reported with its line number
 * while the rest of the index continues. That rules out short-circuiting, and
 * also rules out `Result.combineWithAllErrors`, which collects all errors but
 * still returns a single `Err` and so discards the files that parsed.
 */
export function parseAllGherkin(
  files: readonly SourceFile[],
  featuresRoot: string
): BatchOutcome<ParsedFeatureDocument> {
  return partitionResults(
    files.map(function parseOne(file) {
      return parseGherkinContent({
        path: file.path,
        content: file.content,
        featuresRoot,
      });
    })
  );
}

/** Parses every diagram file, keeping the good ones. */
export function parseAllMermaid(
  files: readonly SourceFile[],
  diagramsRoot: string
): BatchOutcome<ParsedDiagram> {
  return partitionResults(
    files.map(function parseOne(file) {
      return parseMermaidContent({
        path: file.path,
        content: file.content,
        diagramsRoot,
      });
    })
  );
}

/** Parses every test file, flattening the discovered tests. */
export function parseAllTestFiles(files: readonly SourceFile[]): BatchOutcome<MatchableTest> {
  const outcome = partitionResults(
    files.map(function parseOne(file) {
      return parseTestFileContent({ path: file.path, content: file.content });
    })
  );

  return {
    values: outcome.values.flat(),
    errors: outcome.errors,
  };
}

/**
 * Requires every parse to succeed, reporting all failures rather than only the
 * first. Used where a partial result would be meaningless, such as validating an
 * explicit list of files the caller named.
 */
export function requireAll<T>(
  results: readonly Result<T, BehaviorError>[]
): Result<T[], BehaviorError[]> {
  return Result.combineWithAllErrors(results as Array<Result<T, BehaviorError>>);
}

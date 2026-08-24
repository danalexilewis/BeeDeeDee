import type { BehaviorErrorTag, ErrorBody } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';

/**
 * Every way an operation in the workbench can fail.
 *
 * The tags mirror `behaviorErrorTagSchema` in @eddy/behavior-contracts exactly;
 * `assertTagsMatchContract` below fails to compile if the two drift apart.
 * Nothing in the domain or application layers throws — failures travel as these
 * values inside a neverthrow `Result`.
 */
export type BehaviorError =
  | { tag: 'FileNotFound'; path: string }
  | { tag: 'ReadFailed'; path: string; reason: string }
  | { tag: 'GherkinSyntax'; path: string; line: number; column: number; detail: string }
  | { tag: 'MermaidSyntax'; path: string; line: number; detail: string }
  | { tag: 'SchemaValidation'; subject: string; issues: readonly SchemaIssue[] }
  | { tag: 'ScenarioNotFound'; scenarioId: string }
  | { tag: 'FeatureNotFound'; featureId: string }
  | { tag: 'DiagramNotFound'; diagramId: string }
  | { tag: 'ArchitectureMapNotFound'; mapId: string }
  | { tag: 'EditorNotSupported'; editor: string }
  | { tag: 'PathEscapesProject'; path: string }
  | { tag: 'UnsupportedReportFormat'; format: string }
  | { tag: 'IndexNotReady' };

/** A single schema validation failure, flattened for transport. */
export type SchemaIssue = {
  path: string;
  message: string;
};

/**
 * Compile-time proof that the core union and the contract enum describe the same
 * set of tags. Adding a tag to one without the other breaks the build here rather
 * than at runtime in the HTTP mapping.
 */
type TagsMatchContract = [BehaviorErrorTag] extends [BehaviorError['tag']]
  ? [BehaviorError['tag']] extends [BehaviorErrorTag]
    ? true
    : { error: 'core has a tag the contract does not declare' }
  : { error: 'the contract declares a tag core does not implement' };

export const assertTagsMatchContract: TagsMatchContract = true;

export function fileNotFound(path: string): BehaviorError {
  return { tag: 'FileNotFound', path };
}

export function readFailed(path: string, reason: string): BehaviorError {
  return { tag: 'ReadFailed', path, reason };
}

export function gherkinSyntax(
  path: string,
  line: number,
  column: number,
  detail: string
): BehaviorError {
  return { tag: 'GherkinSyntax', path, line, column, detail };
}

export function mermaidSyntax(path: string, line: number, detail: string): BehaviorError {
  return { tag: 'MermaidSyntax', path, line, detail };
}

export function schemaValidation(subject: string, issues: readonly SchemaIssue[]): BehaviorError {
  return { tag: 'SchemaValidation', subject, issues };
}

export function scenarioNotFound(scenarioId: string): BehaviorError {
  return { tag: 'ScenarioNotFound', scenarioId };
}

export function featureNotFound(featureId: string): BehaviorError {
  return { tag: 'FeatureNotFound', featureId };
}

export function diagramNotFound(diagramId: string): BehaviorError {
  return { tag: 'DiagramNotFound', diagramId };
}

export function architectureMapNotFound(mapId: string): BehaviorError {
  return { tag: 'ArchitectureMapNotFound', mapId };
}

export function editorNotSupported(editor: string): BehaviorError {
  return { tag: 'EditorNotSupported', editor };
}

export function pathEscapesProject(path: string): BehaviorError {
  return { tag: 'PathEscapesProject', path };
}

export function unsupportedReportFormat(format: string): BehaviorError {
  return { tag: 'UnsupportedReportFormat', format };
}

export function indexNotReady(): BehaviorError {
  return { tag: 'IndexNotReady' };
}

/** Human-readable rendering of an error, used in messages and logs. */
export function describeError(error: BehaviorError): string {
  switch (error.tag) {
    case 'FileNotFound':
      return `File not found: ${error.path}`;
    case 'ReadFailed':
      return `Could not read ${error.path}: ${error.reason}`;
    case 'GherkinSyntax':
      return `Gherkin syntax error in ${error.path} at ${error.line}:${error.column}: ${error.detail}`;
    case 'MermaidSyntax':
      return `Mermaid syntax error in ${error.path} at line ${error.line}: ${error.detail}`;
    case 'SchemaValidation': {
      const summary = error.issues
        .map(function toText(issue) {
          return issue.path.length > 0 ? `${issue.path}: ${issue.message}` : issue.message;
        })
        .join('; ');
      return `Invalid ${error.subject}: ${summary}`;
    }
    case 'ScenarioNotFound':
      return `Scenario not found: ${error.scenarioId}`;
    case 'FeatureNotFound':
      return `Feature not found: ${error.featureId}`;
    case 'DiagramNotFound':
      return `Diagram not found: ${error.diagramId}`;
    case 'ArchitectureMapNotFound':
      return `Architecture map not found: ${error.mapId}`;
    case 'EditorNotSupported':
      return `Editor not supported: ${error.editor}`;
    case 'PathEscapesProject':
      return `Path escapes the project root: ${error.path}`;
    case 'UnsupportedReportFormat':
      return `Unsupported test report format: ${error.format}`;
    case 'IndexNotReady':
      return 'The behavior index is not ready yet';
  }
}

/** Tag-specific context, kept separate from the message for machine consumers. */
function errorDetails(error: BehaviorError): Record<string, unknown> | undefined {
  switch (error.tag) {
    case 'FileNotFound':
    case 'PathEscapesProject':
      return { path: error.path };
    case 'ReadFailed':
      return { path: error.path, reason: error.reason };
    case 'GherkinSyntax':
      return { path: error.path, line: error.line, column: error.column };
    case 'MermaidSyntax':
      return { path: error.path, line: error.line };
    case 'SchemaValidation':
      return { subject: error.subject, issues: error.issues };
    case 'ScenarioNotFound':
      return { scenarioId: error.scenarioId };
    case 'FeatureNotFound':
      return { featureId: error.featureId };
    case 'DiagramNotFound':
      return { diagramId: error.diagramId };
    case 'ArchitectureMapNotFound':
      return { mapId: error.mapId };
    case 'EditorNotSupported':
      return { editor: error.editor };
    case 'UnsupportedReportFormat':
      return { format: error.format };
    case 'IndexNotReady':
      return undefined;
  }
}

/** Converts an error into its wire representation. */
export function toErrorBody(error: BehaviorError): ErrorBody {
  const details = errorDetails(error);
  return details === undefined
    ? { tag: error.tag, message: describeError(error) }
    : { tag: error.tag, message: describeError(error), details };
}

/**
 * Splits results into successes and failures.
 *
 * Requirement 1.5 says a malformed spec file must be reported without aborting
 * the rest of the index, so batch parsing partitions rather than short-circuits.
 * `Result.combineWithAllErrors` collects every error but still yields an `Err`
 * overall, which would discard the files that parsed cleanly.
 */
export function partitionResults<T>(results: readonly Result<T, BehaviorError>[]): {
  values: T[];
  errors: BehaviorError[];
} {
  const values: T[] = [];
  const errors: BehaviorError[] = [];

  for (const result of results) {
    if (result.isOk()) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return { values, errors };
}

/** Wraps a possibly-throwing call, converting the throw into a `ReadFailed`. */
export function tryRead<T>(path: string, operation: () => T): Result<T, BehaviorError> {
  try {
    return ok(operation());
  } catch (thrown) {
    return err(readFailed(path, thrown instanceof Error ? thrown.message : String(thrown)));
  }
}

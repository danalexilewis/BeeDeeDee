import {
  architectureMapDocumentSchema,
  type ArchitectureMap,
} from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { architectureMapIdFromPath } from '../domain/ids.js';
import { schemaValidation, type BehaviorError, type SchemaIssue } from '../errors.js';

export type ParseArchitectureMapInput = {
  path: string;
  content: string;
  /** Root the map id is made relative to. */
  mappingsRoot: string;
};

/** Flattens Zod issues for SchemaValidation. */
function toIssues(error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> }): SchemaIssue[] {
  return error.issues.map(function toIssue(issue) {
    return { path: issue.path.map(String).join('.'), message: issue.message };
  });
}

/**
 * Parses an architecture map JSON document.
 *
 * Invalid JSON or schema failures become SchemaValidation problems so indexing
 * can report the file and continue with the rest of the project.
 */
export function parseArchitectureMapContent(
  input: ParseArchitectureMapInput
): Result<ArchitectureMap, BehaviorError> {
  let raw: unknown;
  try {
    raw = JSON.parse(input.content);
  } catch (thrown) {
    return err(
      schemaValidation(input.path, [
        {
          path: '',
          message: thrown instanceof Error ? thrown.message : 'invalid JSON',
        },
      ])
    );
  }

  const parsed = architectureMapDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return err(schemaValidation(input.path, toIssues(parsed.error)));
  }

  const id = architectureMapIdFromPath(input.mappingsRoot, input.path);
  if (id.length === 0) {
    return err(
      schemaValidation(input.path, [
        { path: '', message: 'could not derive a map id from the file path' },
      ])
    );
  }

  return ok({
    ...parsed.data,
    id,
    path: input.path,
  });
}

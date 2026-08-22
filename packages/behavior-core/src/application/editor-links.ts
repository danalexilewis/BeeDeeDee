import type { EditorLink, EditorLinkQuery } from '@eddy/behavior-contracts';
import type { ResultAsync } from 'neverthrow';
import { errAsync, okAsync } from 'neverthrow';
import { buildEditorLinks } from '../domain/editor-links.js';
import { featureNotFound, scenarioNotFound, type BehaviorError } from '../errors.js';
import type { FileSystemPort } from '../ports/file-system.js';
import type { IndexStorePort } from '../ports/index-store.js';
import { testLinksFor } from './behavior-index.js';

export type EditorLinkDeps = {
  indexStore: IndexStorePort;
  fileSystem: FileSystemPort;
  /** Absolute path of the project root, needed for editor URLs. */
  projectRoot: string;
};

/** Joins the project root onto a relative path, for an absolute editor URL. */
function absolutePath(projectRoot: string, relativePath: string): string {
  const normalizedRoot = projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  return `${normalizedRoot}/${relativePath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

/**
 * Builds editor deep links for a scenario, feature, or test.
 *
 * Checks the target file exists first so the UI can disable a link rather than
 * opening an editor onto nothing, which Requirement 5 calls for.
 */
export function generateEditorLinks(
  deps: EditorLinkDeps,
  query: EditorLinkQuery
): ResultAsync<EditorLink[], BehaviorError> {
  const indexResult = deps.indexStore.read();
  if (indexResult.isErr()) return errAsync(indexResult.error);
  const index = indexResult.value;

  const target = resolveTarget();
  if (target === undefined) {
    return errAsync(
      query.target === 'feature' ? featureNotFound(query.id) : scenarioNotFound(query.id)
    );
  }

  const editorConfig =
    query.editor === undefined
      ? index.project.editorConfig
      : { ...index.project.editorConfig, supportedEditors: [query.editor] };

  return deps.fileSystem.fileExists(target.path).andThen(function build(targetExists) {
    return okAsync(
      buildEditorLinks(editorConfig, {
        absolutePath: absolutePath(deps.projectRoot, target.path),
        line: target.line,
        label: target.label,
        targetExists,
      })
    );
  });

  /** Locates the file and line the query refers to. */
  function resolveTarget(): { path: string; line: number; label: string } | undefined {
    if (query.target === 'feature') {
      const feature = index.features.get(query.id);
      return feature === undefined
        ? undefined
        : { path: feature.path, line: feature.line, label: feature.title };
    }

    if (query.target === 'scenario') {
      const scenario = index.scenarios.get(query.id);
      return scenario === undefined
        ? undefined
        : { path: scenario.featurePath, line: scenario.line, label: scenario.name };
    }

    // A test target is addressed by the scenario it covers, then its first link.
    const scenario = index.scenarios.get(query.id);
    if (scenario === undefined) return undefined;

    const link = testLinksFor(index, query.id)[0];
    return link === undefined
      ? undefined
      : { path: link.path, line: link.line, label: `Test for ${scenario.name}` };
  }
}

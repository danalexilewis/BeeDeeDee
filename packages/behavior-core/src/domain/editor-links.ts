import type { EditorConfig, EditorLink, EditorType } from '@eddy/behavior-contracts';

/**
 * Deep link templates per editor.
 *
 * `{path}` is substituted with an absolute path and `{line}` with a one-based
 * line number. VS Code and Cursor take a `file` authority; Kiro addresses specs
 * by fragment, and IntelliJ exposes an HTTP endpoint on its built-in server.
 */
const LINK_TEMPLATES: Record<EditorType, string> = {
  vscode: 'vscode://file/{path}:{line}',
  cursor: 'cursor://file/{path}:{line}',
  kiro: 'kiro://file/{path}#L{line}',
  intellij: 'http://localhost:63342/api/file/{path}:{line}',
};

const EDITOR_LABELS: Record<EditorType, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  kiro: 'Kiro',
  intellij: 'IntelliJ',
};

/** True when the editor has a known deep link format. */
export function isSupportedEditor(editor: string): editor is EditorType {
  return Object.hasOwn(LINK_TEMPLATES, editor);
}

/**
 * Percent-encodes a path for use in a URL while keeping separators readable.
 *
 * Encoding the whole path would escape the slashes editors need to resolve it, so
 * each segment is encoded individually.
 */
function encodePath(path: string): string {
  return path
    .split('/')
    .map(function encodeSegment(segment) {
      return encodeURIComponent(segment);
    })
    .join('/');
}

export type EditorLinkTarget = {
  /** Absolute path to the file the link should open. */
  absolutePath: string;
  line: number;
  /** Label shown alongside the editor name, e.g. the scenario name. */
  label: string;
  /** False when the file is missing, so the UI can disable the link. */
  targetExists: boolean;
};

/** Builds a deep link for one editor. */
export function buildEditorLink(editor: EditorType, target: EditorLinkTarget): EditorLink {
  const url = LINK_TEMPLATES[editor]
    .replace('{path}', encodePath(target.absolutePath))
    .replace('{line}', String(target.line));

  return {
    editor,
    url,
    label: `${target.label} in ${EDITOR_LABELS[editor]}`,
    path: target.absolutePath,
    line: target.line,
    targetExists: target.targetExists,
  };
}

/**
 * Builds links for every configured editor, in configuration order so the user's
 * preferred editor comes first. Unsupported entries are skipped rather than
 * failing, which is the fallback behaviour Requirement 5 asks for.
 */
export function buildEditorLinks(config: EditorConfig, target: EditorLinkTarget): EditorLink[] {
  return config.supportedEditors
    .filter(function isKnown(editor) {
      return isSupportedEditor(editor);
    })
    .map(function toLink(editor) {
      return buildEditorLink(editor, target);
    });
}

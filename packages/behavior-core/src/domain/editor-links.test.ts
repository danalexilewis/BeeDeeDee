import { describe, expect, it } from 'vitest';
import { buildEditorLink, buildEditorLinks, isSupportedEditor } from './editor-links.js';

const TARGET = {
  absolutePath: '/repo/specs/features/login.feature',
  line: 12,
  label: 'Successful login',
  targetExists: true,
};

describe('isSupportedEditor', () => {
  it.each(['vscode', 'cursor', 'kiro', 'intellij'])('accepts %o', editor => {
    expect(isSupportedEditor(editor)).toBe(true);
  });

  it.each(['emacs', 'vim', ''])('rejects %o', editor => {
    expect(isSupportedEditor(editor)).toBe(false);
  });
});

describe('buildEditorLink', () => {
  it.each([
    ['vscode', 'vscode://file//repo/specs/features/login.feature:12'],
    ['cursor', 'cursor://file//repo/specs/features/login.feature:12'],
    ['kiro', 'kiro://file//repo/specs/features/login.feature#L12'],
    ['intellij', 'http://localhost:63342/api/file//repo/specs/features/login.feature:12'],
  ] as const)('builds a %o link', (editor, expected) => {
    expect(buildEditorLink(editor, TARGET).url).toBe(expected);
  });

  it('labels the link with the target and editor name', () => {
    expect(buildEditorLink('vscode', TARGET).label).toBe('Successful login in VS Code');
  });

  it('preserves path separators while encoding segments', () => {
    const link = buildEditorLink('vscode', {
      ...TARGET,
      absolutePath: '/repo/specs/my features/log in.feature',
    });
    expect(link.url).toBe('vscode://file//repo/specs/my%20features/log%20in.feature:12');
  });

  it('encodes a segment containing a question mark', () => {
    const link = buildEditorLink('vscode', { ...TARGET, absolutePath: '/repo/a?b.feature' });
    expect(link.url).toContain('a%3Fb.feature');
  });

  it('carries the missing-target flag through', () => {
    expect(buildEditorLink('vscode', { ...TARGET, targetExists: false }).targetExists).toBe(false);
  });
});

describe('buildEditorLinks', () => {
  it('builds one link per configured editor, in configuration order', () => {
    const links = buildEditorLinks(
      { supportedEditors: ['cursor', 'vscode'], openCommand: 'cursor' },
      TARGET
    );
    expect(links.map(link => link.editor)).toEqual(['cursor', 'vscode']);
  });

  it('skips an unsupported editor rather than failing', () => {
    const links = buildEditorLinks(
      { supportedEditors: ['vscode', 'emacs' as never], openCommand: 'code' },
      TARGET
    );
    expect(links.map(link => link.editor)).toEqual(['vscode']);
  });

  it('returns nothing when no configured editor is supported', () => {
    expect(
      buildEditorLinks({ supportedEditors: ['emacs' as never], openCommand: 'emacs' }, TARGET)
    ).toEqual([]);
  });
});

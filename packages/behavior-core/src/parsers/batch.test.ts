import { err, ok } from 'neverthrow';
import { describe, expect, it } from 'vitest';
import { fileNotFound, indexNotReady } from '../errors.js';
import { parseAllGherkin, parseAllMermaid, parseAllTestFiles, requireAll } from './batch.js';

const VALID_FEATURE = `Feature: Login
  Scenario: Works
    Given x
`;

const BROKEN_FEATURE = `Feature: Broken
  Scenario: S
    Given x
  Nonsense that is not Gherkin
`;

describe('parseAllGherkin', () => {
  it('keeps the files that parsed and reports the one that did not', () => {
    const outcome = parseAllGherkin(
      [
        { path: 'specs/features/a.feature', content: VALID_FEATURE },
        { path: 'specs/features/broken.feature', content: BROKEN_FEATURE },
        { path: 'specs/features/b.feature', content: VALID_FEATURE },
      ],
      'specs/features'
    );

    expect(outcome.values.map(f => f.featureId)).toEqual(['a', 'b']);
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]!.tag).toBe('GherkinSyntax');
  });

  it('reports the path and line of each failure', () => {
    const outcome = parseAllGherkin(
      [{ path: 'specs/features/broken.feature', content: BROKEN_FEATURE }],
      'specs/features'
    );

    const error = outcome.errors[0]!;
    if (error.tag === 'GherkinSyntax') {
      expect(error.path).toBe('specs/features/broken.feature');
      expect(error.line).toBe(4);
    }
  });

  it('returns empty results for no files', () => {
    expect(parseAllGherkin([], 'specs/features')).toEqual({ values: [], errors: [] });
  });

  it('reports every failure when nothing parses', () => {
    const outcome = parseAllGherkin(
      [
        { path: 'a.feature', content: '' },
        { path: 'b.feature', content: '' },
      ],
      ''
    );
    expect(outcome.values).toEqual([]);
    expect(outcome.errors).toHaveLength(2);
  });
});

describe('parseAllMermaid', () => {
  it('keeps valid diagrams and reports invalid ones', () => {
    const outcome = parseAllMermaid(
      [
        { path: 'specs/diagrams/a.mmd', content: 'flowchart TD\n  a --> b\n' },
        { path: 'specs/diagrams/bad.mmd', content: 'not a diagram\n' },
      ],
      'specs/diagrams'
    );

    expect(outcome.values.map(d => d.id)).toEqual(['a']);
    expect(outcome.errors[0]!.tag).toBe('MermaidSyntax');
  });
});

describe('parseAllTestFiles', () => {
  it('flattens tests across files', () => {
    const outcome = parseAllTestFiles([
      { path: 'a.spec.ts', content: "test('one', () => {});" },
      { path: 'b.spec.ts', content: "test('two', () => {});\ntest('three', () => {});" },
    ]);

    expect(outcome.values).toHaveLength(3);
    expect(outcome.errors).toEqual([]);
  });

  it('returns nothing for files with no tests', () => {
    const outcome = parseAllTestFiles([{ path: 'a.ts', content: 'export const x = 1;' }]);
    expect(outcome.values).toEqual([]);
  });
});

describe('requireAll', () => {
  it('collects the values when everything succeeds', () => {
    const result = requireAll([ok(1), ok(2)]);
    expect(result._unsafeUnwrap()).toEqual([1, 2]);
  });

  it('collects every error rather than only the first', () => {
    const result = requireAll([ok(1), err(fileNotFound('a')), err(indexNotReady())]);
    expect(result.isErr()).toBe(true);
    const errors = result._unsafeUnwrapErr();
    expect(errors.map(e => e.tag)).toEqual(['FileNotFound', 'IndexNotReady']);
  });

  it('succeeds on an empty list', () => {
    expect(requireAll([])._unsafeUnwrap()).toEqual([]);
  });
});

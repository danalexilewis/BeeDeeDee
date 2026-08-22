import { describe, expect, it } from 'vitest';
import { lintFeature, lintFeatures, type LintableFeature } from './lint.js';

function feature(overrides: Partial<LintableFeature> = {}): LintableFeature {
  return {
    path: 'specs/features/login.feature',
    title: 'Login',
    description: 'Users sign in.',
    tags: ['@auth'],
    line: 2,
    scenarios: [
      {
        name: 'Successful login',
        line: 5,
        tags: [],
        steps: [
          { keyword: 'Given ', text: 'a user', line: 6 },
          { keyword: 'When ', text: 'they sign in', line: 7 },
          { keyword: 'Then ', text: 'they see the dashboard', line: 8 },
        ],
      },
    ],
    ...overrides,
  };
}

/** Rule ids present in a lint run. */
function rulesOf(target: LintableFeature): string[] {
  return lintFeature(target).map(result => result.rule);
}

describe('lintFeature', () => {
  it('reports nothing for a well-formed feature', () => {
    expect(lintFeature(feature())).toEqual([]);
  });

  it('reports a missing feature description', () => {
    expect(rulesOf(feature({ description: '   ' }))).toContain('missing-feature-description');
  });

  it('reports an untagged feature', () => {
    expect(rulesOf(feature({ tags: [] }))).toContain('untagged-feature');
  });

  it('reports a scenario with no name', () => {
    const results = lintFeature(
      feature({
        scenarios: [
          { name: '  ', line: 5, tags: [], steps: [{ keyword: 'Given ', text: 'x', line: 6 }] },
        ],
      })
    );
    const found = results.find(result => result.rule === 'missing-scenario-name');
    expect(found?.severity).toBe('error');
  });

  it('reports a duplicate scenario name and points at the first', () => {
    const results = lintFeature(
      feature({
        scenarios: [
          { name: 'Retry', line: 5, tags: [], steps: [{ keyword: 'Given ', text: 'x', line: 6 }] },
          { name: 'retry', line: 9, tags: [], steps: [{ keyword: 'Given ', text: 'x', line: 10 }] },
        ],
      })
    );

    const duplicate = results.find(result => result.rule === 'duplicate-scenario-name');
    expect(duplicate?.line).toBe(9);
    expect(duplicate?.message).toContain('line 5');
  });

  it('reports an empty scenario', () => {
    expect(
      rulesOf(feature({ scenarios: [{ name: 'S', line: 5, tags: [], steps: [] }] }))
    ).toContain('empty-scenario');
  });

  it('reports a scenario opening with And, and suggests Given', () => {
    const results = lintFeature(
      feature({
        scenarios: [
          { name: 'S', line: 5, tags: [], steps: [{ keyword: 'And ', text: 'x', line: 6 }] },
        ],
      })
    );

    const finding = results.find(result => result.rule === 'inconsistent-step-keyword');
    expect(finding?.suggestedFix).toEqual({ from: 'And', to: 'Given' });
  });

  it('reports a scenario with no Given', () => {
    expect(
      rulesOf(
        feature({
          scenarios: [
            {
              name: 'S',
              line: 5,
              tags: [],
              steps: [{ keyword: 'When ', text: 'x', line: 6 }],
            },
          ],
        })
      )
    ).toContain('step-without-given');
  });

  it('does not report a missing Given for an already-empty scenario', () => {
    const rules = rulesOf(feature({ scenarios: [{ name: 'S', line: 5, tags: [], steps: [] }] }));
    expect(rules).toContain('empty-scenario');
    expect(rules).not.toContain('step-without-given');
  });

  it('reports a scenario with more than ten steps', () => {
    const steps = Array.from({ length: 11 }, function toStep(_unused, index) {
      return { keyword: index === 0 ? 'Given ' : 'And ', text: `step ${index}`, line: 6 + index };
    });
    expect(rulesOf(feature({ scenarios: [{ name: 'S', line: 5, tags: [], steps }] }))).toContain(
      'too-many-steps'
    );
  });

  it('accepts exactly ten steps', () => {
    const steps = Array.from({ length: 10 }, function toStep(_unused, index) {
      return { keyword: index === 0 ? 'Given ' : 'And ', text: `step ${index}`, line: 6 + index };
    });
    expect(
      rulesOf(feature({ scenarios: [{ name: 'S', line: 5, tags: [], steps }] }))
    ).not.toContain('too-many-steps');
  });

  it('orders findings by line', () => {
    const results = lintFeature(
      feature({
        description: '',
        tags: [],
        scenarios: [
          { name: 'S', line: 20, tags: [], steps: [] },
          { name: 'T', line: 10, tags: [], steps: [] },
        ],
      })
    );

    const lines = results.map(result => result.line ?? 0);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });
});

describe('lintFeatures', () => {
  it('aggregates findings across features', () => {
    const results = lintFeatures([feature({ tags: [] }), feature({ description: '' })]);
    expect(results.length).toBe(2);
  });

  it('returns nothing for no features', () => {
    expect(lintFeatures([])).toEqual([]);
  });
});

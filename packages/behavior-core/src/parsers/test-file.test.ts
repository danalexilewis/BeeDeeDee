import { describe, expect, it } from 'vitest';
import { detectFramework, parseTestFileContent, tagsInTitle } from './test-file.js';

function parse(content: string, path = 'tests/e2e/login.spec.ts') {
  return parseTestFileContent({ path, content })._unsafeUnwrap();
}

describe('detectFramework', () => {
  it.each([
    ["import { test } from '@playwright/test';", 'playwright'],
    ["import { describe, it } from 'vitest';", 'vitest'],
    ["import { describe } from '@jest/globals';", 'jest'],
    ['describe("x", () => {});', 'custom'],
  ])('detects %o as %o', (content, expected) => {
    expect(detectFramework(content)).toBe(expected);
  });
});

describe('tagsInTitle', () => {
  it('extracts Gherkin-style tags', () => {
    expect(tagsInTitle('logs in @smoke @scenario:login/happy')).toEqual([
      '@smoke',
      '@scenario:login/happy',
    ]);
  });

  it('returns an empty array when there are none', () => {
    expect(tagsInTitle('logs in')).toEqual([]);
  });
});

describe('parseTestFileContent', () => {
  it('extracts a test name and line number', () => {
    const tests = parse(`import { test } from '@playwright/test';

test('logs in successfully', async () => {});
`);
    expect(tests).toHaveLength(1);
    expect(tests[0]!.name).toBe('logs in successfully');
    expect(tests[0]!.line).toBe(3);
    expect(tests[0]!.framework).toBe('playwright');
    expect(tests[0]!.testId).toBe('tests/e2e/login.spec.ts:3');
  });

  it.each([
    ["test('a', () => {});", 'a'],
    ['test("a", () => {});', 'a'],
    ['test(`a`, () => {});', 'a'],
    ["it('a', () => {});", 'a'],
    ["test.only('a', () => {});", 'a'],
    ["test.skip('a', () => {});", 'a'],
    ["it.todo('a');", 'a'],
    ["test.concurrent('a', () => {});", 'a'],
  ])('handles declaration %o', (content, expected) => {
    expect(parse(content)[0]?.name).toBe(expected);
  });

  it('prefixes a test with its enclosing describe title', () => {
    const tests = parse(`describe('Login', () => {
  test('succeeds', () => {});
});
`);
    expect(tests[0]!.name).toBe('Login succeeds');
  });

  it('uses the nearest preceding describe for several tests', () => {
    const tests = parse(`describe('Login', () => {
  test('succeeds', () => {});
});
describe('Logout', () => {
  test('succeeds', () => {});
});
`);
    expect(tests.map(t => t.name)).toEqual(['Login succeeds', 'Logout succeeds']);
  });

  it('extracts tags from the composed name', () => {
    const tests = parse(`describe('@auth Login', () => {
  test('succeeds @smoke', () => {});
});
`);
    expect(tests[0]!.tags).toEqual(['@auth', '@smoke']);
  });

  it('skips titles with template interpolation', () => {
    expect(parse('test(`logs in as ${role}`, () => {});')).toEqual([]);
  });

  it('finds several tests with distinct ids', () => {
    const tests = parse(`test('a', () => {});
test('b', () => {});
`);
    expect(tests.map(t => t.line)).toEqual([1, 2]);
    expect(new Set(tests.map(t => t.testId)).size).toBe(2);
  });

  it('returns an empty array for a file with no tests', () => {
    expect(parse('export const helper = 1;\n')).toEqual([]);
  });

  it('returns an empty array rather than failing on unparseable input', () => {
    const result = parseTestFileContent({ path: 'x.spec.ts', content: '\u0000\u0001}}{{' });
    expect(result.isOk()).toBe(true);
  });

  it('respects an explicit framework override', () => {
    const result = parseTestFileContent({
      path: 'x.spec.ts',
      content: "test('a', () => {});",
      framework: 'vitest',
    })._unsafeUnwrap();
    expect(result[0]!.framework).toBe('vitest');
  });

  it('handles escaped quotes inside a title', () => {
    expect(parse(`test('it\\'s fine', () => {});`)[0]?.name).toBe("it\\'s fine");
  });

  it('does not treat a word ending in test as a declaration', () => {
    expect(parse('const latest = 1;\nmyTest("a", () => {});\n')).toEqual([]);
  });
});

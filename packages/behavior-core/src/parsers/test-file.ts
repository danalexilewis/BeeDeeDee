import type { TestFramework } from '@eddy/behavior-contracts';
import { ok, type Result } from 'neverthrow';
import type { MatchableTest } from '../domain/matching.js';
import { testIdFrom } from '../domain/ids.js';
import type { BehaviorError } from '../errors.js';

export type ParseTestFileInput = {
  path: string;
  content: string;
  /** Overrides framework detection, for callers that already know. */
  framework?: TestFramework;
};

/** Import specifiers that identify a test framework. */
const FRAMEWORK_MARKERS: ReadonlyArray<{ framework: TestFramework; pattern: RegExp }> = [
  { framework: 'playwright', pattern: /@playwright\/test/ },
  { framework: 'vitest', pattern: /\bfrom\s+['"]vitest['"]/ },
  { framework: 'jest', pattern: /@jest\/globals/ },
];

/**
 * Infers the framework from imports, falling back to `custom`.
 *
 * Jest is the fallback for a file using bare globals with no import, since Jest is
 * the only common runner that injects `test` and `describe` without one.
 */
export function detectFramework(content: string): TestFramework {
  for (const marker of FRAMEWORK_MARKERS) {
    if (marker.pattern.test(content)) return marker.framework;
  }
  return 'custom';
}

/**
 * Matches `test('name'`, `it("name"`, and their `.only` / `.skip` / `.each`
 * variants, plus template-literal titles without interpolation.
 */
const TEST_PATTERN =
  /\b(?:test|it)\s*(?:\.\s*(?:only|skip|todo|fails|concurrent|sequential|each)\s*(?:\([^)]*\))?\s*)*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** Matches `describe('name'` blocks, used to qualify nested test names. */
const DESCRIBE_PATTERN =
  /\b(?:describe|suite)\s*(?:\.\s*(?:only|skip|todo|each|concurrent|sequential)\s*(?:\([^)]*\))?\s*)*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

/** Gherkin-style tags embedded in a test title. */
const TAG_PATTERN = /@[A-Za-z0-9_:./-]+/g;

/** Reads `@tag` tokens out of a test title. */
export function tagsInTitle(title: string): string[] {
  return [...title.matchAll(TAG_PATTERN)].map(function toTag(match) {
    return match[0];
  });
}

/** One-based line number of a character offset within the content. */
function lineAt(content: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < content.length; index += 1) {
    if (content[index] === '\n') line += 1;
  }
  return line;
}

/** A describe block's title and the offset range it plausibly covers. */
type DescribeBlock = {
  title: string;
  start: number;
};

/** Collects describe titles with their offsets, in source order. */
function collectDescribes(content: string): DescribeBlock[] {
  const blocks: DescribeBlock[] = [];

  for (const match of content.matchAll(DESCRIBE_PATTERN)) {
    if (match.index === undefined || match[2] === undefined) continue;
    blocks.push({ title: match[2], start: match.index });
  }

  return blocks;
}

/**
 * The nearest preceding describe title, used as a prefix.
 *
 * This is a heuristic: it does not track brace depth, so a test following a
 * closed describe block is still attributed to it. Test-to-scenario matching
 * tolerates that, since the prefix only ever adds tokens to compare.
 */
function enclosingDescribe(blocks: readonly DescribeBlock[], offset: number): string | undefined {
  let nearest: string | undefined;
  for (const block of blocks) {
    if (block.start < offset) nearest = block.title;
    else break;
  }
  return nearest;
}

/**
 * Extracts every test declaration from a test file.
 *
 * Never fails: an unparseable file simply yields no tests, because a test file
 * the workbench cannot read is not a spec error worth blocking the index for.
 */
export function parseTestFileContent(
  input: ParseTestFileInput
): Result<MatchableTest[], BehaviorError> {
  const framework = input.framework ?? detectFramework(input.content);
  const describes = collectDescribes(input.content);
  const tests: MatchableTest[] = [];

  for (const match of input.content.matchAll(TEST_PATTERN)) {
    if (match.index === undefined || match[2] === undefined) continue;

    const title = match[2];
    // Skip interpolated titles: the runtime value is unknowable from source.
    if (title.includes('${')) continue;

    const line = lineAt(input.content, match.index);
    const prefix = enclosingDescribe(describes, match.index);
    const fullName = prefix === undefined ? title : `${prefix} ${title}`;

    tests.push({
      testId: testIdFrom(input.path, line),
      name: fullName,
      framework,
      path: input.path,
      line,
      tags: tagsInTitle(fullName),
    });
  }

  return ok(tests);
}

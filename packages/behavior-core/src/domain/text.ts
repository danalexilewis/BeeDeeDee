/** Shared text helpers for the scoring and matching heuristics. */

/** Words too common to carry signal when comparing specs to diagrams or tests. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'given',
  'has',
  'have',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'should',
  'the',
  'then',
  'to',
  'when',
  'with',
]);

/**
 * Splits text into lowercase content words, dropping stop words, punctuation, and
 * single characters. Also splits camelCase and snake_case so `loginUser` and
 * `login_user` both yield `login` and `user`.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-/.]+/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(function isMeaningful(token) {
      return token.length > 1 && !STOP_WORDS.has(token);
    });
}

/** Unique tokens from a set of strings. */
export function tokenSet(texts: readonly string[]): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    for (const token of tokenize(text)) {
      tokens.add(token);
    }
  }
  return tokens;
}

/**
 * Overlap coefficient: shared tokens over the size of the smaller set. Preferred
 * over Jaccard here because a short scenario name should still score highly
 * against a large diagram that fully covers it.
 */
export function overlapCoefficient(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  for (const token of smaller) {
    if (larger.has(token)) shared += 1;
  }

  return shared / smaller.size;
}

/** Strips a leading `@` from a tag so `@smoke` and `smoke` compare equal. */
export function normalizeTag(tag: string): string {
  return tag.replace(/^@+/, '').toLowerCase();
}

/** Lowercases and collapses whitespace, for comparing names for equality. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Clamps a number into the inclusive range 0 to 1. */
export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

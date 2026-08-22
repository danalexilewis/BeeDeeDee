import fc from 'fast-check';

/** Timestamps within a fixed window, so failures reproduce with readable dates. */
const EPOCH_START = Date.UTC(2026, 0, 1);
const EPOCH_END = Date.UTC(2026, 11, 31);

/** ISO 8601 timestamp string, matching `isoDateTimeSchema`. */
export const arbIsoDateTime: fc.Arbitrary<string> = fc
  .integer({ min: EPOCH_START, max: EPOCH_END })
  .map(function toIso(millis) {
    return new Date(millis).toISOString();
  });

/** Short lowercase word, the building block for names and tags. */
export const arbWord: fc.Arbitrary<string> = fc.stringMatching(/^[a-z]{2,10}$/);

/** Human-readable phrase such as a scenario or test name. */
export const arbPhrase: fc.Arbitrary<string> = fc
  .array(arbWord, { minLength: 1, maxLength: 5 })
  .map(function toPhrase(words) {
    return words.join(' ');
  });

/** Gherkin tag including the leading `@`. */
export const arbTag: fc.Arbitrary<string> = arbWord.map(function toTag(word) {
  return `@${word}`;
});

/** POSIX-style relative file path with the given extension. */
export function arbPath(extension: string): fc.Arbitrary<string> {
  return fc.array(arbWord, { minLength: 1, maxLength: 3 }).map(function toPath(segments) {
    return `${segments.join('/')}${extension}`;
  });
}

/** One-based line number. */
export const arbLine: fc.Arbitrary<number> = fc.integer({ min: 1, max: 500 });

import { describe, expect, it } from 'vitest';
import {
  clamp01,
  normalizeName,
  normalizeTag,
  overlapCoefficient,
  tokenSet,
  tokenize,
} from './text.js';

describe('tokenize', () => {
  it('lowercases and splits on punctuation', () => {
    expect(tokenize('Successful login!')).toEqual(['successful', 'login']);
  });

  it('drops stop words and Gherkin keywords', () => {
    expect(tokenize('Given the user is in the system')).toEqual(['user', 'system']);
  });

  it('drops single characters', () => {
    expect(tokenize('a b cd')).toEqual(['cd']);
  });

  it('splits camelCase', () => {
    expect(tokenize('loginUser')).toEqual(['login', 'user']);
  });

  it('splits snake_case, kebab-case, and paths', () => {
    expect(tokenize('login_user')).toEqual(['login', 'user']);
    expect(tokenize('login-user')).toEqual(['login', 'user']);
    expect(tokenize('specs/features/login.feature')).toEqual([
      'specs',
      'features',
      'login',
      'feature',
    ]);
  });

  it('returns an empty array for text with no content words', () => {
    expect(tokenize('the a of')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('tokenSet', () => {
  it('deduplicates tokens across inputs', () => {
    expect(tokenSet(['login user', 'user login'])).toEqual(new Set(['login', 'user']));
  });

  it('is empty for no inputs', () => {
    expect(tokenSet([]).size).toBe(0);
  });
});

describe('overlapCoefficient', () => {
  it('is 1 when the smaller set is fully contained', () => {
    expect(overlapCoefficient(new Set(['a']), new Set(['a', 'b', 'c']))).toBe(1);
  });

  it('is 0 with no shared tokens', () => {
    expect(overlapCoefficient(new Set(['a']), new Set(['b']))).toBe(0);
  });

  it('is 0 when either set is empty', () => {
    expect(overlapCoefficient(new Set(), new Set(['a']))).toBe(0);
    expect(overlapCoefficient(new Set(['a']), new Set())).toBe(0);
  });

  it('is symmetric', () => {
    const left = new Set(['a', 'b']);
    const right = new Set(['b', 'c', 'd']);
    expect(overlapCoefficient(left, right)).toBe(overlapCoefficient(right, left));
  });

  it('divides by the smaller set size', () => {
    expect(overlapCoefficient(new Set(['a', 'b']), new Set(['a', 'c', 'd']))).toBe(0.5);
  });
});

describe('normalizeTag', () => {
  it.each([
    ['@smoke', 'smoke'],
    ['@@smoke', 'smoke'],
    ['SMOKE', 'smoke'],
    ['smoke', 'smoke'],
  ])('normalises %o to %o', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });
});

describe('normalizeName', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeName('  Successful   LOGIN \n')).toBe('successful login');
  });
});

describe('clamp01', () => {
  it.each([
    [0.5, 0.5],
    [0, 0],
    [1, 1],
    [-0.2, 0],
    [1.7, 1],
    [Number.NEGATIVE_INFINITY, 0],
    [Number.POSITIVE_INFINITY, 1],
  ])('clamps %o to %o', (input, expected) => {
    expect(clamp01(input)).toBe(expected);
  });

  it('maps NaN to 0 rather than propagating it into a score', () => {
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

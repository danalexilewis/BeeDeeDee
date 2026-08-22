import { describe, expect, it } from 'vitest';
import {
  assignScenarioIds,
  diagramIdFromPath,
  featureIdFromPath,
  scenarioIdFrom,
  slugify,
  stepIdFrom,
  testIdFrom,
} from './ids.js';

describe('slugify', () => {
  it.each([
    ['Successful login', 'successful-login'],
    ['User  logs   in', 'user-logs-in'],
    ['Payment (declined)', 'payment-declined'],
    ['Café checkout', 'cafe-checkout'],
    ['---leading and trailing---', 'leading-and-trailing'],
    ['ALL CAPS', 'all-caps'],
    ['snake_case_name', 'snake-case-name'],
  ])('turns %o into %o', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing survives normalisation', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('featureIdFromPath', () => {
  it('strips the features root and the extension', () => {
    expect(featureIdFromPath('specs/features', 'specs/features/login.feature')).toBe('login');
  });

  it('joins nested directories with the id separator, not a slash', () => {
    expect(featureIdFromPath('specs/features', 'specs/features/auth/login.feature')).toBe(
      'auth.login'
    );
  });

  it('normalises Windows separators', () => {
    expect(featureIdFromPath('specs\\features', 'specs\\features\\auth\\login.feature')).toBe(
      'auth.login'
    );
  });

  it('tolerates a trailing slash on the root', () => {
    expect(featureIdFromPath('specs/features/', 'specs/features/login.feature')).toBe('login');
  });

  it('tolerates a leading ./ on the path', () => {
    expect(featureIdFromPath('specs/features', './specs/features/login.feature')).toBe('login');
  });

  it('slugifies segments that are not already slugs', () => {
    expect(featureIdFromPath('specs/features', 'specs/features/User Auth/Log In.feature')).toBe(
      'user-auth.log-in'
    );
  });

  it('is case insensitive about the extension', () => {
    expect(featureIdFromPath('specs/features', 'specs/features/login.FEATURE')).toBe('login');
  });

  it('falls back to the whole path when the root does not match', () => {
    expect(featureIdFromPath('specs/features', 'elsewhere/login.feature')).toBe('elsewhere.login');
  });
});

describe('diagramIdFromPath', () => {
  it.each([
    ['specs/diagrams/auth.mmd', 'auth'],
    ['specs/diagrams/auth.mermaid', 'auth'],
    ['specs/diagrams/flows/auth.puml', 'flows.auth'],
    ['specs/diagrams/auth.drawio', 'auth'],
  ])('derives an id from %o', (path, expected) => {
    expect(diagramIdFromPath('specs/diagrams', path)).toBe(expected);
  });
});

describe('scenarioIdFrom', () => {
  it('joins the feature id and the scenario slug', () => {
    expect(scenarioIdFrom('login', 'Successful login', 1)).toBe('login.successful-login');
  });

  it('falls back to the ordinal when the name yields no slug', () => {
    expect(scenarioIdFrom('login', '???', 3)).toBe('login.scenario-3');
  });
});

describe('assignScenarioIds', () => {
  it('leaves distinct names untouched', () => {
    expect(assignScenarioIds('login', ['Happy path', 'Locked account'])).toEqual([
      'login.happy-path',
      'login.locked-account',
    ]);
  });

  it('disambiguates duplicate names by ordinal suffix', () => {
    expect(assignScenarioIds('login', ['Retry', 'Retry', 'Retry'])).toEqual([
      'login.retry',
      'login.retry-2',
      'login.retry-3',
    ]);
  });

  it('produces unique ids for any input', () => {
    const ids = assignScenarioIds('f', ['A', 'A', 'B', 'A', 'B']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns an empty array for a feature with no scenarios', () => {
    expect(assignScenarioIds('login', [])).toEqual([]);
  });
});

describe('ids are safe to use as URL path segments', () => {
  const samples = [
    featureIdFromPath('specs/features', 'specs/features/auth/deep/nested/login.feature'),
    featureIdFromPath('specs/features', 'specs/features/User Auth/Log In.feature'),
    diagramIdFromPath('specs/diagrams', 'specs/diagrams/flows/auth.mmd'),
    ...assignScenarioIds('auth.login', [
      'Successful login',
      'Successful login',
      'Payment (declined)',
    ]),
  ];

  it.each(samples)('leaves %o unchanged by URI encoding', id => {
    // Ids travel as path segments in the API, the SPA routes, and MCP resource
    // URIs. Anything needing encoding would 404 wherever encoding was forgotten.
    expect(encodeURIComponent(id)).toBe(id);
  });

  it.each(samples)('keeps %o free of slashes', id => {
    expect(id).not.toContain('/');
  });
});

describe('testIdFrom', () => {
  it('combines path and line', () => {
    expect(testIdFrom('tests/e2e/login.spec.ts', 12)).toBe('tests/e2e/login.spec.ts:12');
  });

  it('normalises Windows separators so ids match across platforms', () => {
    expect(testIdFrom('tests\\e2e\\login.spec.ts', 12)).toBe('tests/e2e/login.spec.ts:12');
  });
});

describe('stepIdFrom', () => {
  it('numbers steps from one', () => {
    expect(stepIdFrom('login.happy-path', 0)).toBe('login.happy-path#step-1');
  });
});

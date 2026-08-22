import { describe, expect, it } from 'vitest';
import { behaviorContract } from './contract.js';
import { behaviorErrorTagSchema } from './schemas/error.js';

type AnyRoute = {
  method: string;
  path: string;
  responses: Record<string, unknown>;
  body?: unknown;
  query?: unknown;
  summary?: string;
};

const routes = Object.entries(behaviorContract) as Array<[string, AnyRoute]>;

/** Path params written into a route path, e.g. `:featureId`. */
function pathParamsOf(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map(function toName(match) {
    return match[1]!;
  });
}

describe('behaviorContract shape', () => {
  it('declares the thirteen planned routes', () => {
    expect(routes.map(([key]) => key).sort()).toEqual(
      [
        'getAgentContext',
        'getCatalog',
        'getDiagram',
        'getEditorLinks',
        'getFeature',
        'getIndexStatus',
        'getScenario',
        'getTestStatus',
        'ingestTestResults',
        'lintSpecs',
        'listFeatures',
        'refreshIndex',
        'validateGherkin',
      ].sort()
    );
  });

  it('prefixes every path with /api', () => {
    for (const [key, route] of routes) {
      expect(route.path, `${key} should be namespaced under /api`).toMatch(/^\/api\//);
    }
  });

  it('uses only GET and POST', () => {
    for (const [key, route] of routes) {
      expect(['GET', 'POST'], `${key} uses an unexpected method`).toContain(route.method);
    }
  });

  it('gives every route a summary', () => {
    for (const [key, route] of routes) {
      expect(route.summary, `${key} is missing a summary`).toBeTruthy();
    }
  });

  it('has no duplicate method and path pairs', () => {
    const seen = routes.map(([, route]) => `${route.method} ${route.path}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('never puts a body on a GET route', () => {
    for (const [key, route] of routes) {
      if (route.method === 'GET') {
        expect(route.body, `${key} is a GET but declares a body`).toBeUndefined();
      }
    }
  });

  it('always puts a body on a POST route', () => {
    for (const [key, route] of routes) {
      if (route.method === 'POST') {
        expect(route.body, `${key} is a POST but declares no body`).toBeDefined();
      }
    }
  });
});

describe('behaviorContract error coverage', () => {
  it('maps a 500 onto every route via commonResponses', () => {
    for (const [key, route] of routes) {
      expect(Object.keys(route.responses), `${key} is missing a 500`).toContain('500');
    }
  });

  it('declares a failure response on every route', () => {
    for (const [key, route] of routes) {
      const failureCodes = Object.keys(route.responses).filter(function isFailure(code) {
        return Number(code) >= 400;
      });
      expect(failureCodes.length, `${key} declares no failure response`).toBeGreaterThan(0);
    }
  });

  it('declares a 404 on every route that takes a path parameter', () => {
    for (const [key, route] of routes) {
      if (pathParamsOf(route.path).length === 0) continue;
      expect(Object.keys(route.responses), `${key} is addressable but cannot 404`).toContain('404');
    }
  });

  it('declares a success response in the 2xx range on every route', () => {
    for (const [key, route] of routes) {
      const successCodes = Object.keys(route.responses).filter(function isSuccess(code) {
        return Number(code) >= 200 && Number(code) < 300;
      });
      expect(successCodes.length, `${key} declares no 2xx response`).toBe(1);
    }
  });
});

describe('behaviorContract path parameters', () => {
  it('uses only camelCase id parameters', () => {
    for (const [key, route] of routes) {
      for (const param of pathParamsOf(route.path)) {
        expect(param, `${key} has an unconventional path param`).toMatch(/^[a-z][A-Za-z0-9]*Id$/);
      }
    }
  });

  it('addresses scenarios, features, and diagrams by a single id', () => {
    const addressable = routes.filter(function hasParams([, route]) {
      return pathParamsOf(route.path).length > 0;
    });
    expect(addressable.length).toBeGreaterThan(0);
    for (const [key, route] of addressable) {
      expect(pathParamsOf(route.path).length, `${key} takes more than one path param`).toBe(1);
    }
  });
});

describe('error tags', () => {
  it('keeps the tag list free of duplicates', () => {
    const tags = behaviorErrorTagSchema.options;
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('names every tag in PascalCase', () => {
    for (const tag of behaviorErrorTagSchema.options) {
      expect(tag).toMatch(/^[A-Z][A-Za-z]*$/);
    }
  });
});

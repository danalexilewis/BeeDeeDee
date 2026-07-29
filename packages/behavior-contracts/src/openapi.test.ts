import { describe, expect, it } from 'vitest';
import { behaviorContract } from './contract.js';
import { generateBehaviorOpenApi } from './openapi.js';

const document = generateBehaviorOpenApi();
const routes = Object.values(behaviorContract) as Array<{ method: string; path: string }>;

/** Converts a ts-rest path to the OpenAPI form: `:id` becomes `{id}`. */
function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

describe('generated OpenAPI document', () => {
  it('declares OpenAPI 3', () => {
    expect(document.openapi.startsWith('3.')).toBe(true);
  });

  it('carries the API title and version', () => {
    expect(document.info.title).toBe('Behavior Workbench API');
    expect(document.info.version).toBe('0.1.0');
  });

  it('describes one path per contract route', () => {
    // The document is derived, so drift can only mean the generator broke — it
    // cannot describe a route the server does not implement.
    const documented = new Set(Object.keys(document.paths ?? {}));
    expect(documented.size).toBe(routes.length);

    for (const route of routes) {
      expect(documented, `${route.method} ${route.path} is missing`).toContain(
        toOpenApiPath(route.path)
      );
    }
  });

  it('documents each route under its own method', () => {
    for (const route of routes) {
      const entry = (document.paths ?? {})[toOpenApiPath(route.path)] as
        Record<string, unknown> | undefined;
      expect(entry, `${route.path} has no path item`).toBeDefined();
      expect(entry, `${route.path} is missing ${route.method}`).toHaveProperty(
        route.method.toLowerCase()
      );
    }
  });

  it('gives every operation an id', () => {
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, unknown>)) {
        expect(
          (operation as { operationId?: string }).operationId,
          `${method} ${path} has no operationId`
        ).toBeTruthy();
      }
    }
  });

  it('documents a failure response on every operation', () => {
    for (const [path, item] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(item as Record<string, unknown>)) {
        const responses = (operation as { responses?: Record<string, unknown> }).responses ?? {};
        const failures = Object.keys(responses).filter(function isFailure(code) {
          return Number(code) >= 400;
        });
        expect(failures.length, `${method} ${path} documents no failure`).toBeGreaterThan(0);
      }
    }
  });

  it('names a local server, since the workbench is not deployed', () => {
    expect(document.servers?.[0]?.url).toContain('127.0.0.1');
  });

  it('omits the event stream, which is not a request-response pair', () => {
    expect(Object.keys(document.paths ?? {})).not.toContain('/api/events');
  });
});

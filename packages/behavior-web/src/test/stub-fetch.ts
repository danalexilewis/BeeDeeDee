import { vi } from 'vitest';

/** A canned response for one route. */
export type StubRoute = {
  status?: number;
  body: unknown;
};

/** Routes keyed by `METHOD path` or just `path` for GET. */
export type StubRoutes = Record<string, StubRoute>;

/**
 * Replaces `fetch` with canned contract responses.
 *
 * Stubbing at the network boundary rather than mocking the query modules keeps
 * the real ts-rest client, `unwrap`, and the error mapping in the path under test,
 * so a contract change surfaces here instead of passing against a mock.
 */
export function stubFetch(routes: StubRoutes): { calls: string[] } {
  const calls: string[] = [];

  vi.stubGlobal(
    'fetch',
    async function stubbedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const rawUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();
      const path = rawUrl.replace(/^https?:\/\/[^/]+/, '');

      calls.push(`${method} ${path}`);

      const route =
        routes[`${method} ${path}`] ??
        routes[path] ??
        // Fall back to a prefix match so tests need not spell out query strings.
        routes[
          Object.keys(routes).find(function matchesPrefix(key) {
            const bare = key.replace(/^[A-Z]+ /, '');
            return path.startsWith(bare);
          }) ?? ''
        ];

      if (route === undefined) {
        return new Response(
          JSON.stringify({ tag: 'FileNotFound', message: `No stub for ${path}` }),
          {
            status: 404,
            headers: { 'content-type': 'application/json' },
          }
        );
      }

      return new Response(JSON.stringify(route.body), {
        status: route.status ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    }
  );

  return { calls };
}

/** Restores the real fetch. */
export function restoreFetch(): void {
  vi.unstubAllGlobals();
}

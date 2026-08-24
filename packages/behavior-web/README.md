# @eddy/behavior-web

Vite + React SPA for the Behavior Workbench.

## Stack

- **Vite 8** and **React 19**
- **TanStack Router** with Zod-validated search params
- **TanStack Query** over `initClient` from `@ts-rest/core`
- **Tailwind 4** with CSS custom properties for theming
- **react-resizable-panels** for the three-panel feature view
- **@tanstack/react-virtual** for the catalog
- **@xyflow/react** for architecture map canvases
- **mermaid** for diagram rendering

## No client state library

Server state belongs to TanStack Query. Filter and selection state belongs to
Zod-validated URL search params, which makes a filtered catalog shareable and
gives the filter one source of truth. Panel sizes persist through
`react-resizable-panels`' own storage. Together those remove the need for a third
store.

## The API layer

`@ts-rest/react-query` is not used: it peers on React ≤18 in every published
release, including the release candidate. `@ts-rest/core` has no React peer, so
`src/api/queries.ts` wraps `initClient` in a `queryOptions()` factory per
endpoint. That costs a few lines each and keeps full inference from the contract.

A relative base URL means the same build works behind the Vite dev proxy and when
Fastify serves the bundle itself.

## Live updates

`src/api/events.ts` subscribes to `/api/events` and validates each payload with
the same schema the server publishes, so a mismatched deploy is reported rather
than producing a malformed update. Each event invalidates only the queries it
could have affected, so the UI follows an ingest without polling.

Connection state comes from the EventSource `open` event, not from the first
event to arrive — otherwise a healthy but quiet server reports as offline.

## Development

```bash
# Terminal 1: the API
node packages/behavior-cli/dist/cli.js --cwd examples/demo-project serve --api-only

# Terminal 2: the SPA with hot reload
pnpm --filter @eddy/behavior-web dev
```

Vite proxies `/api` to `http://127.0.0.1:4000`; override with `BEHAVIOR_API_URL`.

## Testing

```bash
pnpm vitest run --project behavior-web
```

Component tests run in Vitest browser mode on Chromium rather than jsdom, because
this UI renders Mermaid SVG, measures rows for virtual scrolling, and drives
panels through `ResizeObserver`. jsdom has no layout engine, so all three would
need mocking and the tests would assert the mocks.

Two setup details matter and are easy to get wrong. `src/test/setup.ts` imports
the stylesheet, without which every Tailwind utility is inert and elements
collapse to zero size. `optimizeDeps.include` names the React-dependent packages,
because a cold Vite cache can otherwise hand a module a half-initialised React
whose hook dispatcher is null.

Tests stub `fetch` rather than mocking the query modules, so the real ts-rest
client and error mapping stay in the path under test.

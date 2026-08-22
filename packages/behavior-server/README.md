# @eddy/behavior-server

Fastify server implementing the ts-rest contract, plus the file watcher, the
event stream, and static serving of the built SPA.

## Layout

```
src/server.ts       Composition root: picks the concrete adapters
src/router.ts       The contract implementation
src/http-errors.ts  The one place domain errors meet HTTP statuses
src/indexer.ts      Index lifecycle and event publishing
src/watcher.ts      chokidar with debounced re-indexing
src/events.ts       SSE fan-out
```

## Handlers are thin

The contract's Zod schemas parse the request, one use case does the work, and the
`Result` is mapped to HTTP. No business logic lives in a route.

`toDeclaredHttpResponse` takes the statuses each route actually declares and
degrades anything else to 500. With `strictStatusCodes` on, emitting an undeclared
status fails response validation at runtime, so this makes it impossible by
construction rather than relying on every handler enumerating its own error cases.

## One process

`createServer` optionally serves the built SPA through `@fastify/static` with an
SPA fallback, so `behavior serve` is a single process holding the index, the
watcher, the API, and the UI. Unknown `/api/*` paths stay JSON, so a typo in a
fetch does not return HTML.

## Indexing and events

Concurrent refreshes join one scan, so a burst of file changes cannot spawn
overlapping walks of the same tree. The watcher debounces before scheduling, which
is what makes a `git checkout` produce one re-index rather than hundreds.

`start()` awaits the watcher's `ready` promise, because chokidar's initial
directory walk is asynchronous and a change made immediately after start would
otherwise be missed.

A failed scan leaves the previous index in place and publishes `index-failed`, so
a spec saved mid-edit degrades the reported state without emptying the view.

SSE sits outside the ts-rest router: the contract describes request/response
pairs, not streams. Broadcasting is best-effort — a client whose socket has gone
away is dropped rather than allowed to fail the publish, so one dead browser tab
cannot stall the watcher.

## Testing

```bash
pnpm vitest run --project behavior-server
```

Integration tests drive the real contract client through `fastify.inject()`, so
request building, validation, handlers, and response validation are exercised on
the same path the SPA uses. SSE and the watcher are tested over a real socket and
a real temp directory respectively.

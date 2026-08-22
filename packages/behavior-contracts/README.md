# @eddy/behavior-contracts

Zod schemas and the ts-rest contract. This is the wire boundary: the server
implements it, the SPA consumes it, and both derive their types from it.

Depends only on `zod` and `@ts-rest/core`, so nothing here can reach for a
filesystem or a framework.

## Layout

```
src/schemas/     One module per domain area; types come from z.infer
src/contract.ts  The 13-route ts-rest contract
src/openapi.ts   OpenAPI generation from that contract
```

## The contract

Thirteen routes under `/api` with `strictStatusCodes` and a `commonResponses` 500. `GET /api/events` (SSE) sits outside the router, because the contract
describes request/response pairs rather than streams — its payload schema is
`workbenchEventSchema`, shared so both ends agree.

Contract-shape tests assert invariants a reviewer would otherwise have to check
by eye: no GET carries a body, every POST does, every addressable route can 404,
each route declares exactly one 2xx, and path parameters are named consistently.

## Error tags

`behaviorErrorTagSchema` is the single source of truth for failure modes.
`BehaviorError` in `@eddy/behavior-core` is a tagged union over exactly these
tags, and a compile-time assertion there fails if the two drift apart. Adding a
tag therefore forces a decision about its HTTP status and UI treatment.

## OpenAPI

```bash
pnpm --filter @eddy/behavior-contracts build
pnpm --filter @eddy/behavior-contracts openapi
```

Writes `openapi.json`. The document is derived, never hand-maintained, so it
cannot describe a route the server does not implement — a test asserts one
documented path per contract route.

## Notes

- Wire timestamps are ISO 8601 strings, not `Date`. JSON has no date type, so
  `z.date()` would parse on the server and fail on the client after `JSON.parse`.
- `FeatureFilter` and `FeatureFilterInput` are both exported, because the schema
  transforms `tags` from a comma-separated string into a list.
- Gherkin `Rule` blocks reference scenarios by id rather than nesting them, which
  keeps the schema non-recursive and preserves ts-rest's type inference.

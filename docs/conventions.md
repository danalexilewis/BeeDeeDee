# Conventions

How this codebase handles errors, schemas, and its HTTP boundary. These are not
style preferences — each one exists because the alternative caused a specific
problem.

## Errors travel as values

Every fallible operation returns a neverthrow `Result` or `ResultAsync`. Nothing
in `domain/` or `application/` throws.

`BehaviorError` is a tagged union in
[`behavior-core/src/errors.ts`](../packages/behavior-core/src/errors.ts):

```ts
export type BehaviorError =
  | { tag: 'FileNotFound'; path: string }
  | { tag: 'GherkinSyntax'; path: string; line: number; column: number; detail: string }
  | { tag: 'ScenarioNotFound'; scenarioId: string }
  // …
  | { tag: 'IndexNotReady' };
```

Three rules follow from this:

**Adapters are the only place that touch throwing APIs.** They wrap them with
`ResultAsync.fromPromise` or `Result.fromThrowable`. If a `try`/`catch` appears
outside `adapters/` or a parser, something has leaked.

**Tags are declared once.** `behaviorErrorTagSchema` in the contracts package is
the source of truth, and `assertTagsMatchContract` in `errors.ts` fails to compile
if the core union and the contract enum drift apart. Adding a failure mode
therefore forces a decision about its HTTP status and its UI treatment, rather
than defaulting silently to 500 somewhere.

**Batch work partitions, it does not short-circuit.** Requirement 1.5 wants a
malformed spec file reported with its line number while the rest of the index
proceeds. `Result.combineWithAllErrors` collects every error but still returns a
single `Err`, which would discard the files that parsed cleanly, so
`partitionResults` is used for indexing instead. `combineWithAllErrors` is still
exported as `requireAll` for cases where a partial result would be meaningless.

The one place this discipline gives way is the SPA's query layer: TanStack Query
signals failure by rejection, so `unwrap` in
[`behavior-web/src/api/client.ts`](../packages/behavior-web/src/api/client.ts)
converts a non-2xx contract response into a throw. Keeping that conversion in one
function means components only ever see data or an `ApiError`.

## Schemas are the source of truth

Types come from `z.infer`, never the reverse. Anything crossing a boundary has a
Zod schema in [`behavior-contracts`](../packages/behavior-contracts).

**Wire timestamps are ISO 8601 strings, not `Date`.** JSON has no date type, so
`z.date()` would parse on the server and fail on the client after `JSON.parse`. A
test asserts a `Date` instance is rejected, to stop that eroding.

**Input and output types differ when a schema transforms.** `featureFilterSchema`
splits `tags` from a comma-separated string into a list, so `FeatureFilter`
(output) and `FeatureFilterInput` (input) are both exported. A client building a
request needs the latter.

**Array query parameters are avoided.** ts-rest serialises arrays as `tags[]=a`
while Fastify's parser expects repeated keys, and the mismatch drops the filter
silently rather than failing. One comma-separated string behaves identically from
the typed client, a hand-written fetch, and curl.

**Ids are URL-safe by construction.** They join with `.`, not `/`, because they
travel as path segments in the API, the SPA's routes, and MCP resource URIs. A
slash would need encoding at every one of those boundaries and would 404 wherever
it was forgotten. `slugify` collapses every non-alphanumeric character to a
hyphen, so a dot can only ever be a separator we introduced. A test asserts
`encodeURIComponent` leaves every generated id unchanged.

## The contract is the only HTTP surface

[`behaviorContract`](../packages/behavior-contracts/src/contract.ts) declares 13
routes under `/api` with `strictStatusCodes`. The server implements it, the SPA
consumes it, and both derive their types from it.

**One place maps domain errors to statuses.** `statusFor` in
[`behavior-server/src/http-errors.ts`](../packages/behavior-server/src/http-errors.ts)
is an exhaustive switch, so a new error tag will not compile until its status is
chosen.

**Handlers cannot emit an undeclared status.** With `strictStatusCodes` on, doing
so fails response validation at runtime. `toDeclaredHttpResponse` takes the
statuses each route actually declares and degrades anything else to 500, which
`commonResponses` puts on every route. That removed the `as never` casts an
earlier draft needed, so the contract genuinely type-checks the handlers.

**Handlers are thin.** Parse is done by the contract's schemas, the work by one
use case, and the `Result` is mapped to HTTP. No business logic lives in a route.

Server-sent events sit outside the router, because the contract describes
request/response pairs rather than streams. The payload schema
(`workbenchEventSchema`) is still shared, so both ends agree.

## Code style

**Factory functions, not classes.** `createGherkinParser(deps)` returns a plain
object. A `no-restricted-syntax` lint rule enforces this; the exception is an
`Error` subclass that must cross a library boundary.

**Named function declarations, not arrows**, including callbacks. A stack trace
that names `byDescendingScore` is more useful than one full of anonymous frames.

**Explicit types on arguments and exported returns.** Inference is fine for
locals.

**Short JSDoc on exported symbols**, and comments only where the code cannot
speak for itself: a constraint, a trade-off, or a decision whose reason is not
obvious. Not narration.

## Testing

Tests state the behaviour, not the implementation: `it('reports a syntax error
with a line number')`, not `it('returns err')`.

Where a test exists because of a specific bug, it says so and says what the bug
was, so a future reader does not simplify the fix away. Grep for `Regression:` to
see them.

Test doubles live in
[`behavior-core/src/testing`](../packages/behavior-core/src/testing) rather than
`test-support`, because they reference core's port types and core already depends
on `test-support` for arbitraries — the reverse edge would make the packages
circular. They are excluded from coverage as test infrastructure.

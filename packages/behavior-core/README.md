# @eddy/behavior-core

Business logic for the Behavior Workbench. No HTTP, no React, no commander, and
`node:fs` only inside one adapter.

## Layout

```
src/domain/       Pure, synchronous functions. No I/O, no async.
src/parsers/      Gherkin, Mermaid, test files, and test reports
src/ports/        Interfaces the application depends on
src/adapters/     Implementations of those interfaces
src/application/  Use cases orchestrating domain over ports
src/testing/      Test doubles, exported as @eddy/behavior-core/testing
```

The layering rule: `domain/` is pure and synchronous, so its tests need no
mocking and run in milliseconds. `application/` is the only home for use cases.
Neither imports a framework.

## Errors

Every fallible operation returns a neverthrow `Result` or `ResultAsync`. Nothing
here throws. `BehaviorError` is a tagged union; `assertTagsMatchContract` fails
to compile if it drifts from the contract's tag enum.

Adapters are the only place that touch throwing APIs, wrapped with
`ResultAsync.fromPromise` or `Result.fromThrowable`.

## Ports

| Port             | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `FileSystemPort` | Listing, reading, and writing project files                    |
| `ClockPort`      | Timestamps and durations, injected so tests stay deterministic |
| `LoggerPort`     | Structured logging                                             |
| `IndexStorePort` | Holds the current index                                        |

`createNodeFileSystem` confines every path to the project root: `../../etc/passwd`
and absolute paths outside the project fail with `PathEscapesProject` before any
I/O. A directory that exists but cannot be listed reports `ReadFailed` rather than
an empty list, so a permissions problem cannot silently empty the catalog.

`IndexStorePort` is synchronous on purpose — it is an in-process cache, and making
reads `ResultAsync` would push async plumbing through the whole read path for no
benefit. Reads return a `Result` so a caller arriving before the first scan gets
`IndexNotReady`.

## Notable behaviours

**Indexing tolerates bad files.** A parse failure lands in `problems` with its
line number while everything else is indexed. The scan only fails outright if a
spec directory cannot be listed, which means misconfiguration.

**Ids are URL-safe.** They join with `.`, not `/`, because they travel as path
segments in the API, the SPA's routes, and MCP resource URIs.

**Coverage counts linked tests; status counts results.** A scenario whose test
exists but has never run is covered and untested — conflating those would hide the
gap coverage exists to expose.

**Test matching assigns each test to at most one scenario**, so a single test
cannot inflate coverage across several. An explicit `@scenario:<id>` tag wins
outright; token overlap is capped below name containment.

**Mermaid is parsed as text.** The `mermaid` package needs a DOM to render, which
would drag a browser dependency into the domain. Node counting is an
approximation feeding the complexity band, never correctness.

## Testing

```bash
pnpm vitest run --project behavior-core
```

Includes the five correctness properties from the design as fast-check tests:
indexing idempotency, ingestion-order independence, coverage monotonicity, status
matching aggregated results, and relevance scores within [0, 1]. Coverage gate
for `domain/` is 90%.

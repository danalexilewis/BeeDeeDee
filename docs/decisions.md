# Decisions

Short records of the choices that shaped this codebase, and what would change
them.

## 1. Zod 3, not Zod 4

**Decision.** Pin `zod@^3.25.76` and `@ts-rest/*@3.52.1`.

Stable `@ts-rest/core` is coupled to Zod 3 in its _types_, not merely its peer
range — `z.AnyZodObject`, `z.objectUtil.MergeShapes`, and `_def['unknownKeys']`
all appear in its public signatures. Zod 4 support exists only in
`3.53.0-rc.1`, published June 2025 with nothing since.

Adopting the RC would also mean a breaking contract change (headers move from a
top-level schema to an object of schemas), a different validation error type, and
a hand-written OpenAPI transformer.

**Revisit when** ts-rest 3.53 ships stable. The migration is contained to the
contracts package.

## 2. Factory functions, not classes

**Decision.** No `class` declarations; factories returning plain objects instead.

The design document names `GherkinParser`, `BehaviorMCPServer`, and
`EditorLinkService` as classes. This repository's conventions prefer functional
code, and the error classes the design implied are better served by a tagged
union that a `switch` can exhaust.

Enforced by a `no-restricted-syntax` lint rule, with an exception for `Error`
subclasses that must cross a library boundary.

## 3. A Vite SPA, not Next.js

**Decision.** Replace the scaffolded Next.js package with a Vite + React SPA.

Nothing in the design needs SSR, SEO, or server components: it is a local tool
where every byte of data comes from a local API. Next would have duplicated the
server layer already needed for the file watcher.

Fastify serves the built SPA through `@fastify/static` with an SPA fallback, so
`behavior serve` is a single process holding the index, the watcher, the API, and
the UI. In development the Vite dev server proxies `/api` to Fastify.

An earlier draft justified this partly by claiming SSE could not work in Next
route handlers. That was wrong — SSE streams fine there; only WebSockets are
unsupported. The argument stands on the other reasons.

## 4. Fastify 5 with a pnpm peer override

**Decision.** Run Fastify 5 and declare
`pnpm.peerDependencyRules.allowedVersions.fastify: "5"`.

`@ts-rest/fastify` declares a `fastify ^4` peer in both its stable and RC
releases, and the v4 line is past end of life. The override is load-bearing:
without it, strict peer mode fails to install.

A throwaway spike verified the combination before any code depended on it — 13
checks against Fastify 5.10.0 covering router registration, request validation,
`fastify.inject()`, static serving with SPA fallback, and SSE streaming.

## 5. No `@ts-rest/react-query`

**Decision.** Use `initClient` from `@ts-rest/core` with hand-written TanStack
Query `queryOptions()` factories.

That adapter peers on React ≤18 in every published release, including the RC, so
no future ts-rest version rescues it. `@ts-rest/core` has no React peer at all.
The factories cost a few lines per endpoint and keep full inference from the
contract.

## 6. A synchronous index store

**Decision.** `IndexStorePort` reads and writes synchronously, returning a
`Result`.

It is an in-process cache. Making every read a `ResultAsync` would push async
plumbing through the entire read path for no benefit. Returning a `Result` means
a caller arriving before the first scan gets `IndexNotReady` rather than a null
check.

A failed scan leaves the previous index readable, so a spec file saved mid-edit
degrades the reported state without emptying the view the user is looking at.

**Revisit if** the design's 10,000-scenario ceiling needs a database backend.

## 7. Coverage counts linked tests, status counts results

**Decision.** `testCoverage` measures scenarios with at least one linked test.
`status` measures what has actually run.

Deriving coverage from recorded results reported a scenario with a brand-new test
as _uncovered_, conflating "no test exists" with "the test has not run" — and
hiding the exact gap coverage exists to expose. A fresh project now reads as 100%
covered and untested, which is the honest description.

Found by smoke-testing `behavior serve` by hand, not by a test, which is why the
distinction is now pinned by several.

## 8. Component tests in a real browser

**Decision.** Vitest browser mode on Chromium rather than jsdom.

This UI renders Mermaid SVG, measures rows for virtual scrolling, and drives
panels through `ResizeObserver`. jsdom has no layout engine, so all three would
need mocking and the tests would assert the mocks. Browser mode also reuses the
Playwright install the e2e layer needs anyway.

Two setup requirements came out of this and are easy to get wrong: the stylesheet
must be loaded (without it every Tailwind utility is inert and elements collapse
to zero size), and the React-dependent packages must be named in `optimizeDeps`
(a cold Vite cache can otherwise hand a module a half-initialised React whose
hook dispatcher is null — and CI's cache is always cold).

## 9. Mermaid is parsed as text, not with the Mermaid library

**Decision.** `parseMermaidContent` analyses the source as text.

The `mermaid` package needs a DOM to render, which would drag a browser
dependency into the domain layer. The indexer only needs metadata — title,
diagram type, node count, complexity band. Rendering stays in the SPA, where a
DOM exists.

Node counting is explicitly an approximation feeding the complexity band, never
correctness.

## 10. MCP writes are refused by default

**Decision.** The MCP server runs in its own process, confines its filesystem
adapter to the project root, records every call, and refuses writes unless
started with `--allow-writes`.

The design's security section asks for a separate process, restricted filesystem
access, an audit trail, and user confirmation before writes. All four are
structural here rather than advisory.

`propose_gherkin` returns a draft rather than writing one, which satisfies the
confirmation requirement without depending on the client supporting elicitation.
A test asserts no flag combination other than `--allow-writes` can enable writes.

## 11. Scenario Outlines are indexed as one scenario

**Decision.** A `Scenario Outline` counts once, with its example count retained
for display, rather than being expanded per example row.

The catalog's scenario count then matches what a reader sees in the file.
Expanding would inflate counts and coverage percentages in a way that looks like
progress without being any.

**Revisit if** users want per-example test status, which would need example rows
addressable by id.

## 12. Gurki is the primary modelling dialect

**Decision.** New BeeDeeDee modelling targets [Gurki](https://gurki.nz)
(`System` / `Output` / `Outcome` / `Activates`). Classic Cucumber Gherkin
(`.feature`, including Background / Rule / Scenario Outline) remains supported
as a transitional dialect behind `dialect: auto | gurki | gherkin`.

Gurki is not a Cucumber dialect: `@cucumber/gherkin` cannot treat the new step
kinds as first-class. Parsing for Gurki files goes through the `gurki` package
(git dependency until npm publish). The workbench still aggregates test status
separately from Gurki `Outcome` text.

**Revisit when** Gurki 1.0 ships, or when classic `.feature` usage in demos and
skills drops to zero — then consider removing the classic parser path.

Plan: [gurki-migration-plan.md](./gurki-migration-plan.md).

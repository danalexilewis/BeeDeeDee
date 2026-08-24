# Plan: move BeeDeeDee to Gurki

How BeeDeeDee becomes a local workbench over [Gurki](https://gurki.nz)
systems — aggregating scenarios into browsable System value, unlock graphs, and
(optionally) ledger nets — instead of remaining a classic Gherkin + test-status
catalog alone.

Companion notes: [landscape.md](./landscape.md) (Cucumber living-docs vs
reverse-spec), [decisions.md](./decisions.md) (current ADR stack).

## Destination

BeeDeeDee indexes **Gurki** as the primary modelling dialect:

- `System:` groups scenarios (Gherkin `Feature`, renamed for systems)
- `Output` / `Outcome` / `Activates` are first-class step kinds
- Derived **System Outputs / System Outcomes** (and with analysis, **Net**)
  roll up to the system / business level
- `Activates` edges form a browsable unlock graph across scenarios
- Classic `.feature` remains readable for a transition period (dual dialect)

The workbench stays what it is good at: local always-on index, Mermaid, editor
deep links, test ingest, MCP. Gurki supplies *what the system produces and
unlocks*; BeeDeeDee supplies *the map and the agent loop*.

Simulation stays out of scope (same as Gurki v0.1).

## Why not “just parse more keywords”

`@cucumber/gherkin`’s classic matcher cannot treat `Output`, `Outcome`,
`Activates`, or `System` as first-class kinds. Gurki is a small extension of the
line grammar, not a Cucumber dialect. BeeDeeDee must add a Gurki parser path
(prefer the published `gurki` package once available; until then git/workspace
or a thin owned line parser matching `keywords.json`).

Critical mismatch with today’s demo and skill: BeeDeeDee leans on **Background,
Rule, Scenario Outline** — Gurki v0.1 lists those as out of scope. Migration is
dual-dialect first, then Gurki-first fixtures and authoring guidance.

## Principles

1. **Additive until proven.** Classic `.feature` keeps working until Gurki
   fixtures and UI cover the same jobs.
2. **Source Markdown is canonical.** JSON IR and analysis sidecars are generated
   surfaces; never overwrite authored text from AI.
3. **Depend on Gurki’s contract, don’t fork the language.** Consume
   `parseGurki` / `lintDocument` / `valueReport` / `GurkiDocumentZ` (or
   equivalent) rather than inventing parallel keywords.
4. **Separate test status from Gurki Outcome.** UI already has `OutcomeBadge`
   for pass/fail — rename or namespace so Gurki `Outcome` is not confused with
   test outcome.
5. **Aggregation is the product bet.** Catalog and feature views must show
   rolled-up Outputs/Outcomes and Activates graphs, not only scenario lists.

## Dependency gate

| State | Action |
| --- | --- |
| `gurki` not on npm (current) | Prefer `github:danalexilewis/gurki` (pinned commit/tag) or a pnpm workspace sibling; do not invent a permanent fork |
| `gurki@0.1.x` published | Switch to registry dep; pin minor; use public exports only (`gurki`, `gurki/keywords.json`) |
| Schema drift | Pin `schemaVersion: "0.1"` and fail loudly on unknown versions |

Publish of `gurki` is an external unblocker, not a BeeDeeDee task — plan assumes
git dependency works from day one of Phase 1.

## Phases

### Phase 0 — Product framing (docs only)

**Done when:** README / landscape / this plan agree on destination.

- Update [landscape.md](./landscape.md) with a Gurki section (system modelling
  vs Cucumber living docs).
- Soften README “Gherkin specifications” framing to “Gurki systems (classic
  Gherkin still supported).”
- Record an ADR: Gurki-primary dialect; classic Gherkin transitional.

No code required.

### Phase 1 — Parse and index Gurki (core)

**Done when:** `behavior index` against a Gurki corpus reports systems,
scenarios, and step kinds including Output/Outcome/Activates.

| Work | Seams |
| --- | --- |
| Add Gurki dependency (git or npm) | root / `behavior-core` package.json |
| `parseGurkiContent` adapter → existing `ParsedFeatureDocument`-shaped IR **or** a new `ParsedSystemDocument` mapped at the application boundary | `packages/behavior-core/src/parsers/` |
| Extend indexer: `FEATURE_EXTENSIONS` → also `.spec.md`; optional book-fence scan later | `application/index-specs.ts` |
| Config: `dialect: 'auto' \| 'gurki' \| 'gherkin'` (default `auto` by extension / first keyword) | `behavior-cli` config + contracts `project` schema |
| Preserve classic path via `@cucumber/gherkin` | keep `gherkin.ts` |
| Errors: add `GurkiSyntax` (or generalise to `SpecSyntax`) in the tagged union + OpenAPI | `errors.ts`, contracts |
| Property/unit tests with Gurki fixtures copied/adapted from gurki `examples/` | `behavior-core` tests |

**Mapping choices (lock in this phase):**

- Index id: keep path-based ids; treat `System` title like today’s feature title.
- Scenarios without `System:` → ungrouped bucket (match Gurki: System optional).
- Skip derived `System Outputs` / `System Outcomes` lines on parse (Gurki rule);
  regenerate via `valueReport` for projections.
- Background / Rule / Outline: only on classic dialect; Gurki files that contain
  them fail lint with a clear remediation.

### Phase 2 — Contracts and projections (value report + Activates)

**Done when:** API returns system value reports and Activates links for Gurki
documents.

| Work | Seams |
| --- | --- |
| Optional `systemOutputs` / `systemOutcomes` on feature detail | `schemas/feature.ts` |
| Step `kind` enum or normalised keyword (`given`…`activates`) | `schemas/gherkin.ts` (consider rename to `spec.ts` later) |
| Projection: build value report from steps; resolve `Activates` text → scenario id when titles match | `application/projections.ts` |
| Lint: lifecycle order warning; unresolved Activates; “don’t hand-edit value report” | wrap `gurki` lint + BeeDeeDee rules |
| `POST /api/gherkin/validate` accepts Gurki bodies (additive) or add `/api/spec/validate` | contracts + server |

Keep wire field `gherkinSource` for now (raw source blob); rename to `source` in
a later breaking pass if needed.

### Phase 3 — Workbench UI (browsable canvas)

**Done when:** a user can open a Gurki project and see aggregation, not only a
flat scenario list.

| Work | Seams |
| --- | --- |
| Kind-aware step styling (Output / Outcome / Activates distinct) | `gherkin-steps.tsx` |
| Feature view: **System value** section (Outputs then Outcomes; `But` as strain) | `routes/feature.tsx` |
| Activates graph: scenario → scenario edges (Mermaid or simple SVG list first) | new component; may reuse diagram panel |
| Catalog: dialect badge; optional rollup counts (N outputs, M activates) | `routes/catalog.tsx` |
| Rename test `OutcomeBadge` → `TestOutcomeBadge` (or similar) | `status-badge.tsx` |
| Problems route: Gurki diagnostics codes | `routes/problems.tsx` |

First viewport of the catalog stays one job: health of the indexed systems.
Deep aggregation lives on system (feature) view — avoid dashboard clutter.

### Phase 4 — Analysis sidecar (optional net / quality measures)

**Done when:** optional `*.analysis.json` (or configured path) validates against
source digest and can drive **System Net Outputs / Outcomes** in the UI.

| Work | Seams |
| --- | --- |
| Ingest / validate via `gurki` `checkAnalysis` | CLI + core |
| Attach measures / ledger to steps in detail views | projections |
| Surface churn vs net (Gurki semantics) | feature view |
| MCP: expose analysis summary, refuse writes by default (existing policy) | `behavior-mcp` |

Do not block Phases 1–3 on sidecars. Free-text Outputs remain useful without
ledger netting.

### Phase 5 — MCP and authoring skill

**Done when:** agents author and validate Gurki by default for new work.

| Work | Seams |
| --- | --- |
| `validate_gherkin` accepts Gurki; add `propose_gurki` (or mode flag) emitting System / Output / Outcome / Activates | `behavior-mcp` |
| Compose Gurki mixin skill (`npx gurki skill`) with eng-bee-dee-dee | `.cursor/skills/` |
| Rewrite eng-bee-dee-dee lanes: Gurki-primary; classic Gherkin as legacy lane | `agents/gherkin.md` → `agents/gurki.md`, style refs |
| Drop Background / Rule / Outline from default authoring guidance | skill + examples |

### Phase 6 — Demo, docs, classic de-emphasis

**Done when:** default demo is a Gurki corpus; classic fixtures are optional.

| Work | Notes |
| --- | --- |
| Replace or dual-track `examples/demo-project` | Current login feature uses Background + Rule + Outline — incompatible with Gurki v0.1 |
| Add a small civic/ops sample (or submodule pointer to gurki examples) | Prefer named real operations |
| README quick start on Gurki | Point at gurki.nz for language learning |
| ADR: classic `.feature` support window | e.g. supported but not extended |

## Explicit non-goals (near term)

- Becoming a Cucumber runner or replacing Playwright ingest
- Full simulation / discrete-event engine
- New Gurki keywords (resist until examples hurt — Gurki’s rule)
- Forcing Policy Bias’s election-card UX into BeeDeeDee (different product;
  reuse the *pattern*: specs → derived cards/rollups → browsable wall)
- Dropping Mermaid or editor deep links

## Suggested delivery order (PRs)

1. **Docs:** this plan + landscape Gurki note + ADR stub.
2. **Thin vertical (done on this branch):** one Gurki `*.spec.md` through
   parse → index → feature detail (`systemOutputs` / `systemOutcomes`) → UI
   value report + kind-coloured steps, beside classic `.feature` demo files.
3. **Activates unlock graph (done on this branch):** resolve Activates → scenario
   ids, feature `activatesLinks` / Mermaid, catalog dialect + unlock counts,
   lint `unresolved-activates`.
4. **MCP/skill rewrite** (Phase 5) — Gurki-primary authoring.
5. **Demo classic migration + docs** (Phase 6) — move Background/Rule/Outline
   samples off the default path.
6. **Analysis sidecar** when a real consumer needs net/churn (Phase 4).

### Why thin vertical (not horizontal layers)

The hard unknowns are at **package seams**, not inside a single parser:

1. **Dialect mapping** — Gurki `System`/`Output`/`Outcome`/`Activates` must land in
   BeeDeeDee’s Feature/Scenario IR (or force a contracts rewrite). That only
   becomes real when a projection and one UI panel consume the parse.
2. **Dual dialect safety** — classic `.feature` (Background / Rule / Outline)
   must keep working. An end-to-end Gurki sample beside the existing demo
   proves coexistence; a months-long “finish all parsers first” branch does not.
3. **Feedback loop** — value reports and Activates only pay off when browsable.
   Horizontal work (all schemas, then all MCP, then all UI) delays the first
   moment someone can see aggregation — the actual product bet.
4. **Dependency risk** — `gurki` is pre-1.0 / may be git-pinned. Touching encode,
   lint, valueReport, and UI against one fixture surfaces API mismatch early.

Horizontal layering is fine *inside* a vertical slice (parse → index → one
API field → one panel). Avoid a horizontal-only Phase 1 that ships no visible
Gurki system.

## Risks

| Risk | Mitigation |
| --- | --- |
| `gurki` API churn pre-1.0 | Pin commit; depend only on documented exports |
| Demo/e2e tied to Background/Rule/Outline | Dual dialect; migrate demo in its own PR |
| Vocabulary collision (Feature vs System, Outcome vs test outcome) | UI copy + badge rename early |
| Book fences in arbitrary Markdown | Defer book-envelope indexing; start with `*.spec.md` only |
| Scope creep into Policy Bias features | Keep BeeDeeDee local/agent; cards/games stay elsewhere |

## Success criteria

- A Gurki `*.spec.md` tree indexes without a classic Feature line.
- System view shows derived Outputs/Outcomes matching `gurki decode`.
- Unresolved `Activates` appear as lint warnings; resolved ones navigate.
- Classic `.feature` demo still indexes and shows test status.
- MCP can validate Gurki source and propose a System-shaped draft.
- eng-bee-dee-dee defaults to Gurki authoring.

## Open decisions (resolve in Phase 1 ADR)

1. **IR shape:** map Gurki → existing Feature/Scenario types, or introduce
   System types throughout contracts?
2. **Book envelopes:** index fenced blocks in any `.md`, or only `*.spec.md`?
3. **Id stability:** when renaming Feature→System in UI, do scenario ids stay
   path+name based?
4. **Monorepo vs external dep:** sibling checkout in a multi-root workspace vs
   git dependency only?

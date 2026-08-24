# Landscape: BeeDeeDee niche and the tools around it

Research notes (August 2026). Thesis first; living-docs cousins and reverse-spec
tools are arranged around it.

## Thesis

**BeeDeeDee’s niche stays: local always-on index, Mermaid links, editor deep
links, MCP — not a Cucumber runner and not a SaaS BA suite.**

Specs on disk are the source of truth. The workbench maps them to linked tests,
live pass/fail, diagrams, and editor jump targets, and exposes the same picture
to agents. Reverse-spec tools are natural **upstream feeders**. **Cucumber
Messages** is the strongest **downstream** integration (status in, without
becoming the runner).

```text
  reverse-spec / simulation          BeeDeeDee (this repo)           Cucumber platform
  -------------------------          ---------------------           -----------------
  Reversa, Greenfield,               always-on index                 Messages NDJSON
  Pathfinder, Spectacle,             Mermaid relevance               HTML formatter
  reverse-gherkin, Spekkio, …   →    editor deep links          ←──  Serenity / Studio
  (emit .feature / .mmd / md)        MCP agent picture               (post-run / SaaS)
                                     ingest → status                 runners execute
```

## Pillars already in this repo

| Pillar | What it is here | Primary seams |
| ------ | --------------- | ------------- |
| **Local always-on index** | One process: scan → in-memory `IndexStore` → Fastify API → SPA; chokidar + SSE keep the catalog live | `behavior-server` watcher/indexer/events; `behavior-core` `index-specs`; `behavior serve` |
| **Mermaid links** | Heuristic relevance from title/steps/tags/path; render only in the SPA | `parsers/mermaid.ts`, `domain/relevance.ts`, `mermaid-diagram.tsx` |
| **Editor deep links** | `vscode://` / `cursor://` / IntelliJ HTTP templates with line targets; `validate-links` CLI | `domain/editor-links.ts`, `GET /api/editor-links` |
| **MCP** | Separate process, project-root FS, audit trail, writes off unless `--allow-writes` | `behavior-mcp` tools + `behavior://scenarios/{id}` |

What the workbench deliberately does **not** do (and should not grow into):

- Invent Gherkin from an application (authoring skill / upstream tools do that).
- Execute tests (only `ingest-tests` after an external run).
- Host collaboration / BA SaaS (Studio, Azure LivingDoc territory).

See also [workbench-workflow.md](../.cursor/skills/eng-bee-dee-dee/reference/workbench-workflow.md)
and [decisions.md](./decisions.md).

---

## Upstream: reverse-spec tools as feeders

These recover or project behaviour **into** artefacts BeeDeeDee already indexes.
They are not competitors for the control plane.

### Patterns that fit this repo

1. **Write under configured roots** — Drop `.feature` (and optional `.mmd`) into
   `specPaths.features` / `specPaths.diagrams` (defaults `specs/features`,
   `specs/diagrams`). The watcher re-indexes; no new protocol required.
2. **Stable scenario identity** — Prefer stable scenario names and/or
   `@scenario:<id>` tags so heuristic test linking and coverage survive regen.
   BeeDeeDee ids are URL-safe `.`-joined slugs; renaming casually breaks deep
   links and MCP resources.
3. **Align Mermaid with Pathfinder-style journeys** — Pathfinder already emits
   Mermaid coverage maps. Matching diagram titles/slugs to features
   (`login.mmd` ↔ `login.feature`) raises relevance scores without hard IDs.
4. **Use the authoring skill as the human/agent gate** — `.cursor/skills/eng-bee-dee-dee`
   e2e-conversion and markdown-conversion lanes already turn tests/docs into
   Gherkin; reverse tools can feed those lanes or write files the skill would
   have written.
5. **Optional status via `native` ingest** — If a reverse tool also knows
   pass/fail, emit BeeDeeDee `TestResult[]` (`format: native`) rather than
   inventing another report dialect.
6. **MCP draft loop** — `propose_gherkin` / `validate_gherkin` /
   `append_scenario` (writes gated) are the agent-side review path when the
   feeder is probabilistic (LLM extraction), not deterministic projection.

### Feeder cluster

| Tool | Emits | Fit with BeeDeeDee |
| ---- | ----- | ------------------ |
| **[Reversa](https://github.com/sandeco/reversa)** | SDD specs + Gherkin parity scenarios from legacy (multi-agent) | Drop approved `.feature` into `specPaths`; review before index |
| **[Greenfield](https://github.com/prime-radiant-inc/greenfield)** | Sanitised behavioural specs + test vectors | Same file-drop path; keep implementation detail out of features |
| **[Pathfinder](https://github.com/srpadrono/Pathfinder)** | Journey Mermaid + UI test skeletons for gaps | Mermaid → `specs/diagrams`; tests → `testPaths` for linking |
| **[Spectacle](https://github.com/dundalek/spectacle)** | Deterministic tests → markdown-with-Gherkin | Strong fit: Vitest already in BeeDeeDee’s ingest family |
| **[reverse-gherkin](https://github.com/alisterscott/reverse-gherkin)** | Playwright `test.step` → business-readable Markdown report | Feed markdown-conversion skill, or promote to `.feature` under review |
| **[Spekkio](https://github.com/paulkarayan/spekkio)** | Characterization `.feature` + source maps from vibe-coded apps | Characterization folder → intended features after human triage |
| **[Specify](https://github.com/Docsbook-io/specify)** + Graphify | Code clusters → code-free behavioural specs | Upstream dossier; not a status bus |
| **[SpecMason](https://pypi.org/project/specmason/)** | Bidirectional pytest ↔ behaviour ledger | Python analogue of coverage + evidence; not TS-native |
| **Graphify** | Repo knowledge graph / Mermaid for agents | Context for MCP agents; does not replace the behaviour index |

**Takeaway:** BeeDeeDee assumes specs exist. Upstream tools *create* them.
Integration is filesystem + conventions, not a new network protocol.

---

## Downstream: Cucumber Messages (strongest integration)

Cucumber’s strategic wire format is **Messages** (Envelope stream as NDJSON), not
the legacy JSON formatter. Formatters and living-doc UIs consume Messages;
runners produce them. BeeDeeDee already depends on `@cucumber/messages` **only**
for Gherkin AST types in `parsers/gherkin.ts` — it does **not** yet ingest a
Messages result stream.

### Why this is the strongest downstream borrow

- Decouples execution from observation (matches “not a runner”).
- Richer than Playwright/Vitest/Jest JSON: pickle ↔ test case ↔ step results,
  source, and optional attachments in one stream.
- Opens Cucumber-JVM / Ruby / JS teams without teaching them BeeDeeDee’s native
  shape.
- Maps cleanly onto the existing ingest pipeline: parse → `TestResult[]` →
  `ingestTestResults` → IndexStore → SSE `test-status-changed`.

### Pattern that fits this repo

Add a report adapter beside the others; do not overload the Gherkin parser.

| Step | Where | Notes |
| ---- | ----- | ----- |
| 1. Extend `reportFormatSchema` | `behavior-contracts` `requests.ts` | e.g. `cucumber-messages` (NDJSON file or pre-parsed envelope array) |
| 2. New parser | `behavior-core/src/parsers/reports/cucumber-messages.ts` | Read envelopes; join `pickle` / `testCase` / `testCaseFinished` / step results into `TestResult` |
| 3. Wire `parseReport` | `parsers/reports/index.ts` | Same switch as `playwright-json` / `jest-style` |
| 4. CLI allowlist | `behavior-cli` `ingest-tests --format` | Keep `junit-xml` rejected |
| 5. Match scenarios | reuse `ingest-results.ts` | Prefer pickle name ↔ scenario title; fall back to `uri` + line / `@scenario:` tags |
| 6. Outcome map | `PASSED`→`pass`, `FAILED`→`fail`, `SKIPPED`/`PENDING`→`skipped`, else `not-run` | Align with Playwright mapper style |

**Keep separate:** `@cucumber/gherkin` + Messages types for **parsing `.feature`
files** vs Messages **NDJSON for run results**. Mixing them in one module would
blur the thesis (workbench ≠ runner).

**Optional later:** stream envelopes while `serve` is up (append results as
`TestCaseFinished` arrives). Batch file ingest first — same as today’s
`ingest-tests` UX.

### Living-docs cousins (same direction, different job)

These start from Gherkin + runs and produce browsable docs. Useful references;
not the BeeDeeDee product shape.

| Tool | Job | Relation |
| ---- | --- | -------- |
| **[Cucumber HTML Formatter](https://github.com/cucumber/html-formatter)** / `@cucumber/react-components` | Interactive HTML from Messages | Post-run report, not a live project index |
| **[Serenity BDD](https://serenity-bdd.github.io/docs/reporting/living_documentation)** | Illustrated living docs + requirements hierarchy | Mature JVM catalog-with-status; narrative depth we are not chasing |
| **Cucumber Studio** | SaaS authoring + living docs | Collaboration / BA suite — explicit non-goal |
| **SpecFlow+ LivingDoc** → **[Reqnroll](https://reqnroll.net/)** | .NET living HTML | Same living-doc idea; stack-specific |
| **[LivingDocGen](https://github.com/Suban5/LivingDocGen)** | Single-file HTML from features + many formats | Static report cousin of the catalog |
| **[Pickles](https://github.com/picklesdoc/pickles)** | Classic OSS living docs | Effectively retired with SpecFlow |
| **[Spexor](https://github.com/seita1996/spexor)** | Local-first **manual** Gherkin runner + SQLite history | Shares “git-native specs”; differs by executing/manual runs |
| Cukedoctor, Allure, cucumber-reporting | CI / fancy reports | Artefacts, not an always-on map |

---

## Borrow list (ordered by fit)

1. **Ingest Cucumber Messages** — first-class `cucumber-messages` report format
   through the existing ingest ports (strongest downstream win).
2. **Document feeder conventions** — path defaults, `@scenario:` tags, Mermaid
   naming — so Pathfinder/Spectacle/Reversa users land cleanly (upstream win,
   mostly docs + skill lanes).
3. **Stay on `native` + Playwright/Vitest/Jest** for non-Cucumber stacks — do not
   force Messages where those reporters already work.
4. **Do not rebuild** Serenity narratives, Studio collaboration, or a Cucumber
   execution engine.

## Explicit non-goals

- Becoming a Cucumber (or Spexor-style) runner.
- Becoming a SaaS BA / collaboration suite.
- Matching Serenity’s illustrated narrative documentation depth.
- Inventing specs from the application inside the workbench runtime (upstream
  tools + eng-bee-dee-dee skill own that).

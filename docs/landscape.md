# Landscape: BeeDeeDee niche and patterns to borrow

Research notes (August 2026). Thesis first. Neighbouring tools are sources of
**patterns**, not formats or products to adopt.

## Thesis

**BeeDeeDee’s niche stays: local always-on index, Mermaid links, editor deep
links, MCP — not a Cucumber runner and not a SaaS BA suite.**

Specs on disk are the source of truth. The workbench maps them to linked tests,
live pass/fail, diagrams, and editor jump targets, and exposes the same picture
to agents.

We do **not** need to support Cucumber Messages as an ingest format, or host a
Cucumber (or Spexor-style) runner. Reverse-spec tools and the Cucumber living-docs
stack are useful for **how they separate concerns** — not as integration targets.

```text
  reverse-spec tools                 BeeDeeDee (core)                living-docs / Cucumber
  (pattern: emit files)              --------------------            (pattern: observe ≠ run)
  --------------------               always-on index                 Messages / formatters
  write .feature / .mmd         →    Mermaid + editor links          Serenity / Studio / HTML
  under repo paths                   MCP agent picture               = post-run or SaaS cousins
                                     ingest via existing reports     ≠ our wire format
```

## Pillars already in this repo

| Pillar                    | What it is here                                                                                      | Primary seams                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Local always-on index** | One process: scan → in-memory `IndexStore` → Fastify API → SPA; chokidar + SSE keep the catalog live | `behavior-server` watcher/indexer/events; `behavior-core` `index-specs`; `behavior serve` |
| **Mermaid links**         | Heuristic relevance from title/steps/tags/path; render only in the SPA                               | `parsers/mermaid.ts`, `domain/relevance.ts`, `mermaid-diagram.tsx`                        |
| **Editor deep links**     | `vscode://` / `cursor://` / IntelliJ HTTP templates with line targets; `validate-links` CLI          | `domain/editor-links.ts`, `GET /api/editor-links`                                         |
| **MCP**                   | Separate process, project-root FS, audit trail, writes off unless `--allow-writes`                   | `behavior-mcp` tools + `behavior://scenarios/{id}`                                        |

What the workbench deliberately does **not** do:

- Invent Gherkin from an application (authoring skill / upstream tools do that).
- Execute tests (only `ingest-tests` after an external run).
- Host collaboration / BA SaaS.
- Speak Cucumber Messages NDJSON (Playwright / Vitest / Jest / `native` are enough).

See also [workbench-workflow.md](../.cursor/skills/eng-bee-dee-dee/reference/workbench-workflow.md)
and [decisions.md](./decisions.md).

---

## Patterns worth borrowing (no new surface)

These are design habits already mostly true here. Use them as a veto when tempted
to add dialects, formats, or product modes.

| Pattern                                      | Seen in                                                                       | Keep doing in BeeDeeDee                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Observe ≠ execute**                        | Cucumber Messages vs runners; HTML formatter consumes, does not run           | Ingest reports only; never grow a runner                                     |
| **Specs on disk are truth; results overlay** | Spexor (git specs, SQLite history); Pickles/LivingDocGen (features + results) | Index from files; status merges into memory; no DB-as-source-of-truth        |
| **Stable behaviour identity**                | Pickle as the unit of execution; slug/id discipline in catalogs               | Stable scenario names / ids; don’t rename casually (breaks links + MCP URIs) |
| **UI/API does not know the runner**          | Formatters sit behind the Messages bus                                        | SPA and MCP read the index/contract; report parsers stay at the edge         |
| **Upstream writes files, does not call us**  | Reversa, Spectacle, Pathfinder, Spekkio                                       | Feeders drop `.feature` / `.mmd` under `specPaths`; watcher re-indexes       |
| **Characterization ≠ intended**              | Spekkio triage folders                                                        | Human/skill review before treating reverse-spec output as canon              |
| **Local + agent loop, not BA SaaS**          | Contrast with Cucumber Studio                                                 | MCP + deep links; leave collaboration products alone                         |

### Upstream tools (feeders only)

| Tool                 | Emits                                       | Pattern to notice                                               |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Reversa / Greenfield | Specs + Gherkin from code/legacy            | Multi-step extract → human gate → files on disk                 |
| Pathfinder           | Journey Mermaid + gap tests                 | Diagrams as coverage maps; title/slug alignment helps relevance |
| Spectacle            | Deterministic tests → markdown-with-Gherkin | Projection from tests, not LLM invention                        |
| reverse-gherkin      | Playwright steps → readable Markdown        | Report-shaped output; promote to `.feature` only after review   |
| Spekkio / Specify    | Characterization / clustered specs          | Separate “what it does” from “what we want”                     |

No feeder-specific APIs. Filesystem handoff is the whole integration.

### Living-docs cousins (reference only)

Serenity, Studio, Reqnroll LivingDoc, LivingDocGen, Pickles, Cucumber HTML
formatter, Spexor: same _direction_ (behaviour + status) or local-first specs.
Different _job_ (post-run HTML, SaaS authoring, or manual execution). Borrow the
separation of concerns; do not copy their surface.

Cucumber Messages remains interesting as an **architecture lesson** (decoupled
observe/execute, stable pickle identity). It is **not** a near-term ingest
target for this product.

---

## What this research is for

1. **Veto new ideas** that blur the niche (runner, SaaS BA, invent-specs-in-serve,
   extra report dialects “for completeness”).
2. **Keep the core loop tight:** `init` → `index`/`serve` → ingest existing
   formats → MCP / deep links / Mermaid.
3. **Treat reverse-spec and Cucumber ecosystem material as pattern sources**,
   not a backlog of integrations.

## Explicit non-goals

- Supporting Cucumber Messages NDJSON (or any new report format) unless ingest
  later _collapses_ to fewer formats — not expands.
- Becoming a Cucumber or Spexor-style runner.
- Becoming a SaaS BA / collaboration suite.
- Matching Serenity’s illustrated narrative depth.
- Inventing specs from the application inside the workbench runtime.
- Feeder-specific plugins or Pathfinder/Reversa adapters.

# Landscape: living docs, BDD catalogs, and reverse-spec tooling

Research notes for where BeeDeeDee sits relative to the Cucumber ecosystem and
newer reverse-engineering / simulation tools. Captured August 2026.

## What BeeDeeDee is doing

Local control plane over **existing** Gherkin + Mermaid + test results: index,
browse, link to editors, ingest pass/fail, expose the same picture to agents via
MCP. Specs are the source of truth; the workbench maps them to reality.

## Cucumber / BDD living-documentation stack

These tools start from executable Gherkin and turn runs into browsable docs.

| Tool                                                                                                     | What it does                                                                    | Overlap with BeeDeeDee                                          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **[Cucumber Messages](https://github.com/cucumber/messages)**                                            | NDJSON event protocol for parse + execute + results; preferred over legacy JSON | Strong ingest target — richer than Playwright/Vitest JSON alone |
| **[Cucumber HTML Formatter](https://github.com/cucumber/html-formatter)** / `@cucumber/react-components` | Cross-impl interactive HTML report from Messages                                | Post-run report, not a live project workbench                   |
| **[Serenity BDD](https://serenity-bdd.github.io/docs/reporting/living_documentation)**                   | Requirements hierarchy + illustrated living docs from Cucumber/JBehave/JUnit    | Closest mature “catalog of behaviour with status” in JVM land   |
| **Cucumber Studio** (ex-HipTest)                                                                         | SaaS Gherkin authoring, action words, searchable living docs                    | Collaboration / BA-facing; not a local agent control plane      |
| **SpecFlow+ LivingDoc** → **[Reqnroll](https://reqnroll.net/)**                                          | .NET living HTML from features + results; SpecFlow EOL’d, Reqnroll continues    | Same living-doc idea; .NET-centric                              |
| **[Pickles](https://github.com/picklesdoc/pickles)**                                                     | Classic OSS living-doc generator (HTML/Word/Excel)                              | Effectively retired with SpecFlow                               |
| **[LivingDocGen](https://github.com/Suban5/LivingDocGen)**                                               | Framework-agnostic single-file HTML from features + many result formats         | Static report cousin of BeeDeeDee’s catalog                     |
| **Cukedoctor**, Allure, cucumber-reporting                                                               | Build-time docs / fancy test reports                                            | CI artefacts, not an indexed local map                          |

**Takeaway:** Cucumber’s strategic layer is **Messages + formatters + living docs**.
BeeDeeDee’s differentiators today are local always-on indexing, Mermaid linkage,
editor deep links, and MCP — not competing with Cucumber as a runner.

## Reverse-engineering / “simulate from code” tooling

These go the other way: infer behaviour (often Gherkin) from an existing system.

| Tool                                                                                          | Direction                                                                    | Notes                                                              |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **[Reversa](https://github.com/sandeco/reversa)** ([paper](https://arxiv.org/abs/2605.18684)) | Code → operational specs + Gherkin parity scenarios via multi-agent pipeline | Explicitly for legacy → agent handoff; COBOL ATM case study        |
| **[Greenfield](https://github.com/prime-radiant-inc/greenfield)**                             | Multi-source reverse eng → sanitised behavioural specs + test vectors        | Emphasises “what it does” without leaking implementation           |
| **[Pathfinder](https://github.com/srpadrono/Pathfinder)**                                     | Code → user-journey Mermaid coverage maps → generate UI tests for gaps       | Closest “gap map” cousin; journey-first, not Gherkin-catalog-first |
| **[Graphify](https://graphify.net/)**                                                         | Repo → knowledge graph for coding agents (AST + LLM + Mermaid/HTML)          | Structure/context for agents, not BDD status                       |
| **[SpecMason](https://pypi.org/project/specmason/)**                                          | Bidirectional coverage between behaviour specs and pytest + evidence import  | Brownfield mapping / reverse coverage; Python ledger style         |

**Takeaway:** A second cluster is forming around **reverse documentation engineering** —
agents that invent or recover specs from code. BeeDeeDee currently assumes specs
exist; those tools could feed it, or BeeDeeDee could later grow a “propose Gherkin
from journeys” loop (MCP already has `propose_gherkin` as a draft path).

## System modelling (Gurki)

A third cluster sits beside living docs and reverse-spec: **system value
modelling** in a Gherkin-shaped language that is _not_ a Cucumber dialect.

| Tool                                                                           | What it does                                                                                                            | Overlap with BeeDeeDee                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **[Gurki](https://gurki.nz)** ([repo](https://github.com/danalexilewis/gurki)) | Tiny Gherkin flavour: `System`, `Output`, `Outcome`, `Activates`; derived system value reports and optional ledger nets | Intended primary dialect for BeeDeeDee — see [gurki-migration-plan.md](./gurki-migration-plan.md) |
| **[Policy Bias](https://policybias.com)**                                      | Browsable card wall / game built from Gurki `*.spec.md` corpora                                                         | Proof of “specs → aggregate canvas”; product is separate from the workbench                       |

Gurki answers what exists, what happens, what is produced, what changes, and what
becomes possible next. Cucumber living docs answer whether automated scenarios
passed. BeeDeeDee’s bet after the Gurki move is to index the former and still
ingest the latter where tests exist.

## Useful seams if we borrow rather than rebuild

1. **Adopt Gurki as the modelling dialect** — parse/lint/value-report via the
   `gurki` package; keep BeeDeeDee as index + UI + MCP (plan above).
2. **Ingest Cucumber Messages** — first-class consumer of the Cucumber
   platform’s wire format instead of only Playwright/Vitest/Jest JSON.
3. **Reuse `@cucumber/gherkin` / Messages types** for the classic transitional
   path only.
4. **Treat reverse-spec tools as upstream** — Pathfinder/Reversa/Greenfield produce
   artefacts; BeeDeeDee indexes and governs them.
5. **Stay local + MCP** — SaaS living-doc products (Studio, Azure LivingDoc) own
   collaboration; BeeDeeDee owns the developer/agent loop on disk.

## Explicit non-goals (for now)

Matching Serenity’s illustrated narrative docs, or becoming a full Cucumber
runner. The workbench is the map and control plane, not the execution engine.
Simulation remains out of scope (same as Gurki v0.1).

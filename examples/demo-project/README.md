# Demo project

A small project with realistic specifications, used by the end-to-end suite and
useful for trying the workbench without pointing it at your own code.

```bash
node packages/behavior-cli/dist/cli.js --cwd examples/demo-project serve
```

## What it contains

Five features across three areas, chosen to exercise the parts of Gherkin that
are easy to get wrong:

| Feature                                 | Exercises                                     |
| --------------------------------------- | --------------------------------------------- |
| `authentication/login.feature`          | A `Background` and a `Rule` block             |
| `authentication/password-reset.feature` | A `Scenario Outline` with `Examples`          |
| `billing/invoicing.feature`             | Plain scenarios with a linked test            |
| `billing/refunds.feature`               | Multiple tags on one feature                  |
| `reporting/exports.feature`             | Deliberately untagged, so the lint rule fires |

Three diagrams cover different Mermaid types — two flowcharts and a sequence
diagram — and two test files link to some but not all scenarios, so coverage sits
somewhere interesting rather than at 0% or 100%.

There is also one architecture map
(`specs/mappings/product-overview.architecture.json`) that drives the
Architecture canvas: user flows above a divider, domain model below, and lineage
edges between them.

The untagged `exports.feature` is intentional. Without it the problems view would
have nothing to show and its tests would assert an empty state forever.

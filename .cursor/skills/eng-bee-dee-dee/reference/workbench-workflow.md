# Workbench workflow

How authored specs get into BeeDeeDee. The workbench does **not** invent Gherkin from an application — you author `.feature` (and optional `.mmd`) files, then point the CLI at the project.

## After writing specs

From a built BeeDeeDee checkout:

```bash
# once per project (optional)
node packages/behavior-cli/dist/cli.js --cwd <project> init

# parse + report counts / parse errors
node packages/behavior-cli/dist/cli.js --cwd <project> index

# style findings (errors fail; warnings do not)
node packages/behavior-cli/dist/cli.js --cwd <project> lint

# UI + API
node packages/behavior-cli/dist/cli.js --cwd <project> serve
```

Open the printed URL (default `http://127.0.0.1:4000`).

## Optional: test results

```bash
npx playwright test --reporter=json > results.json
node packages/behavior-cli/dist/cli.js --cwd <project> ingest-tests results.json --format playwright-json
```

Supported report families: Playwright JSON, Vitest, Jest, and BeeDeeDee `native`.

## Other commands

| Command          | Purpose                                 |
| ---------------- | --------------------------------------- |
| `validate-links` | Editor deep links resolve to real files |
| `export`         | Catalog as JSON, CSV, or Markdown       |

## What “analysing a project” means

1. Layout/config points at real feature and test roots.
2. Features and diagrams exist under those roots.
3. `index` / `serve` show coverage against linked tests.
4. Gaps (untagged features, unlinked scenarios) are expected until tests catch up — author specs first.

If `index` reports zero features, paths are wrong or no `.feature` files exist yet.

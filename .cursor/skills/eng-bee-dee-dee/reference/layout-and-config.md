# Layout and config

Copied BeeDeeDee conventions for projects that may not have BeeDeeDee installed.

## Default paths

Relative to the project root:

```
specs/features/**/*.feature     Gherkin specifications
specs/diagrams/**/*.mmd         Mermaid diagrams
tests/e2e/**/*.spec.ts          end-to-end tests
tests/components/**/*.spec.ts   component tests
```

Optional third test path when configured: `testPaths.unit`.

## `.behaviorrc`

Filenames searched, in order: `.behaviorrc`, then `.behaviorrc.json`.

- **Missing file** — fine; defaults apply.
- **Present but invalid JSON / schema** — fatal; do not invent a silent fallback.
- **Every field optional** — only override what differs from defaults.

```json
{
  "name": "My Project",
  "specPaths": {
    "features": "specs/features",
    "diagrams": "specs/diagrams",
    "mappings": "specs/mappings"
  },
  "testPaths": {
    "e2e": "tests/e2e",
    "components": "tests/components",
    "unit": "tests/unit"
  },
  "editorConfig": {
    "supportedEditors": ["cursor", "vscode"],
    "openCommand": "cursor"
  },
  "server": {
    "port": 4000,
    "host": "127.0.0.1"
  }
}
```

Constraints:

- `supportedEditors`: `vscode` | `cursor` | `intellij` (at least one if set)
- `server.port`: integer 1–65535
- Path strings must be non-empty when set
- `id` and `rootPath` are derived from the project directory — never put them in the file

## Pointing the CLI at a project

From a BeeDeeDee checkout (after `pnpm build`):

```bash
node packages/behavior-cli/dist/cli.js --cwd /path/to/project init
node packages/behavior-cli/dist/cli.js --cwd /path/to/project index
node packages/behavior-cli/dist/cli.js --cwd /path/to/project serve
```

`--cwd` / `-C` is the project root that owns `.behaviorrc` and the spec trees.

## Feature file layout

Prefer area folders under the features root:

```
specs/features/authentication/login.feature
specs/features/billing/invoicing.feature
```

Diagrams often share a slug with the feature: `specs/diagrams/login.mmd`.

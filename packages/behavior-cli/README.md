# @eddy/behavior-cli

The `behavior` command. Every subcommand is a thin adapter: parse arguments, call
one function, turn the result into an exit code.

## Commands

| Command                          | Exit code                                      |
| -------------------------------- | ---------------------------------------------- |
| `behavior init`                  | 1 if `.behaviorrc` exists without `--force`    |
| `behavior index`                 | 0 even with parse problems, which are reported |
| `behavior serve`                 | Runs until interrupted                         |
| `behavior ingest-tests <report>` | 1 for a missing or malformed report            |
| `behavior lint [paths...]`       | 1 only for error-severity findings             |
| `behavior validate-links`        | 1 if any editor link is dead                   |
| `behavior export`                | 0, writing JSON, CSV, or Markdown to stdout    |

Global options: `--cwd <path>` to operate on another project, `--verbose` to log
progress.

`behavior lint` deliberately exits zero for warnings and info, so a CI job can
surface findings without blocking. `behavior index` reports files that failed to
parse but still exits zero, because the rest of the index is usable — Requirement
1.5 treats those as findings rather than failures.

## Configuration

`.behaviorrc` is JSON and every field is optional; the file exists to override
defaults, not restate them. See the root README for the shape.

A missing file is not an error — the defaults describe the conventional layout, so
the workbench works on a project nobody has configured. A file that exists but is
malformed _is_ an error, because ignoring it would leave the user staring at the
wrong directories with no explanation.

## Serving

`behavior serve` runs one process serving the API and the built SPA. It finds the
bundle beside the CLI's own `dist` when installed as a package, or in the sibling
`behavior-web/dist` when run from the repository, so it works in both without
configuration.

- `--port` / `--host` override `.behaviorrc`
- `--no-watch` disables re-indexing on file change
- `--api-only` serves the API alone, for use behind the Vite dev server

## Testing

```bash
pnpm --filter @eddy/behavior-cli build
pnpm vitest run --project behavior-cli
```

Command bodies are unit-tested against an in-memory filesystem with captured
output. A separate suite spawns the built binary for real argument parsing, exit
codes, and stdout — `cli.ts` is excluded from coverage because v8 does not follow
into a child process, so the figure would understate what those tests exercise.

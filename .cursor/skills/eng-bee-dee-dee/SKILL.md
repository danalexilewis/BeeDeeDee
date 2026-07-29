---
name: eng-bee-dee-dee
description: Writes and updates BeeDeeDee Gherkin specs, Mermaid diagrams, and .behaviorrc configuration. Use when authoring or revising behavior specs, converting e2e tests or markdown into Gherkin, drafting BA discovery specs, or aligning a project with BeeDeeDee layout.
disable-model-invocation: true
---

# eng-bee-dee-dee

Author and update BeeDeeDee behavior specs for any project. You are the high-reasoning orchestrator. Fan specialized work out to cheap subagents; merge and write yourself.

This skill is self-contained. Read the files under this skill directory. Do not assume BeeDeeDee is installed on the machine.

## Install (global)

The skill lives in the BeeDeeDee repo. To expose it as a personal Cursor skill:

```bash
bash .cursor/skills/eng-bee-dee-dee/scripts/install-global.sh
```

That symlinks `~/.cursor/skills/eng-bee-dee-dee` → this directory. Re-run with `--force` to replace a conflicting path.

## Workflow

Copy and track:

```
Progress:
- [ ] Orient
- [ ] Classify lanes
- [ ] Spawn cheap subagents
- [ ] Merge
- [ ] Write
- [ ] Verify
```

### 1. Orient

- Identify the **target project root** (user path, `--cwd`, or current workspace).
- Read `.behaviorrc` / `.behaviorrc.json` if present.
- If missing, use defaults from [reference/layout-and-config.md](reference/layout-and-config.md).
- List existing features under the configured `specPaths.features` so updates stay additive and name-stable.

### 2. Classify

Map the ask to one or more lanes:

| Lane | Playbook | Use when |
|------|----------|----------|
| Gherkin | [agents/gherkin.md](agents/gherkin.md) | New/updated `.feature` files, Rules, Outlines, tags |
| E2E conversion | [agents/e2e-conversion.md](agents/e2e-conversion.md) | Playwright/Cypress/Vitest browser tests → scenarios |
| Markdown conversion | [agents/markdown-conversion.md](agents/markdown-conversion.md) | README/PRD/notes → features |
| BA discovery | [agents/ba-discovery.md](agents/ba-discovery.md) | Stakeholder language → draft Feature/Scenario backlog |
| Mermaid | [agents/mermaid.md](agents/mermaid.md) | Flow/sequence diagrams for a topic |
| Layout/config | [agents/layout-config.md](agents/layout-config.md) | `.behaviorrc`, folder layout, path remaps |

### 3. Spawn cheap subagents

Use the `Task` tool with:

- `subagent_type`: `generalPurpose`
- `model`: `composer-2.5` or `composer-2.5-fast`
- One Task per lane (parallel when lanes are independent)

Each subagent prompt **must** include:

1. The full text of the matching `agents/*.md` playbook (read it and paste).
2. The relevant slices of [reference/gherkin-style.md](reference/gherkin-style.md) and/or [reference/layout-and-config.md](reference/layout-and-config.md).
3. Target paths from `.behaviorrc` (or defaults).
4. **Only** the source files needed for that lane — never the whole repo.
5. Explicit output shape: proposed file paths + full file contents (or unified diffs for updates). No prose-only answers.

Parent owns decisions. Subagents draft; they do not write files.

### 4. Merge

- Deduplicate scenarios that appear from multiple lanes (prefer clearer BA wording; keep e2e-derived tags like `@e2e` when useful).
- Enforce [reference/gherkin-style.md](reference/gherkin-style.md).
- When updating an existing feature: keep scenario **names** stable unless the user asked to rename; add new scenarios rather than reshuffling.
- Align Mermaid titles/tags with related features.

### 5. Write

- Create/update `.feature` under `specPaths.features` (area subfolders encouraged, e.g. `authentication/login.feature`).
- Create/update `.mmd` under `specPaths.diagrams` when the Mermaid lane ran.
- Create/update `.behaviorrc` only when the layout lane ran or paths must change.
- Prefer additive edits. Do not delete scenarios unless asked.

### 6. Verify

Checklist (from gherkin-style):

- [ ] Every scenario has a name and at least one step
- [ ] No duplicate scenario names in a feature
- [ ] Feature has a description and at least one tag when practical
- [ ] Scenarios do not open with And/But
- [ ] Prefer a Given; keep steps ≤ 10
- [ ] Paths match `.behaviorrc` / defaults

If the BeeDeeDee CLI is built and reachable, suggest:

```bash
node <beedeedee>/packages/behavior-cli/dist/cli.js --cwd <project> index
node <beedeedee>/packages/behavior-cli/dist/cli.js --cwd <project> lint
```

Do not require the CLI to finish authoring. See [reference/workbench-workflow.md](reference/workbench-workflow.md).

## Style defaults

- Declarative, business-readable steps (no CSS selectors, no `click('#btn')`).
- One behaviour per scenario; use `Rule` / `Scenario Outline` when they clarify.
- Tags for area (`@auth`), risk (`@smoke`), and source (`@from-e2e`, `@draft`) when helpful.
- Example shape: [examples/login.feature](examples/login.feature).

## Anti-patterns

- Dumping the whole codebase into one subagent
- Using a high-cost model for specialist drafts
- Inventing UI implementation details as steps
- Rewriting an entire feature file to add one scenario
- Assuming BeeDeeDee packages are importable from the target project

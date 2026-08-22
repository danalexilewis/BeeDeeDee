# @eddy/behavior-mcp

An MCP server exposing the workbench's picture of a project to AI agents.

## Connecting

```json
{
  "mcpServers": {
    "behavior-workbench": {
      "command": "npx",
      "args": ["behavior-mcp", "--project", "/path/to/your/project"]
    }
  }
}
```

Options: `--project <path>` (or `-C`), and `--allow-writes`.

## Tools

| Tool                   | Purpose                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `describe_project`     | Every feature with counts, coverage, status, and tags                              |
| `find_features`        | Search features by title, description, or tag                                      |
| `get_behavior_context` | One scenario with tests, results, diagrams, code references, and suggested actions |
| `validate_gherkin`     | Check Gherkin against the project's conventions                                    |
| `suggest_tests`        | Scenarios needing attention, untested first                                        |
| `propose_gherkin`      | Draft a scenario in the project's idiom, writing nothing                           |
| `append_scenario`      | Append to a feature file, refused unless writes are enabled                        |

Plus a `behavior://scenarios/{scenarioId}` resource.

An agent is expected to start with `describe_project` or `find_features`, then
`get_behavior_context` for a specific scenario, and validate anything it drafts
before proposing it. The server's `instructions` say so.

## Security

The design's security section asks for four controls, and all four are structural
rather than advisory.

**Separate process.** Its own binary, launched by the host.

**Restricted filesystem.** The adapter is confined to the project root, so
`../../etc/passwd` fails with `PathEscapesProject` before any I/O.

**Audit trail.** Every call is recorded with its outcome — including refused
writes as `denied` — and written to stderr, because stdout carries the protocol.
Long arguments are truncated so one large payload cannot bury the log.

**Confirmation before writes.** Writes are refused unless the host passed
`--allow-writes`, so a human authorises them once, out of band, rather than the
agent deciding for itself. A test asserts no other flag combination can enable
them.

`propose_gherkin` returns a draft rather than writing one, which satisfies the
confirmation requirement without depending on the client supporting elicitation.
It reuses the feature's own tags and existing step patterns, since inventing
vocabulary is the most common way agent-authored Gherkin drifts from a project.

## Failure behaviour

Tool failures are reported in-band as `isError` responses, which is what the MCP
SDK does and what lets an agent recover. Argument validation behaves the same way.

A failed index scan still serves: tools report `IndexNotReady`, which tells the
agent to ask the human rather than reading an empty catalog as "this project has
no specs".

## Testing

```bash
pnpm vitest run --project behavior-mcp
```

Integration tests run a real client and server over a linked in-memory transport,
so tool discovery, argument validation, and resource reads all cross the wire.

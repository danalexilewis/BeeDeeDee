import { createFixedClock, createMemoryIndexStore, createSilentLogger } from '@eddy/behavior-core';
import {
  createFakeFileSystem,
  createTestFiles,
  createTestProject,
} from '@eddy/behavior-core/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuditEntry } from './audit.js';
import { createBehaviorMcpServer, type BehaviorMcpServer } from './server.js';

const SCENARIO = 'login.successful-login';

type Harness = {
  client: Client;
  mcp: BehaviorMcpServer;
  audit: AuditEntry[];
  close(): Promise<void>;
};

/**
 * Boots the server and a client over a linked in-memory transport, so tests
 * exercise real MCP framing: tool discovery, argument validation, and resource
 * reads all go over the wire rather than calling handlers directly.
 */
async function createHarness(
  options: { files?: Record<string, string>; allowWrites?: boolean } = {}
): Promise<Harness> {
  const audit: AuditEntry[] = [];
  const fileSystem = createFakeFileSystem(options.files ?? createTestFiles());

  const mcp = createBehaviorMcpServer({
    project: createTestProject(),
    projectRoot: '/repo',
    ...(options.allowWrites === undefined ? {} : { allowWrites: options.allowWrites }),
    fileSystem,
    clock: createFixedClock(),
    logger: createSilentLogger(),
    indexStore: createMemoryIndexStore(),
    onAudit(entry) {
      audit.push(entry);
    },
  });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' });

  await Promise.all([mcp.connect(serverTransport), client.connect(clientTransport)]);

  return {
    client,
    mcp,
    audit,
    async close() {
      await client.close();
      await mcp.close();
    },
  };
}

/**
 * The first text block of a tool response.
 *
 * `callTool` returns a union covering structured and legacy shapes, and content
 * blocks may be text, image, or resource, so the narrowing happens here once
 * rather than in every assertion.
 */
function textOf(result: unknown): string {
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) throw new Error('Tool response carried no content array');

  const first = content[0] as { type?: string; text?: string } | undefined;
  if (first?.type !== 'text' || typeof first.text !== 'string') {
    throw new Error(`Expected a text content block, saw ${JSON.stringify(first)}`);
  }

  return first.text;
}

/** Parses the JSON payload out of a tool response. */
function payloadOf(result: unknown): unknown {
  return JSON.parse(textOf(result));
}

/** The text of a resource's first content block. */
function resourceTextOf(contents: unknown): string {
  const first = (contents as Array<{ text?: unknown }>)[0];
  if (typeof first?.text !== 'string') {
    throw new Error('Expected a text resource, saw a blob');
  }
  return first.text;
}

let harness: Harness;

afterEach(async () => {
  await harness?.close();
});

describe('tool discovery', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('advertises every tool', async () => {
    const { tools } = await harness.client.listTools();
    expect(tools.map(tool => tool.name).sort()).toEqual([
      'append_scenario',
      'describe_project',
      'find_features',
      'get_behavior_context',
      'propose_gherkin',
      'suggest_tests',
      'validate_gherkin',
    ]);
  });

  it('describes each tool so an agent can choose between them', async () => {
    const { tools } = await harness.client.listTools();
    for (const tool of tools) {
      expect(tool.description, tool.name).toBeTruthy();
    }
  });

  it('marks the read-only tools as such', async () => {
    const { tools } = await harness.client.listTools();
    const readOnly = tools.filter(tool => tool.annotations?.readOnlyHint === true);
    expect(readOnly.map(tool => tool.name)).toContain('get_behavior_context');
    expect(readOnly.map(tool => tool.name)).not.toContain('append_scenario');
  });
});

describe('describe_project', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('summarises the indexed project', async () => {
    const result = await harness.client.callTool({ name: 'describe_project', arguments: {} });
    const catalog = payloadOf(result) as { features: Array<{ id: string }> };

    expect(catalog.features.map(feature => feature.id)).toEqual(['billing', 'login']);
  });
});

describe('find_features', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('returns every feature with no search term', async () => {
    const result = await harness.client.callTool({ name: 'find_features', arguments: {} });
    expect(payloadOf(result)).toHaveLength(2);
  });

  it('filters by search term', async () => {
    const result = await harness.client.callTool({
      name: 'find_features',
      arguments: { search: 'invoiced' },
    });
    expect(payloadOf(result)).toHaveLength(1);
  });
});

describe('get_behavior_context', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('returns the scenario with its related context', async () => {
    const result = await harness.client.callTool({
      name: 'get_behavior_context',
      arguments: { scenarioId: SCENARIO },
    });

    const context = payloadOf(result) as {
      scenario: { id: string };
      relatedScenarios: unknown[];
      codeReferences: unknown[];
      suggestedActions: unknown[];
    };

    expect(context.scenario.id).toBe(SCENARIO);
    expect(context.relatedScenarios.length).toBeGreaterThan(0);
    expect(context.codeReferences.length).toBeGreaterThan(0);
  });

  it('reports an unknown scenario as a tool error, not a transport failure', async () => {
    const result = await harness.client.callTool({
      name: 'get_behavior_context',
      arguments: { scenarioId: 'nope' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Scenario not found');
  });

  it('reports a missing argument as a validation error', async () => {
    // The SDK validates against the tool's input schema and reports failures
    // in-band, so the agent gets a structured error rather than a dead call.
    const result = await harness.client.callTool({
      name: 'get_behavior_context',
      arguments: {},
    });

    expect(result.isError).toBe(true);
    expect(textOf(result).toLowerCase()).toContain('scenarioid');
  });
});

describe('validate_gherkin', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('accepts Gherkin that follows project conventions', async () => {
    const result = await harness.client.callTool({
      name: 'validate_gherkin',
      arguments: {
        gherkin:
          '@auth\nFeature: Reset\n  Scenario: Reset requested\n    Given a registered user\n',
      },
    });

    const validation = payloadOf(result) as { valid: boolean; compatibility: number };
    expect(validation.valid).toBe(true);
    expect(validation.compatibility).toBeGreaterThan(0);
  });

  it('reports unparseable input as invalid rather than erroring', async () => {
    // The agent asked "is this good Gherkin"; "no, it does not parse" answers
    // that rather than being a failure to answer.
    const result = await harness.client.callTool({
      name: 'validate_gherkin',
      arguments: { gherkin: 'not gherkin' },
    });

    expect(result.isError).toBeFalsy();
    const validation = payloadOf(result) as { valid: boolean; compatibility: number };
    expect(validation.valid).toBe(false);
    expect(validation.compatibility).toBe(0);
  });

  it('reports an empty string as a validation error', async () => {
    const result = await harness.client.callTool({
      name: 'validate_gherkin',
      arguments: { gherkin: '' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('suggest_tests', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('puts scenarios with no test first', async () => {
    const result = await harness.client.callTool({
      name: 'suggest_tests',
      arguments: { limit: 10 },
    });

    const suggestions = payloadOf(result) as Array<{ scenarioId: string; reason: string }>;
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]!.reason).toBe('no-test');
  });

  it('omits scenarios that already have a passing test', async () => {
    const result = await harness.client.callTool({
      name: 'suggest_tests',
      arguments: { limit: 10 },
    });

    const suggestions = payloadOf(result) as Array<{ scenarioId: string }>;
    expect(suggestions.map(suggestion => suggestion.scenarioId)).not.toContain(SCENARIO);
  });

  it('honours the limit', async () => {
    const result = await harness.client.callTool({
      name: 'suggest_tests',
      arguments: { limit: 1 },
    });
    expect(payloadOf(result)).toHaveLength(1);
  });

  it('reports a limit above the allowed range as a validation error', async () => {
    const result = await harness.client.callTool({
      name: 'suggest_tests',
      arguments: { limit: 1000 },
    });
    expect(result.isError).toBe(true);
  });
});

describe('propose_gherkin', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('drafts a scenario reusing the feature tags and existing steps', async () => {
    const result = await harness.client.callTool({
      name: 'propose_gherkin',
      arguments: {
        featureId: 'login',
        scenarioName: 'Password reset requested',
        intent: 'the user requests a password reset',
      },
    });

    const proposal = payloadOf(result) as {
      gherkin: string;
      targetPath: string;
      conventionsUsed: { tags: string[]; stepPatterns: string[] };
      predictedScenarioId: string;
    };

    expect(proposal.gherkin).toContain('Scenario: Password reset requested');
    expect(proposal.gherkin).toContain('@auth');
    expect(proposal.targetPath).toBe('specs/features/login.feature');
    expect(proposal.conventionsUsed.stepPatterns.length).toBeGreaterThan(0);
    expect(proposal.predictedScenarioId).toBe('login.password-reset-requested');
  });

  it('includes validation findings alongside the draft', async () => {
    const result = await harness.client.callTool({
      name: 'propose_gherkin',
      arguments: { featureId: 'login', scenarioName: 'A new case', intent: 'something happens' },
    });

    const proposal = payloadOf(result) as { validation: { compatibility: number } };
    expect(typeof proposal.validation.compatibility).toBe('number');
  });

  it('writes nothing', async () => {
    await harness.client.callTool({
      name: 'propose_gherkin',
      arguments: { featureId: 'login', scenarioName: 'A new case', intent: 'something happens' },
    });

    const audit = harness.audit.filter(entry => entry.tool === 'append_scenario');
    expect(audit).toEqual([]);
  });

  it('reports an unknown feature', async () => {
    const result = await harness.client.callTool({
      name: 'propose_gherkin',
      arguments: { featureId: 'nope', scenarioName: 'X', intent: 'y' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Feature not found');
  });
});

describe('append_scenario write gating', () => {
  it('refuses when writes are disabled', async () => {
    harness = await createHarness();

    const result = await harness.client.callTool({
      name: 'append_scenario',
      arguments: { featureId: 'login', gherkin: '  Scenario: New\n    Given x\n' },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('--allow-writes');
  });

  it('records a refused write as denied in the audit trail', async () => {
    harness = await createHarness();

    await harness.client.callTool({
      name: 'append_scenario',
      arguments: { featureId: 'login', gherkin: '  Scenario: New\n    Given x\n' },
    });

    const entry = harness.audit.find(candidate => candidate.tool === 'append_scenario');
    expect(entry?.outcome).toBe('denied');
  });

  it('appends when writes are enabled', async () => {
    harness = await createHarness({ allowWrites: true });

    const result = await harness.client.callTool({
      name: 'append_scenario',
      arguments: { featureId: 'login', gherkin: '  Scenario: Appended\n    Given x\n' },
    });

    expect(result.isError).toBeFalsy();
    const outcome = payloadOf(result) as { written: boolean; path: string };
    expect(outcome.written).toBe(true);
    expect(outcome.path).toBe('specs/features/login.feature');
  });

  it('reports an unknown feature even with writes enabled', async () => {
    harness = await createHarness({ allowWrites: true });

    const result = await harness.client.callTool({
      name: 'append_scenario',
      arguments: { featureId: 'nope', gherkin: '  Scenario: X\n    Given y\n' },
    });

    expect(result.isError).toBe(true);
  });
});

describe('behavior://scenarios resource', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('reads one scenario by uri', async () => {
    const result = await harness.client.readResource({
      uri: `behavior://scenarios/${SCENARIO}`,
    });

    expect(result.contents).toHaveLength(1);
    const scenario = JSON.parse(resourceTextOf(result.contents)) as { id: string; name: string };
    expect(scenario.id).toBe(SCENARIO);
    expect(scenario.name).toBe('Successful login');
  });

  it('declares a JSON mime type', async () => {
    const result = await harness.client.readResource({
      uri: `behavior://scenarios/${SCENARIO}`,
    });
    expect(result.contents[0]!.mimeType).toBe('application/json');
  });

  it('fails for an unknown scenario', async () => {
    await expect(
      harness.client.readResource({ uri: 'behavior://scenarios/nope' })
    ).rejects.toThrow();
  });
});

describe('audit trail', () => {
  beforeEach(async () => {
    harness = await createHarness();
  });

  it('records each successful call', async () => {
    await harness.client.callTool({ name: 'describe_project', arguments: {} });

    const entry = harness.audit.find(candidate => candidate.tool === 'describe_project');
    expect(entry).toMatchObject({ outcome: 'ok', at: '2026-01-01T00:00:00.000Z' });
  });

  it('records a failure with its reason', async () => {
    await harness.client.callTool({
      name: 'get_behavior_context',
      arguments: { scenarioId: 'nope' },
    });

    const entry = harness.audit.find(candidate => candidate.tool === 'get_behavior_context');
    expect(entry?.outcome).toBe('error');
    expect(entry?.detail).toContain('Scenario not found');
  });

  it('records resource reads', async () => {
    await harness.client.readResource({ uri: `behavior://scenarios/${SCENARIO}` });
    expect(harness.audit.some(entry => entry.tool === 'resource:scenario')).toBe(true);
  });

  it('truncates a long argument so one payload cannot bury the trail', async () => {
    const long = 'Feature: X\n'.repeat(500);
    await harness.client.callTool({ name: 'validate_gherkin', arguments: { gherkin: long } });

    const entry = harness.audit.find(candidate => candidate.tool === 'validate_gherkin');
    expect(String(entry?.input['gherkin']).length).toBeLessThan(long.length);
    expect(String(entry?.input['gherkin'])).toContain('chars)');
  });

  it('keeps the trail readable through the in-memory log', async () => {
    await harness.client.callTool({ name: 'describe_project', arguments: {} });
    expect(harness.mcp.auditLog.entries().length).toBeGreaterThan(0);
  });
});

describe('serving an unindexable project', () => {
  it('still connects and reports the index is not ready', async () => {
    // Better for the agent to be told the index failed than to be handed an
    // empty catalog it would read as "this project has no specs".
    harness = await createHarness({ files: {} });

    const unlistable = createBehaviorMcpServer({
      project: createTestProject(),
      projectRoot: '/repo',
      fileSystem: createFakeFileSystem(createTestFiles(), { unlistable: ['specs/features'] }),
      clock: createFixedClock(),
      logger: createSilentLogger(),
      indexStore: createMemoryIndexStore(),
    });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-agent', version: '1.0.0' });
    await Promise.all([unlistable.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({ name: 'describe_project', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not ready');

    await client.close();
    await unlistable.close();
  });
});

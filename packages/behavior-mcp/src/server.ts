import type { ProjectMetadata } from '@eddy/behavior-contracts';
import {
  createMemoryIndexStore,
  createNodeFileSystem,
  createSilentLogger,
  createSystemClock,
  indexBehaviorSpecs,
  type ClockPort,
  type FileSystemPort,
  type IndexStorePort,
  type LoggerPort,
} from '@eddy/behavior-core';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { resolve } from 'node:path';
import { z } from 'zod';
import { createAuditLog, type AuditEntry, type AuditLog } from './audit.js';
import {
  appendScenario,
  describeProject,
  findFeatures,
  getBehaviorContext,
  predictScenarioId,
  proposeGherkin,
  readScenario,
  suggestTests,
  toToolError,
  validateCandidateGherkin,
  type ToolDeps,
} from './tools.js';

export type CreateMcpServerOptions = {
  project: ProjectMetadata;
  projectRoot: string;
  /** Permit tools that modify spec files. Off unless the host opts in. */
  allowWrites?: boolean;
  fileSystem?: FileSystemPort;
  clock?: ClockPort;
  logger?: LoggerPort;
  indexStore?: IndexStorePort;
  /** Receives each audit entry, so a host can persist the trail. */
  onAudit?: (entry: AuditEntry) => void;
};

export type BehaviorMcpServer = {
  server: McpServer;
  auditLog: AuditLog;
  /** Indexes the project, then serves over the given transport. */
  connect(transport: Transport): Promise<void>;
  close(): Promise<void>;
};

/** A successful tool response carrying structured JSON. */
function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

/** A failed tool response. MCP reports tool failures in-band, not as throws. */
function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

/**
 * Builds the MCP server.
 *
 * Runs in its own process with a filesystem adapter confined to the project root,
 * writes disabled by default, and every call recorded — the three controls the
 * design's security section asks for.
 */
export function createBehaviorMcpServer(options: CreateMcpServerOptions): BehaviorMcpServer {
  const projectRoot = resolve(options.projectRoot);
  const clock = options.clock ?? createSystemClock();
  const fileSystem = options.fileSystem ?? createNodeFileSystem(projectRoot);
  const logger = options.logger ?? createSilentLogger();
  const indexStore = options.indexStore ?? createMemoryIndexStore();

  const auditLog = createAuditLog({
    clock,
    ...(options.onAudit === undefined ? {} : { sink: options.onAudit }),
  });

  const deps: ToolDeps = {
    indexStore,
    fileSystem,
    clock,
    writesAllowed: options.allowWrites === true,
  };

  const server = new McpServer(
    { name: 'behavior-workbench', version: '0.1.0' },
    {
      instructions:
        "Behavior Workbench exposes a project's Gherkin specifications, linked " +
        'tests, and diagrams. Start with describe_project or find_features to ' +
        'orient yourself, then get_behavior_context for a specific scenario. ' +
        'Validate any Gherkin you draft with validate_gherkin before proposing it.',
    }
  );

  /** Records the call and renders the result. */
  function complete(
    tool: string,
    input: Record<string, unknown>,
    outcome: { ok: true; value: unknown } | { ok: false; message: string; denied?: boolean }
  ) {
    if (outcome.ok) {
      auditLog.record({ tool, input, outcome: 'ok' });
      return jsonResult(outcome.value);
    }

    auditLog.record({
      tool,
      input,
      outcome: outcome.denied === true ? 'denied' : 'error',
      detail: outcome.message,
    });
    return errorResult(outcome.message);
  }

  server.registerTool(
    'describe_project',
    {
      title: 'Describe the project',
      description:
        'Summarise the indexed project: every feature with its scenario count, coverage, status, and tags.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async function handleDescribeProject() {
      const result = describeProject(deps);
      return result.isOk()
        ? complete('describe_project', {}, { ok: true, value: result.value })
        : complete('describe_project', {}, { ok: false, message: toToolError(result.error) });
    }
  );

  server.registerTool(
    'find_features',
    {
      title: 'Find features',
      description: 'Search indexed features by title, description, or tag.',
      inputSchema: { search: z.string().optional().describe('Text to match, omitted for all') },
      annotations: { readOnlyHint: true },
    },
    async function handleFindFeatures({ search }) {
      const result = findFeatures(deps, search);
      return result.isOk()
        ? complete('find_features', { search }, { ok: true, value: result.value })
        : complete('find_features', { search }, { ok: false, message: toToolError(result.error) });
    }
  );

  server.registerTool(
    'get_behavior_context',
    {
      title: 'Get behavior context',
      description:
        'Everything known about one scenario: its steps, linked tests and their results, related scenarios, diagrams, code references, and suggested next actions.',
      inputSchema: {
        scenarioId: z.string().describe('Scenario id, e.g. auth.login.successful-login'),
      },
      annotations: { readOnlyHint: true },
    },
    async function handleGetContext({ scenarioId }) {
      const result = getBehaviorContext(deps, scenarioId);
      return result.isOk()
        ? complete('get_behavior_context', { scenarioId }, { ok: true, value: result.value })
        : complete(
            'get_behavior_context',
            { scenarioId },
            { ok: false, message: toToolError(result.error) }
          );
    }
  );

  server.registerTool(
    'validate_gherkin',
    {
      title: 'Validate Gherkin',
      description:
        "Check Gherkin against this project's conventions. Reports a compatibility score, warnings, and suggestions. Unparseable input is reported as invalid rather than failing.",
      inputSchema: { gherkin: z.string().min(1).describe('Gherkin source to check') },
      annotations: { readOnlyHint: true },
    },
    async function handleValidate({ gherkin }) {
      const result = validateCandidateGherkin(deps, gherkin);
      return result.isOk()
        ? complete('validate_gherkin', { gherkin }, { ok: true, value: result.value })
        : complete(
            'validate_gherkin',
            { gherkin },
            { ok: false, message: toToolError(result.error) }
          );
    }
  );

  server.registerTool(
    'suggest_tests',
    {
      title: 'Suggest tests',
      description:
        'Scenarios most in need of attention: those with no test at all first, then failing ones, then flaky ones.',
      inputSchema: {
        limit: z.number().int().min(1).max(100).default(20).describe('Maximum suggestions'),
      },
      annotations: { readOnlyHint: true },
    },
    async function handleSuggest({ limit }) {
      const result = suggestTests(deps, limit);
      return result.isOk()
        ? complete('suggest_tests', { limit }, { ok: true, value: result.value })
        : complete('suggest_tests', { limit }, { ok: false, message: toToolError(result.error) });
    }
  );

  server.registerTool(
    'propose_gherkin',
    {
      title: 'Propose a scenario',
      description:
        "Draft a scenario in the project's own idiom, reusing its tags and existing step patterns. Returns the draft with validation findings; it writes nothing.",
      inputSchema: {
        featureId: z.string().describe('Feature the scenario belongs to'),
        scenarioName: z.string().min(1).describe('Name for the new scenario'),
        intent: z.string().min(1).describe('What the scenario should verify'),
      },
      annotations: { readOnlyHint: true },
    },
    async function handlePropose(input) {
      const result = proposeGherkin(deps, input);
      if (result.isErr()) {
        return complete('propose_gherkin', input, {
          ok: false,
          message: toToolError(result.error),
        });
      }

      return complete('propose_gherkin', input, {
        ok: true,
        value: {
          ...result.value,
          predictedScenarioId: predictScenarioId(input.featureId, input.scenarioName),
        },
      });
    }
  );

  server.registerTool(
    'append_scenario',
    {
      title: 'Append a scenario to a feature file',
      description:
        'Append Gherkin to a feature file. Refused unless the workbench was started with writes enabled, so a human authorises writes out of band.',
      inputSchema: {
        featureId: z.string().describe('Feature to append to'),
        gherkin: z.string().min(1).describe('Scenario Gherkin, indented for a feature body'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async function handleAppend(input) {
      const outcome = await appendScenario(deps, input);

      if (outcome.isErr()) {
        return complete('append_scenario', input, {
          ok: false,
          message: toToolError(outcome.error),
        });
      }

      if (!outcome.value.written) {
        return complete('append_scenario', input, {
          ok: false,
          denied: true,
          message: outcome.value.reason ?? 'Write refused',
        });
      }

      return complete('append_scenario', input, { ok: true, value: outcome.value });
    }
  );

  server.registerResource(
    'scenario',
    new ResourceTemplate('behavior://scenarios/{scenarioId}', { list: undefined }),
    {
      title: 'Behavior scenario',
      description: 'A single scenario with its steps, tags, tests, and status.',
      mimeType: 'application/json',
    },
    async function readScenarioResource(uri, variables) {
      const scenarioId = String(variables['scenarioId']);
      const result = readScenario(deps, scenarioId);

      if (result.isErr()) {
        auditLog.record({
          tool: 'resource:scenario',
          input: { scenarioId },
          outcome: 'error',
          detail: toToolError(result.error),
        });
        throw new Error(toToolError(result.error));
      }

      auditLog.record({ tool: 'resource:scenario', input: { scenarioId }, outcome: 'ok' });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(result.value, null, 2),
          },
        ],
      };
    }
  );

  return {
    server,
    auditLog,

    async connect(transport) {
      const indexed = await indexBehaviorSpecs(
        { fileSystem, clock, logger },
        { project: options.project }
      );

      // A failed scan still serves: tools report IndexNotReady, which tells the
      // agent to ask the human rather than inventing answers.
      if (indexed.isOk()) indexStore.write(indexed.value);
      else indexStore.markFailed();

      await server.connect(transport);
    },

    async close() {
      await server.close();
    },
  };
}

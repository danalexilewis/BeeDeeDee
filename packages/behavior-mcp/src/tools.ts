import type { AgentContext, ValidationResult } from '@eddy/behavior-contracts';
import {
  conventionsFrom,
  describeError,
  generateAgentContext,
  getCatalog,
  getScenario,
  listFeatures,
  slugify,
  testLinksFor,
  validateGherkin,
  type BehaviorError,
  type ClockPort,
  type FileSystemPort,
  type IndexStorePort,
} from '@eddy/behavior-core';
import { err, ok, type Result, type ResultAsync } from 'neverthrow';

export type ToolDeps = {
  indexStore: IndexStorePort;
  fileSystem: FileSystemPort;
  clock: ClockPort;
  /** False unless the host explicitly enabled writes. */
  writesAllowed: boolean;
};

/** A scenario an agent could usefully work on next. */
export type TestSuggestion = {
  scenarioId: string;
  featureId: string;
  scenarioName: string;
  featurePath: string;
  line: number;
  reason: 'no-test' | 'failing' | 'flaky';
  priority: 'high' | 'medium' | 'low';
};

/** Everything an agent needs to reason about one scenario. */
export function getBehaviorContext(
  deps: ToolDeps,
  scenarioId: string
): Result<AgentContext, BehaviorError> {
  return generateAgentContext({ indexStore: deps.indexStore }, scenarioId);
}

/** Validates candidate Gherkin against the project's conventions. */
export function validateCandidateGherkin(
  deps: ToolDeps,
  gherkin: string
): Result<ValidationResult, BehaviorError> {
  return validateGherkin({ indexStore: deps.indexStore }, gherkin);
}

/**
 * Scenarios most in need of attention, highest value first.
 *
 * Ordered by what the index can actually see: a scenario with no test at all is
 * a bigger gap than one that is merely failing, because nobody has expressed the
 * expectation yet.
 */
export function suggestTests(
  deps: ToolDeps,
  limit: number
): Result<TestSuggestion[], BehaviorError> {
  return deps.indexStore.read().map(function collect(index) {
    const suggestions: TestSuggestion[] = [];

    for (const scenario of index.scenarios.values()) {
      const links = testLinksFor(index, scenario.id);
      const results = index.results.get(scenario.id) ?? [];

      const failing = results.some(function isFailure(result) {
        return result.status === 'fail';
      });
      const passed = results.some(function isPass(result) {
        return result.status === 'pass';
      });

      const base = {
        scenarioId: scenario.id,
        featureId: scenario.featureId,
        scenarioName: scenario.name,
        featurePath: scenario.featurePath,
        line: scenario.line,
      };

      if (links.length === 0) {
        suggestions.push({ ...base, reason: 'no-test', priority: 'high' });
        continue;
      }

      if (failing && passed) {
        suggestions.push({ ...base, reason: 'flaky', priority: 'medium' });
        continue;
      }

      if (failing) {
        suggestions.push({ ...base, reason: 'failing', priority: 'high' });
      }
    }

    const order: Record<TestSuggestion['reason'], number> = {
      'no-test': 0,
      failing: 1,
      flaky: 2,
    };

    return suggestions
      .sort(function byReasonThenId(left, right) {
        if (order[left.reason] !== order[right.reason]) {
          return order[left.reason] - order[right.reason];
        }
        return left.scenarioId.localeCompare(right.scenarioId);
      })
      .slice(0, limit);
  });
}

/** A proposed scenario, not yet written anywhere. */
export type GherkinProposal = {
  gherkin: string;
  /** Where it would go if applied. */
  targetPath: string;
  /** Whether the target file already exists. */
  targetExists: boolean;
  validation: ValidationResult;
  /** Tags and step patterns the proposal drew on. */
  conventionsUsed: { tags: string[]; stepPatterns: string[] };
};

/**
 * Drafts a scenario in the project's own idiom.
 *
 * Returns a proposal rather than writing. The design's security section requires
 * user confirmation before a write, and a proposal an agent hands back for review
 * satisfies that without depending on the client supporting elicitation.
 */
export function proposeGherkin(
  deps: ToolDeps,
  input: { featureId: string; scenarioName: string; intent: string }
): Result<GherkinProposal, BehaviorError> {
  return deps.indexStore.read().andThen(function draft(index) {
    const feature = index.features.get(input.featureId);
    if (feature === undefined) {
      return err<GherkinProposal, BehaviorError>({
        tag: 'FeatureNotFound',
        featureId: input.featureId,
      });
    }

    const conventions = conventionsFrom(index);

    // Reuse this feature's own tags, so a proposal is filterable alongside its
    // siblings rather than introducing vocabulary nobody else uses.
    const tags = feature.tags.slice(0, 3);

    // Offer existing step texts as the starting point; an invented step is the
    // most common way agent-authored Gherkin drifts from a project.
    const existingSteps = [...new Set(conventions.knownStepTexts)].slice(0, 3);

    const stepLines =
      existingSteps.length >= 3
        ? [
            `    Given ${existingSteps[0]}`,
            `    When ${existingSteps[1]}`,
            `    Then ${existingSteps[2]}`,
          ]
        : [
            `    Given a starting state for ${input.intent}`,
            `    When ${input.intent}`,
            `    Then the expected outcome is observed`,
          ];

    const gherkin = [
      ...(tags.length > 0 ? [`  ${tags.join(' ')}`] : []),
      `  Scenario: ${input.scenarioName}`,
      ...stepLines,
      '',
    ].join('\n');

    // Validate the draft as a standalone feature so the agent sees the same
    // findings a human would.
    const asFeature = `Feature: ${feature.title}\n${gherkin}`;
    const validation = validateGherkin({ indexStore: deps.indexStore }, asFeature);
    if (validation.isErr()) return err<GherkinProposal, BehaviorError>(validation.error);

    return ok({
      gherkin,
      targetPath: feature.path,
      targetExists: true,
      validation: validation.value,
      conventionsUsed: { tags, stepPatterns: existingSteps },
    });
  });
}

/** Outcome of an attempted write. */
export type WriteOutcome = {
  written: boolean;
  path: string;
  reason?: string;
};

/**
 * Appends a scenario to a feature file.
 *
 * Refuses unless the host started the server with writes enabled, which is the
 * confirmation gate the design asks for: the human decides once, out of band,
 * rather than the agent deciding for itself.
 */
export function appendScenario(
  deps: ToolDeps,
  input: { featureId: string; gherkin: string }
): ResultAsync<WriteOutcome, BehaviorError> | Result<WriteOutcome, BehaviorError> {
  if (!deps.writesAllowed) {
    return ok({
      written: false,
      path: '',
      reason: 'Writes are disabled. Restart behavior-mcp with --allow-writes to permit them.',
    });
  }

  const indexResult = deps.indexStore.read();
  if (indexResult.isErr()) return err(indexResult.error);

  const feature = indexResult.value.features.get(input.featureId);
  if (feature === undefined) {
    return err({ tag: 'FeatureNotFound', featureId: input.featureId });
  }

  const separator = feature.source.endsWith('\n') ? '\n' : '\n\n';
  const next = `${feature.source}${separator}${input.gherkin.trimEnd()}\n`;

  return deps.fileSystem.writeFile(feature.path, next).map(function toOutcome() {
    return { written: true, path: feature.path };
  });
}

/** Features matching a search term, for an agent orienting itself. */
export function findFeatures(deps: ToolDeps, search: string | undefined) {
  return listFeatures({ indexStore: deps.indexStore }, search === undefined ? {} : { search });
}

/** Project-level summary, for an agent orienting itself. */
export function describeProject(deps: ToolDeps) {
  return getCatalog({ indexStore: deps.indexStore });
}

/** One scenario, for the resource handler. */
export function readScenario(deps: ToolDeps, scenarioId: string) {
  return getScenario({ indexStore: deps.indexStore }, scenarioId);
}

/** Renders an error for a tool response. */
export function toToolError(error: BehaviorError): string {
  return describeError(error);
}

/** Suggests a scenario id for a proposed name, so an agent can predict it. */
export function predictScenarioId(featureId: string, scenarioName: string): string {
  return `${featureId}.${slugify(scenarioName)}`;
}

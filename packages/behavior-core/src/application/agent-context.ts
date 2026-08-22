import type { AgentAction, AgentContext, CodeReference } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { overlapCoefficient, tokenSet } from '../domain/text.js';
import { scenarioNotFound, type BehaviorError } from '../errors.js';
import type { IndexStorePort } from '../ports/index-store.js';
import { resultsFor, testLinksFor, type BehaviorIndex } from './behavior-index.js';
import { statusOf, toScenarioDetail, toScenarioSummary } from './projections.js';

export type AgentContextDeps = {
  indexStore: IndexStorePort;
};

/** How many sibling scenarios to include before the context gets unwieldy. */
const MAX_RELATED = 5;

/** Diagrams below this relevance add noise rather than context. */
const MIN_DIAGRAM_RELEVANCE = 0.3;

/**
 * Scenarios most similar to the subject.
 *
 * Same-feature scenarios rank first, since they share a Background and
 * vocabulary, then others by token overlap.
 */
function relatedScenarioIds(index: BehaviorIndex, scenarioId: string): string[] {
  const subject = index.scenarios.get(scenarioId);
  if (subject === undefined) return [];

  const subjectTokens = tokenSet([
    subject.name,
    ...subject.steps.map(function toText(step) {
      return step.text;
    }),
  ]);

  return [...index.scenarios.values()]
    .filter(function isOther(candidate) {
      return candidate.id !== scenarioId;
    })
    .map(function score(candidate) {
      const candidateTokens = tokenSet([
        candidate.name,
        ...candidate.steps.map(function toText(step) {
          return step.text;
        }),
      ]);
      const sameFeature = candidate.featureId === subject.featureId ? 1 : 0;
      return {
        id: candidate.id,
        sameFeature,
        similarity: overlapCoefficient(subjectTokens, candidateTokens),
      };
    })
    .sort(function byRelevance(left, right) {
      if (left.sameFeature !== right.sameFeature) return right.sameFeature - left.sameFeature;
      if (left.similarity !== right.similarity) return right.similarity - left.similarity;
      return left.id.localeCompare(right.id);
    })
    .slice(0, MAX_RELATED)
    .map(function toId(entry) {
      return entry.id;
    });
}

/** Turns linked tests into code references an agent can open. */
function codeReferences(index: BehaviorIndex, scenarioId: string): CodeReference[] {
  const scenario = index.scenarios.get(scenarioId);
  if (scenario === undefined) return [];

  const references: CodeReference[] = [
    {
      path: scenario.featurePath,
      startLine: scenario.line,
      endLine: scenario.steps.at(-1)?.line ?? scenario.line,
      context: `Gherkin for "${scenario.name}"`,
      type: 'config',
    },
  ];

  for (const link of testLinksFor(index, scenarioId)) {
    references.push({
      path: link.path,
      startLine: link.line,
      endLine: link.line,
      context: `${link.framework} test covering "${scenario.name}"`,
      type: 'test',
    });
  }

  return references;
}

/**
 * Suggests what to do next, highest value first.
 *
 * The suggestions follow from gaps the index can actually see: no test at all, a
 * failing test, a flaky test, or a scenario with no diagram to explain it.
 */
function suggestedActions(index: BehaviorIndex, scenarioId: string): AgentAction[] {
  const scenario = index.scenarios.get(scenarioId);
  if (scenario === undefined) return [];

  const status = statusOf(index, scenarioId);
  const actions: AgentAction[] = [];

  if (testLinksFor(index, scenarioId).length === 0) {
    actions.push({
      type: 'generate-test',
      description: `Write a test for "${scenario.name}", which has none`,
      priority: 'high',
      estimatedMinutes: 20,
    });
  }

  if (status.overall === 'fail') {
    actions.push({
      type: 'fix-scenario',
      description: `Investigate the failing test for "${scenario.name}"`,
      priority: 'high',
      estimatedMinutes: 30,
    });
  }

  if (status.flaky) {
    actions.push({
      type: 'fix-scenario',
      description: `Stabilise "${scenario.name}", which has both passed and failed`,
      priority: 'medium',
      estimatedMinutes: 45,
    });
  }

  if (scenario.diagramLinks.length === 0) {
    actions.push({
      type: 'add-diagram',
      description: `Add a diagram explaining "${scenario.name}"`,
      priority: 'low',
      estimatedMinutes: 15,
    });
  }

  if (scenario.steps.length === 0) {
    actions.push({
      type: 'improve-coverage',
      description: `"${scenario.name}" has no steps and asserts nothing`,
      priority: 'high',
      estimatedMinutes: 10,
    });
  }

  return actions;
}

/** Everything an agent needs to reason about one scenario. */
export function generateAgentContext(
  deps: AgentContextDeps,
  scenarioId: string
): Result<AgentContext, BehaviorError> {
  return deps.indexStore.read().andThen(function build(index) {
    const scenario = index.scenarios.get(scenarioId);
    if (scenario === undefined) return err(scenarioNotFound(scenarioId));

    const diagrams = scenario.diagramLinks
      .filter(function isRelevant(link) {
        return link.relevanceScore >= MIN_DIAGRAM_RELEVANCE;
      })
      .flatMap(function toContent(link) {
        const diagram = index.diagrams.get(link.diagramId);
        return diagram === undefined ? [] : [{ ...diagram, link }];
      });

    return ok({
      scenario: toScenarioDetail(index, scenario),
      relatedScenarios: relatedScenarioIds(index, scenarioId).flatMap(function toSummary(id) {
        const related = index.scenarios.get(id);
        return related === undefined ? [] : [toScenarioSummary(index, related)];
      }),
      testResults: resultsFor(index, scenarioId),
      diagrams,
      codeReferences: codeReferences(index, scenarioId),
      suggestedActions: suggestedActions(index, scenarioId),
    });
  });
}

import type { GherkinStep } from '@eddy/behavior-contracts';
import { normalizeName } from './text.js';

/** Optional Gurki (and mapped classic) step kinds. */
export const SPEC_STEP_KINDS = [
  'given',
  'when',
  'then',
  'output',
  'outcome',
  'activates',
] as const;

export type SpecStepKind = (typeof SPEC_STEP_KINDS)[number];

/** One Activates edge from a scenario toward another scenario title. */
export type ActivatesEdge = {
  fromScenarioId: string;
  fromScenarioName: string;
  text: string;
  line: number;
  toScenarioId?: string;
  toScenarioName?: string;
  toFeatureId?: string;
  resolved: boolean;
};

/** Scenario slice needed to resolve Activates targets. */
export type ActivatesScenario = {
  id: string;
  name: string;
  featureId?: string;
  steps: ReadonlyArray<Pick<GherkinStep, 'keyword' | 'text' | 'line'> & { kind?: SpecStepKind }>;
};

/** True when the step is an Activates primary or continuation. */
export function isActivatesStep(step: {
  keyword: string;
  kind?: SpecStepKind;
}): boolean {
  if (step.kind === 'activates') return true;
  return step.keyword.trim().toLowerCase() === 'activates';
}

/**
 * Resolves Activates steps against scenario titles (normalised name match).
 * Ambiguous titles leave the edge unresolved rather than picking arbitrarily.
 */
export function resolveActivatesEdges(
  scenarios: readonly ActivatesScenario[]
): ActivatesEdge[] {
  const byName = new Map<string, ActivatesScenario[]>();

  for (const scenario of scenarios) {
    const key = normalizeName(scenario.name);
    if (key.length === 0) continue;
    const existing = byName.get(key) ?? [];
    existing.push(scenario);
    byName.set(key, existing);
  }

  const edges: ActivatesEdge[] = [];

  for (const scenario of scenarios) {
    for (const step of scenario.steps) {
      if (!isActivatesStep(step)) continue;
      const text = step.text.trim();
      if (text.length === 0) continue;

      const matches = byName.get(normalizeName(text)) ?? [];
      const unique = matches.length === 1 ? matches[0] : undefined;

      edges.push({
        fromScenarioId: scenario.id,
        fromScenarioName: scenario.name,
        text,
        line: step.line,
        toScenarioId: unique?.id,
        toScenarioName: unique?.name,
        toFeatureId: unique?.featureId,
        resolved: unique !== undefined,
      });
    }
  }

  return edges;
}

/** Outgoing Activates edges for one scenario. */
export function activatesFrom(
  edges: readonly ActivatesEdge[],
  scenarioId: string
): ActivatesEdge[] {
  return edges.filter(function isFrom(edge) {
    return edge.fromScenarioId === scenarioId;
  });
}

/** Builds a Mermaid flowchart of resolved Activates edges. */
export function activatesMermaid(edges: readonly ActivatesEdge[]): string {
  const resolved = edges.filter(function isResolved(edge) {
    return edge.resolved && edge.toScenarioId !== undefined;
  });

  if (resolved.length === 0) {
    return 'flowchart LR\n  empty["No resolved Activates"]';
  }

  const nodeIds = new Map<string, string>();
  let next = 0;

  function nodeId(scenarioId: string): string {
    const existing = nodeIds.get(scenarioId);
    if (existing !== undefined) return existing;
    const id = `n${next}`;
    next += 1;
    nodeIds.set(scenarioId, id);
    return id;
  }

  function escapeLabel(text: string): string {
    return text.replace(/"/g, '#quot;');
  }

  const lines = ['flowchart LR'];

  for (const edge of resolved) {
    const from = nodeId(edge.fromScenarioId);
    const to = nodeId(edge.toScenarioId!);
    lines.push(`  ${from}["${escapeLabel(edge.fromScenarioName)}"]`);
    lines.push(`  ${to}["${escapeLabel(edge.toScenarioName ?? edge.text)}"]`);
    lines.push(`  ${from} --> ${to}`);
  }

  return [...new Set(lines)].join('\n');
}

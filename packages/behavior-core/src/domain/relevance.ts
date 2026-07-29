import type { DiagramLink, Relevance } from '@eddy/behavior-contracts';
import { clamp01, normalizeTag, overlapCoefficient, tokenSet } from './text.js';

/** The scenario-side inputs to relevance scoring. */
export type RelevanceScenario = {
  name: string;
  featureTitle: string;
  tags: readonly string[];
  stepTexts: readonly string[];
};

/** The diagram-side inputs to relevance scoring. */
export type RelevanceDiagram = {
  id: string;
  type: DiagramLink['type'];
  path: string;
  title: string;
  content: string;
};

/**
 * Weights for each signal. They sum to 1 so the combined score cannot exceed 1
 * before clamping, which is what keeps the score inside [0, 1] by construction
 * rather than by luck.
 */
const WEIGHTS = {
  title: 0.45,
  steps: 0.3,
  tags: 0.15,
  path: 0.1,
} as const;

const HIGH_THRESHOLD = 0.6;
const MEDIUM_THRESHOLD = 0.3;

/** Maps a numeric score onto the coarse band shown in the UI. */
export function relevanceBand(score: number): Relevance {
  if (score >= HIGH_THRESHOLD) return 'high';
  if (score >= MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Scores how strongly a diagram relates to a scenario, in the range 0 to 1.
 *
 * Combines four signals: overlap between the diagram title and the scenario and
 * feature names, overlap between diagram body text and step text, tags appearing
 * in the diagram, and the diagram filename resembling the feature.
 */
export function calculateDiagramRelevance(
  scenario: RelevanceScenario,
  diagram: RelevanceDiagram
): number {
  const scenarioTokens = tokenSet([scenario.name, scenario.featureTitle]);
  const stepTokens = tokenSet(scenario.stepTexts);
  const titleTokens = tokenSet([diagram.title]);
  const contentTokens = tokenSet([diagram.content]);
  const pathTokens = tokenSet([diagram.path]);

  const titleScore = overlapCoefficient(scenarioTokens, titleTokens);
  const stepScore = overlapCoefficient(stepTokens, contentTokens);
  const pathScore = overlapCoefficient(scenarioTokens, pathTokens);

  const normalizedTags = scenario.tags.map(normalizeTag).filter(function isNotEmpty(tag) {
    return tag.length > 0;
  });
  const haystack = `${diagram.title} ${diagram.content} ${diagram.path}`.toLowerCase();
  const matchedTags = normalizedTags.filter(function appearsInDiagram(tag) {
    return haystack.includes(tag);
  });
  const tagScore = normalizedTags.length === 0 ? 0 : matchedTags.length / normalizedTags.length;

  const combined =
    titleScore * WEIGHTS.title +
    stepScore * WEIGHTS.steps +
    tagScore * WEIGHTS.tags +
    pathScore * WEIGHTS.path;

  return clamp01(combined);
}

/**
 * Builds diagram links for one scenario, dropping diagrams that score below the
 * threshold and ordering the rest by descending relevance.
 */
export function linkDiagramsToScenario(
  scenario: RelevanceScenario,
  diagrams: readonly RelevanceDiagram[],
  minimumScore = 0.15
): DiagramLink[] {
  return diagrams
    .map(function toLink(diagram): DiagramLink {
      const relevanceScore = calculateDiagramRelevance(scenario, diagram);
      return {
        diagramId: diagram.id,
        type: diagram.type,
        path: diagram.path,
        title: diagram.title,
        relevance: relevanceBand(relevanceScore),
        relevanceScore,
      };
    })
    .filter(function isRelevantEnough(link) {
      return link.relevanceScore >= minimumScore;
    })
    .sort(function byDescendingScore(left, right) {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }
      return left.diagramId.localeCompare(right.diagramId);
    });
}

import type {
  ValidationResult,
  ValidationSuggestion,
  ValidationWarning,
} from '@eddy/behavior-contracts';
import { normalizeName, normalizeTag } from './text.js';

/** Conventions drawn from the existing project, to compare a candidate against. */
export type ProjectConventions = {
  /** Tags already in use, normalised without their leading `@`. */
  knownTags: readonly string[];
  /** Scenario names already in use, normalised. */
  existingScenarioNames: readonly string[];
  /** Step texts already in use, normalised. */
  knownStepTexts: readonly string[];
};

/** The candidate Gherkin, already parsed. */
export type ValidationCandidate = {
  featureTitle: string;
  scenarios: ReadonlyArray<{
    name: string;
    tags: readonly string[];
    steps: ReadonlyArray<{ keyword: string; text: string }>;
  }>;
};

const MAX_COMPATIBILITY = 100;

/**
 * Scores how well a candidate matches project conventions and reports what to
 * change.
 *
 * Compatibility starts at 100 and each finding deducts from it, so an agent gets
 * a single number to act on plus the specifics behind it. Unknown tags and
 * duplicate scenario names are the two findings that most often mean the agent
 * invented something rather than following the project.
 */
export function validateAgainstConventions(
  candidate: ValidationCandidate,
  conventions: ProjectConventions
): ValidationResult {
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  const knownTags = new Set(conventions.knownTags.map(normalizeTag));
  const existingNames = new Set(conventions.existingScenarioNames.map(normalizeName));
  const knownSteps = new Set(conventions.knownStepTexts.map(normalizeName));

  let deductions = 0;

  if (candidate.featureTitle.trim().length === 0) {
    warnings.push({ message: 'Feature has no title', severity: 'error' });
    deductions += 30;
  }

  if (candidate.scenarios.length === 0) {
    warnings.push({ message: 'No scenarios found', severity: 'error' });
    deductions += 40;
  }

  for (const scenario of candidate.scenarios) {
    if (scenario.name.trim().length === 0) {
      warnings.push({ message: 'Scenario has no name', severity: 'error' });
      deductions += 20;
    }

    if (existingNames.has(normalizeName(scenario.name))) {
      warnings.push({
        message: `Scenario "${scenario.name}" already exists in this project`,
        severity: 'warning',
      });
      suggestions.push({
        message: 'Rename the scenario or extend the existing one instead',
        type: 'refactor',
        from: scenario.name,
      });
      deductions += 15;
    }

    if (scenario.steps.length === 0) {
      warnings.push({
        message: `Scenario "${scenario.name}" has no steps`,
        severity: 'error',
      });
      deductions += 20;
    }

    for (const tag of scenario.tags) {
      if (knownTags.size > 0 && !knownTags.has(normalizeTag(tag))) {
        warnings.push({
          message: `Tag ${tag} is not used anywhere else in this project`,
          severity: 'info',
        });
        suggestions.push({
          message: `Consider an existing tag instead of ${tag}`,
          type: 'improve',
          from: tag,
        });
        deductions += 5;
      }
    }

    const unfamiliarSteps = scenario.steps.filter(function isNovel(step) {
      return knownSteps.size > 0 && !knownSteps.has(normalizeName(step.text));
    });

    if (unfamiliarSteps.length === scenario.steps.length && scenario.steps.length > 0) {
      suggestions.push({
        message: `No step in "${scenario.name}" matches an existing step pattern`,
        type: 'improve',
      });
      deductions += 10;
    }
  }

  const compatibility = Math.max(0, MAX_COMPATIBILITY - deductions);

  return {
    valid: !warnings.some(function isError(warning) {
      return warning.severity === 'error';
    }),
    warnings,
    suggestions,
    compatibility,
  };
}

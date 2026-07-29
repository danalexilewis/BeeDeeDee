import type { LintResult } from '@eddy/behavior-contracts';
import { normalizeName } from './text.js';

/** The lint-relevant slice of a scenario. */
export type LintableScenario = {
  name: string;
  line: number;
  tags: readonly string[];
  steps: ReadonlyArray<{ keyword: string; text: string; line: number }>;
};

/** The lint-relevant slice of a feature. */
export type LintableFeature = {
  path: string;
  title: string;
  description: string;
  tags: readonly string[];
  line: number;
  scenarios: readonly LintableScenario[];
};

/** Beyond this a scenario is doing too much to read comfortably. */
const MAX_STEPS = 10;

/** Keywords that continue a previous step rather than opening a new phase. */
const CONTINUATION_KEYWORDS = new Set(['and', 'but', '*']);

/** Trims and lowercases a Gherkin keyword for comparison. */
function keywordOf(step: { keyword: string }): string {
  return step.keyword.trim().toLowerCase();
}

/** A feature with no description gives a reader no context for its scenarios. */
function missingFeatureDescription(feature: LintableFeature): LintResult[] {
  if (feature.description.trim().length > 0) return [];

  return [
    {
      path: feature.path,
      rule: 'missing-feature-description',
      severity: 'info',
      message: `Feature "${feature.title}" has no description`,
      line: feature.line,
    },
  ];
}

/** Tags are how tests and diagrams find their scenarios, so an untagged feature is a gap. */
function untaggedFeature(feature: LintableFeature): LintResult[] {
  if (feature.tags.length > 0) return [];

  return [
    {
      path: feature.path,
      rule: 'untagged-feature',
      severity: 'info',
      message: `Feature "${feature.title}" has no tags`,
      line: feature.line,
    },
  ];
}

/** A scenario without a name cannot be addressed by id or matched to a test. */
function missingScenarioName(feature: LintableFeature): LintResult[] {
  return feature.scenarios
    .filter(function hasNoName(scenario) {
      return scenario.name.trim().length === 0;
    })
    .map(function toResult(scenario): LintResult {
      return {
        path: feature.path,
        rule: 'missing-scenario-name',
        severity: 'error',
        message: 'Scenario has no name',
        line: scenario.line,
      };
    });
}

/** Duplicate names make ids ambiguous to a reader even though the index disambiguates. */
function duplicateScenarioName(feature: LintableFeature): LintResult[] {
  const seen = new Map<string, number>();
  const results: LintResult[] = [];

  for (const scenario of feature.scenarios) {
    const key = normalizeName(scenario.name);
    if (key.length === 0) continue;

    const firstLine = seen.get(key);
    if (firstLine === undefined) {
      seen.set(key, scenario.line);
      continue;
    }

    results.push({
      path: feature.path,
      rule: 'duplicate-scenario-name',
      severity: 'warning',
      message: `Scenario "${scenario.name}" duplicates the one on line ${firstLine}`,
      line: scenario.line,
    });
  }

  return results;
}

/** A scenario with no steps asserts nothing. */
function emptyScenario(feature: LintableFeature): LintResult[] {
  return feature.scenarios
    .filter(function hasNoSteps(scenario) {
      return scenario.steps.length === 0;
    })
    .map(function toResult(scenario): LintResult {
      return {
        path: feature.path,
        rule: 'empty-scenario',
        severity: 'error',
        message: `Scenario "${scenario.name}" has no steps`,
        line: scenario.line,
      };
    });
}

/** An And or But with no preceding Given, When, or Then has nothing to continue. */
function inconsistentStepKeyword(feature: LintableFeature): LintResult[] {
  const results: LintResult[] = [];

  for (const scenario of feature.scenarios) {
    const first = scenario.steps[0];
    if (first === undefined) continue;

    if (CONTINUATION_KEYWORDS.has(keywordOf(first))) {
      results.push({
        path: feature.path,
        rule: 'inconsistent-step-keyword',
        severity: 'warning',
        message: `Scenario "${scenario.name}" opens with "${first.keyword.trim()}", which continues a step that does not exist`,
        line: first.line,
        suggestedFix: { from: first.keyword.trim(), to: 'Given' },
      });
    }
  }

  return results;
}

/** A scenario with no Given has no stated starting state. */
function stepWithoutGiven(feature: LintableFeature): LintResult[] {
  return feature.scenarios
    .filter(function lacksGiven(scenario) {
      if (scenario.steps.length === 0) return false;
      return !scenario.steps.some(function isGiven(step) {
        return keywordOf(step) === 'given';
      });
    })
    .map(function toResult(scenario): LintResult {
      return {
        path: feature.path,
        rule: 'step-without-given',
        severity: 'info',
        message: `Scenario "${scenario.name}" has no Given step to establish context`,
        line: scenario.line,
      };
    });
}

/** Long scenarios are usually several behaviours wearing one name. */
function tooManySteps(feature: LintableFeature): LintResult[] {
  return feature.scenarios
    .filter(function isLong(scenario) {
      return scenario.steps.length > MAX_STEPS;
    })
    .map(function toResult(scenario): LintResult {
      return {
        path: feature.path,
        rule: 'too-many-steps',
        severity: 'warning',
        message: `Scenario "${scenario.name}" has ${scenario.steps.length} steps, more than the ${MAX_STEPS} that read comfortably`,
        line: scenario.line,
      };
    });
}

const RULES = [
  missingFeatureDescription,
  untaggedFeature,
  missingScenarioName,
  duplicateScenarioName,
  emptyScenario,
  inconsistentStepKeyword,
  stepWithoutGiven,
  tooManySteps,
] as const;

/**
 * Runs every lint rule over one feature, ordered by line so output reads
 * top-to-bottom in the file.
 */
export function lintFeature(feature: LintableFeature): LintResult[] {
  return RULES.flatMap(function apply(rule) {
    return rule(feature);
  }).sort(function byLineThenRule(left, right) {
    if ((left.line ?? 0) !== (right.line ?? 0)) return (left.line ?? 0) - (right.line ?? 0);
    return left.rule.localeCompare(right.rule);
  });
}

/** Runs every lint rule over many features. */
export function lintFeatures(features: readonly LintableFeature[]): LintResult[] {
  return features.flatMap(lintFeature);
}

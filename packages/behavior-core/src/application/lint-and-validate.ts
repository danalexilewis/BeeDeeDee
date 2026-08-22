import type { LintResult, ValidationResult } from '@eddy/behavior-contracts';
import { ResultAsync, type Result } from 'neverthrow';
import { lintFeatures, type LintableFeature } from '../domain/lint.js';
import { normalizeName } from '../domain/text.js';
import { validateAgainstConventions, type ProjectConventions } from '../domain/validation.js';
import type { BehaviorError } from '../errors.js';
import { parseGherkinContent } from '../parsers/gherkin.js';
import type { FileSystemPort } from '../ports/file-system.js';
import type { IndexStorePort } from '../ports/index-store.js';
import type { BehaviorIndex } from './behavior-index.js';

export type LintDeps = {
  indexStore: IndexStorePort;
  fileSystem: FileSystemPort;
};

/** Lint-shaped view of every indexed feature. */
function toLintableFeatures(index: BehaviorIndex, paths?: readonly string[]): LintableFeature[] {
  const wanted = paths === undefined ? undefined : new Set(paths);

  return [...index.features.values()]
    .filter(function isWanted(feature) {
      return wanted === undefined || wanted.has(feature.path);
    })
    .sort(function byPath(left, right) {
      return left.path.localeCompare(right.path);
    })
    .map(function toLintable(feature): LintableFeature {
      return {
        path: feature.path,
        title: feature.title,
        description: feature.description,
        tags: feature.tags,
        line: feature.line,
        scenarios: feature.scenarioIds.flatMap(function toScenario(scenarioId) {
          const scenario = index.scenarios.get(scenarioId);
          return scenario === undefined
            ? []
            : [
                {
                  name: scenario.name,
                  line: scenario.line,
                  tags: scenario.tags,
                  steps: scenario.steps,
                },
              ];
        }),
      };
    });
}

/** Lints the indexed specs, optionally narrowed to given paths. */
export function lintSpecs(
  deps: LintDeps,
  paths?: readonly string[]
): Result<LintResult[], BehaviorError> {
  return deps.indexStore.read().map(function lint(index) {
    return lintFeatures(toLintableFeatures(index, paths));
  });
}

/** Conventions drawn from the current index, for validating new Gherkin. */
export function conventionsFrom(index: BehaviorIndex): ProjectConventions {
  const knownTags = new Set<string>();
  const existingScenarioNames: string[] = [];
  const knownStepTexts = new Set<string>();

  for (const feature of index.features.values()) {
    for (const tag of feature.tags) knownTags.add(tag);
  }

  for (const scenario of index.scenarios.values()) {
    existingScenarioNames.push(scenario.name);
    for (const tag of scenario.tags) knownTags.add(tag);
    for (const step of scenario.steps) knownStepTexts.add(normalizeName(step.text));
  }

  return {
    knownTags: [...knownTags],
    existingScenarioNames,
    knownStepTexts: [...knownStepTexts],
  };
}

export type ValidateDeps = {
  indexStore: IndexStorePort;
};

/**
 * Validates candidate Gherkin against the project's conventions.
 *
 * A syntax error is reported as an invalid result rather than a failed call: the
 * caller asked "is this good Gherkin", and "no, it does not parse" answers that
 * question rather than being an error in answering it.
 */
export function validateGherkin(
  deps: ValidateDeps,
  gherkin: string
): Result<ValidationResult, BehaviorError> {
  return deps.indexStore.read().map(function validate(index) {
    const parsed = parseGherkinContent({
      path: 'candidate.feature',
      content: gherkin,
      featuresRoot: '',
    });

    if (parsed.isErr()) {
      const error = parsed.error;
      const location =
        error.tag === 'GherkinSyntax' ? { line: error.line, column: error.column } : undefined;

      return {
        valid: false,
        warnings: [
          {
            message:
              error.tag === 'GherkinSyntax'
                ? error.detail
                : 'Candidate Gherkin could not be parsed',
            severity: 'error' as const,
            ...(location === undefined ? {} : { location }),
          },
        ],
        suggestions: [],
        compatibility: 0,
      };
    }

    return validateAgainstConventions(
      {
        featureTitle: parsed.value.title,
        scenarios: parsed.value.scenarios.map(function toCandidate(scenario) {
          return { name: scenario.name, tags: scenario.tags, steps: scenario.steps };
        }),
      },
      conventionsFrom(index)
    );
  });
}

/** Reads and lints files not yet in the index, e.g. an explicit CLI target. */
export function lintPaths(
  deps: LintDeps,
  featuresRoot: string,
  paths: readonly string[]
): ResultAsync<LintResult[], BehaviorError> {
  return ResultAsync.combine(
    paths.map(function readOne(path) {
      return deps.fileSystem.readFile(path).map(function withPath(content) {
        return { path, content };
      });
    })
  ).map(function lint(files) {
    const features: LintableFeature[] = [];

    for (const file of files) {
      const parsed = parseGherkinContent({
        path: file.path,
        content: file.content,
        featuresRoot,
      });
      if (parsed.isErr()) continue;

      features.push({
        path: parsed.value.path,
        title: parsed.value.title,
        description: parsed.value.description,
        tags: parsed.value.tags,
        line: parsed.value.line,
        scenarios: parsed.value.scenarios.map(function toScenario(scenario) {
          return {
            name: scenario.name,
            line: scenario.line,
            tags: scenario.tags,
            steps: scenario.steps,
          };
        }),
      });
    }

    return lintFeatures(features);
  });
}

import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin';
import type * as messages from '@cucumber/messages';
import { IdGenerator } from '@cucumber/messages';
import type {
  GherkinArgument,
  GherkinBackground,
  GherkinRule,
  GherkinStep,
  GherkinTable,
} from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { assignScenarioIds, featureIdFromPath, stepIdFrom } from '../domain/ids.js';
import { gherkinSyntax, type BehaviorError } from '../errors.js';

/** A scenario extracted from a feature file, before test and diagram linking. */
export type ParsedScenario = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  steps: GherkinStep[];
  line: number;
  /** Set when the scenario sits inside a Rule block. */
  ruleName?: string;
  /** True for `Scenario Outline`, which is indexed as one scenario. */
  isOutline: boolean;
  exampleCount: number;
};

/** A fully parsed feature file. */
export type ParsedFeatureDocument = {
  featureId: string;
  title: string;
  description: string;
  path: string;
  tags: string[];
  line: number;
  background?: GherkinBackground;
  rules: GherkinRule[];
  scenarios: ParsedScenario[];
  source: string;
};

export type ParseGherkinInput = {
  path: string;
  content: string;
  /** Root the feature id is made relative to. */
  featuresRoot: string;
};

/** Reads the plain tag names from an AST tag list. */
function tagNames(tags: readonly messages.Tag[]): string[] {
  return tags.map(function toName(tag) {
    return tag.name;
  });
}

/** Converts a Gherkin data table into the contract shape. */
function toTable(dataTable: messages.DataTable): GherkinTable {
  const [headerRow, ...bodyRows] = dataTable.rows;

  return {
    headers: (headerRow?.cells ?? []).map(function toValue(cell) {
      return cell.value;
    }),
    rows: bodyRows.map(function toRow(row) {
      return row.cells.map(function toValue(cell) {
        return cell.value;
      });
    }),
    line: dataTable.location.line,
  };
}

/** Converts a step's doc string or data table into the contract shape. */
function toArgument(step: messages.Step): GherkinArgument | undefined {
  if (step.docString !== undefined) {
    return {
      type: 'doc_string',
      content: step.docString.content,
      line: step.docString.location.line,
    };
  }

  if (step.dataTable !== undefined) {
    return {
      type: 'table',
      content: toTable(step.dataTable),
      line: step.dataTable.location.line,
    };
  }

  return undefined;
}

/** Converts AST steps into contract steps with ids scoped to their scenario. */
function toSteps(scenarioId: string, steps: readonly messages.Step[]): GherkinStep[] {
  return steps.map(function toStep(step, index): GherkinStep {
    const argument = toArgument(step);
    const base: GherkinStep = {
      id: stepIdFrom(scenarioId, index),
      keyword: step.keyword,
      text: step.text,
      line: step.location.line,
    };
    return argument === undefined ? base : { ...base, argument };
  });
}

/** A scenario paired with the rule that contains it, if any. */
type ScenarioWithRule = {
  scenario: messages.Scenario;
  ruleName?: string;
};

/** Flattens feature children into scenarios, background, and rules. */
function collectChildren(feature: messages.Feature): {
  scenarios: ScenarioWithRule[];
  background?: messages.Background;
  rules: Array<{ rule: messages.Rule; scenarioNames: string[] }>;
} {
  const scenarios: ScenarioWithRule[] = [];
  const rules: Array<{ rule: messages.Rule; scenarioNames: string[] }> = [];
  let background: messages.Background | undefined;

  for (const child of feature.children) {
    if (child.background !== undefined && background === undefined) {
      background = child.background;
    }

    if (child.scenario !== undefined) {
      scenarios.push({ scenario: child.scenario });
    }

    if (child.rule !== undefined) {
      const ruleScenarioNames: string[] = [];
      for (const ruleChild of child.rule.children) {
        if (ruleChild.scenario !== undefined) {
          scenarios.push({ scenario: ruleChild.scenario, ruleName: child.rule.name });
          ruleScenarioNames.push(ruleChild.scenario.name);
        }
        if (ruleChild.background !== undefined && background === undefined) {
          background = ruleChild.background;
        }
      }
      rules.push({ rule: child.rule, scenarioNames: ruleScenarioNames });
    }
  }

  return background === undefined ? { scenarios, rules } : { scenarios, background, rules };
}

/** Reads the first syntax error out of a thrown Gherkin exception. */
function toSyntaxError(path: string, thrown: unknown): BehaviorError {
  const candidates: unknown[] =
    thrown !== null && typeof thrown === 'object' && 'errors' in thrown
      ? ((thrown as { errors?: unknown[] }).errors ?? [thrown])
      : [thrown];

  const first = candidates[0] ?? thrown;
  const location =
    first !== null && typeof first === 'object' && 'location' in first
      ? (first as { location?: { line?: number; column?: number } }).location
      : undefined;

  const detail = first instanceof Error ? first.message : String(first);

  return gherkinSyntax(path, location?.line ?? 1, location?.column ?? 1, detail);
}

/**
 * Parses a `.feature` file into a document ready for indexing.
 *
 * Scenario Outlines are indexed as a single scenario rather than expanded per
 * example row, so the catalog scenario count matches what a reader sees in the
 * file. The example count is retained for display.
 */
export function parseGherkinContent(
  input: ParseGherkinInput
): Result<ParsedFeatureDocument, BehaviorError> {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher()
  );

  let document: messages.GherkinDocument;
  try {
    document = parser.parse(input.content);
  } catch (thrown) {
    return err(toSyntaxError(input.path, thrown));
  }

  const feature = document.feature;
  if (feature === undefined) {
    return err(gherkinSyntax(input.path, 1, 1, 'file contains no Feature'));
  }

  const featureId = featureIdFromPath(input.featuresRoot, input.path);
  const { scenarios: astScenarios, background, rules: astRules } = collectChildren(feature);

  const scenarioIds = assignScenarioIds(
    featureId,
    astScenarios.map(function toName(entry) {
      return entry.scenario.name;
    })
  );

  const scenarios: ParsedScenario[] = astScenarios.map(function toScenario(entry, index) {
    const id = scenarioIds[index] ?? `${featureId}/scenario-${index + 1}`;
    const base: ParsedScenario = {
      id,
      name: entry.scenario.name,
      description: entry.scenario.description.trim(),
      tags: tagNames(entry.scenario.tags),
      steps: toSteps(id, entry.scenario.steps),
      line: entry.scenario.location.line,
      isOutline: entry.scenario.examples.length > 0,
      exampleCount: entry.scenario.examples.reduce(function countRows(total, examples) {
        return total + examples.tableBody.length;
      }, 0),
    };
    return entry.ruleName === undefined ? base : { ...base, ruleName: entry.ruleName };
  });

  const scenarioIdByName = new Map<string, string[]>();
  scenarios.forEach(function record(scenario) {
    const existing = scenarioIdByName.get(scenario.name) ?? [];
    existing.push(scenario.id);
    scenarioIdByName.set(scenario.name, existing);
  });

  const rules: GherkinRule[] = astRules.map(function toRule(entry) {
    return {
      keyword: entry.rule.keyword,
      name: entry.rule.name,
      description: entry.rule.description.trim(),
      scenarioIds: entry.scenarioNames.flatMap(function toIds(name) {
        return scenarioIdByName.get(name) ?? [];
      }),
      line: entry.rule.location.line,
    };
  });

  const document_: ParsedFeatureDocument = {
    featureId,
    title: feature.name,
    description: feature.description.trim(),
    path: input.path,
    tags: tagNames(feature.tags),
    line: feature.location.line,
    rules,
    scenarios,
    source: input.content,
  };

  if (background === undefined) return ok(document_);

  const backgroundValue: GherkinBackground = {
    keyword: background.keyword,
    name: background.name,
    description: background.description.trim(),
    steps: toSteps(`${featureId}/background`, background.steps),
    line: background.location.line,
  };

  return ok({ ...document_, background: backgroundValue });
}

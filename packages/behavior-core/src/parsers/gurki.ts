import {
  parseGurki,
  surfaceForConnector,
  surfaceForKind,
  valueReport,
  type GurkiDocument,
  type GurkiScenario,
  type GurkiStep,
  type ValueReport,
} from 'gurki';
import type { GherkinStep } from '@eddy/behavior-contracts';
import { err, ok, type Result } from 'neverthrow';
import { assignScenarioIds, featureIdFromPath, slugify, stepIdFrom } from '../domain/ids.js';
import { gherkinSyntax, type BehaviorError } from '../errors.js';
import type { ParsedFeatureDocument, ParsedScenario } from './gherkin.js';

export type ParseGurkiInput = {
  path: string;
  content: string;
  /** Root the feature id is made relative to. */
  featuresRoot: string;
};

/** A derived System Outputs / Outcomes line for the wire and UI. */
export type SystemValueItem = {
  text: string;
  connector?: 'and' | 'but';
};

/** Extends the classic parse document with Gurki-only rollups. */
export type ParsedGurkiFeatureDocument = ParsedFeatureDocument & {
  dialect: 'gurki';
  systemOutputs: SystemValueItem[];
  systemOutcomes: SystemValueItem[];
};

type GurkiValueItem = ValueReport['outputs'][number];

/** Maps a Gurki value-report item onto the BeeDeeDee wire shape. */
function toValueItem(item: GurkiValueItem): SystemValueItem {
  return item.connector === undefined
    ? { text: item.text }
    : { text: item.text, connector: item.connector };
}

/** Renders a Gurki step as a Gherkin-shaped keyword + text pair. */
function toGherkinStep(scenarioId: string, step: GurkiStep, index: number): GherkinStep {
  const kindSurface = surfaceForKind(step.kind);
  const keyword =
    step.connector === null ? `${kindSurface} ` : `${surfaceForConnector(step.connector)} `;

  return {
    id: stepIdFrom(scenarioId, index),
    keyword,
    text: step.text,
    line: step.line,
    kind: step.kind,
  };
}

/** Builds one indexed feature from a Gurki system (or the whole ungrouped file). */
function toFeatureDocument(args: {
  path: string;
  content: string;
  featuresRoot: string;
  document: GurkiDocument;
  featureId: string;
  title: string;
  description: string;
  line: number;
  tags: string[];
  scenarios: readonly GurkiScenario[];
}): ParsedGurkiFeatureDocument {
  const scenarioIds = assignScenarioIds(
    args.featureId,
    args.scenarios.map(function toName(scenario) {
      return scenario.title;
    })
  );

  const scenarios: ParsedScenario[] = args.scenarios.map(function toScenario(scenario, index) {
    const id = scenarioIds[index] ?? `${args.featureId}/scenario-${index + 1}`;
    return {
      id,
      name: scenario.title,
      description: '',
      tags: [],
      steps: scenario.steps.map(function toStep(step, stepIndex) {
        return toGherkinStep(id, step, stepIndex);
      }),
      line: scenario.line,
      isOutline: false,
      exampleCount: 0,
    };
  });

  const report = valueReport([...args.scenarios]);

  return {
    featureId: args.featureId,
    title: args.title,
    description: args.description,
    path: args.path,
    tags: args.tags,
    line: args.line,
    rules: [],
    scenarios,
    source: args.content,
    dialect: 'gurki',
    systemOutputs: report.outputs.map(toValueItem),
    systemOutcomes: report.outcomes.map(toValueItem),
  };
}

/**
 * Parses a Gurki `*.spec.md` (or body) into one or more feature-shaped documents.
 *
 * Each `System:` becomes its own catalog feature. Scenarios with no System land
 * under the file's frontmatter title (or the path-derived id). Parse errors use
 * the existing `GherkinSyntax` tag so the HTTP/UI mapping stays unchanged in
 * this vertical slice; a dedicated `GurkiSyntax` tag can follow.
 */
export function parseGurkiContent(
  input: ParseGurkiInput
): Result<ParsedGurkiFeatureDocument[], BehaviorError> {
  const parsed = parseGurki(input.content, {
    path: input.path,
    envelope: 'auto',
  });

  if (parsed.lint.errors.length > 0) {
    const first = parsed.lint.errors[0];
    return err(
      gherkinSyntax(
        input.path,
        first?.line ?? 1,
        1,
        first === undefined ? 'gurki parse failed' : `gurki ${first.code}: ${first.message}`
      )
    );
  }

  const baseId = featureIdFromPath(input.featuresRoot, input.path);
  const tags = parsed.document.frontmatter?.tags ?? [];
  const summary = parsed.document.frontmatter?.summary?.trim() ?? '';
  const frontmatterTitle = parsed.document.frontmatter?.title?.trim();

  if (parsed.document.systems.length === 0) {
    return ok([
      toFeatureDocument({
        path: input.path,
        content: input.content,
        featuresRoot: input.featuresRoot,
        document: parsed.document,
        featureId: baseId,
        title: frontmatterTitle && frontmatterTitle.length > 0 ? frontmatterTitle : baseId,
        description: summary,
        line: parsed.document.scenarios[0]?.line ?? 1,
        tags,
        scenarios: parsed.document.scenarios,
      }),
    ]);
  }

  const documents = parsed.document.systems.map(function toSystem(system, systemIndex) {
    const systemScenarios = system.scenarioIndexes.flatMap(function pick(index) {
      const scenario = parsed.document.scenarios[index];
      return scenario === undefined ? [] : [scenario];
    });

    const systemSlug = slugify(system.title);
    const featureId =
      parsed.document.systems.length === 1
        ? baseId
        : `${baseId}.${systemSlug.length > 0 ? systemSlug : `system-${systemIndex + 1}`}`;

    return toFeatureDocument({
      path: input.path,
      content: input.content,
      featuresRoot: input.featuresRoot,
      document: parsed.document,
      featureId,
      title: system.title,
      description: summary,
      line: system.line,
      tags,
      scenarios: systemScenarios,
    });
  });

  return ok(documents);
}

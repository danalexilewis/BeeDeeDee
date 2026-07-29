import fc from 'fast-check';
import { arbPath, arbPhrase, arbTag, arbWord } from './primitives.js';

/** A scenario as it appears in generated Gherkin. */
export type ArbitraryScenario = {
  name: string;
  tags: string[];
  steps: string[];
};

/** A feature as it appears in generated Gherkin. */
export type ArbitraryFeature = {
  title: string;
  description: string;
  tags: string[];
  path: string;
  scenarios: ArbitraryScenario[];
};

const arbStepText: fc.Arbitrary<string> = arbPhrase;

export const arbScenario: fc.Arbitrary<ArbitraryScenario> = fc.record({
  name: arbPhrase,
  tags: fc.array(arbTag, { maxLength: 3 }),
  steps: fc.array(arbStepText, { minLength: 1, maxLength: 5 }),
});

export const arbFeature: fc.Arbitrary<ArbitraryFeature> = fc.record({
  title: arbPhrase,
  description: fc.oneof(fc.constant(''), arbPhrase),
  tags: fc.array(arbTag, { maxLength: 3 }),
  path: arbPath('.feature'),
  scenarios: fc.array(arbScenario, { minLength: 1, maxLength: 5 }),
});

/** Renders a generated feature as valid Gherkin source. */
export function renderGherkin(feature: ArbitraryFeature): string {
  const lines: string[] = [];

  if (feature.tags.length > 0) lines.push(feature.tags.join(' '));
  lines.push(`Feature: ${feature.title}`);
  if (feature.description.length > 0) lines.push(`  ${feature.description}`);

  for (const scenario of feature.scenarios) {
    lines.push('');
    if (scenario.tags.length > 0) lines.push(`  ${scenario.tags.join(' ')}`);
    lines.push(`  Scenario: ${scenario.name}`);
    scenario.steps.forEach(function toStep(step, index) {
      const keyword = index === 0 ? 'Given' : index === 1 ? 'When' : 'Then';
      lines.push(`    ${keyword} ${step}`);
    });
  }

  return `${lines.join('\n')}\n`;
}

/** Renders a simple valid Mermaid flowchart. */
export function renderMermaid(title: string, nodes: readonly string[]): string {
  const edges = nodes.slice(0, -1).map(function toEdge(node, index) {
    return `  ${node} --> ${nodes[index + 1]}`;
  });
  return [`---`, `title: ${title}`, `---`, `flowchart TD`, ...edges].join('\n');
}

export const arbMermaid: fc.Arbitrary<{ title: string; source: string }> = fc
  .tuple(arbPhrase, fc.array(arbWord, { minLength: 2, maxLength: 6 }))
  .map(function toMermaid([title, nodes]) {
    return { title, source: renderMermaid(title, nodes) };
  });

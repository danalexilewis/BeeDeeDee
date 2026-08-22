import { describe, expect, it } from 'vitest';
import {
  calculateDiagramRelevance,
  linkDiagramsToScenario,
  relevanceBand,
  type RelevanceDiagram,
  type RelevanceScenario,
} from './relevance.js';

function scenario(overrides: Partial<RelevanceScenario> = {}): RelevanceScenario {
  return {
    name: 'Successful login',
    featureTitle: 'User authentication',
    tags: ['@smoke'],
    stepTexts: ['a registered user', 'they submit valid credentials', 'they reach the dashboard'],
    ...overrides,
  };
}

function diagram(overrides: Partial<RelevanceDiagram> = {}): RelevanceDiagram {
  return {
    id: 'auth-flow',
    type: 'mermaid',
    path: 'specs/diagrams/auth-flow.mmd',
    title: 'Authentication flow',
    content: 'graph TD; user-->login; login-->dashboard;',
    ...overrides,
  };
}

describe('relevanceBand', () => {
  it.each([
    [1, 'high'],
    [0.6, 'high'],
    [0.59, 'medium'],
    [0.3, 'medium'],
    [0.29, 'low'],
    [0, 'low'],
  ])('maps %o to %o', (score, expected) => {
    expect(relevanceBand(score)).toBe(expected);
  });
});

describe('calculateDiagramRelevance', () => {
  it('scores a closely related diagram above a loosely related one', () => {
    const related = calculateDiagramRelevance(scenario(), diagram());
    const unrelated = calculateDiagramRelevance(
      scenario(),
      diagram({
        id: 'billing',
        title: 'Invoice generation',
        path: 'specs/diagrams/billing.mmd',
        content: 'graph TD; invoice-->pdf;',
      })
    );
    expect(related).toBeGreaterThan(unrelated);
  });

  it('returns 0 for a diagram with no overlapping text', () => {
    const score = calculateDiagramRelevance(
      scenario({ tags: [], stepTexts: [] }),
      diagram({ title: 'zzz', path: 'zzz', content: 'zzz' })
    );
    expect(score).toBe(0);
  });

  it('stays within 0 and 1 even when every signal fires', () => {
    const score = calculateDiagramRelevance(
      scenario({ name: 'login', featureTitle: 'login', tags: ['@login'], stepTexts: ['login'] }),
      diagram({ title: 'login', path: 'login', content: 'login smoke' })
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('handles a scenario with no tags without dividing by zero', () => {
    const score = calculateDiagramRelevance(scenario({ tags: [] }), diagram());
    expect(Number.isNaN(score)).toBe(false);
  });

  it('credits a tag that appears in the diagram text', () => {
    const withTag = calculateDiagramRelevance(
      scenario({ tags: ['@checkout'] }),
      diagram({ content: 'graph TD; checkout-->done;' })
    );
    const withoutTag = calculateDiagramRelevance(
      scenario({ tags: ['@checkout'] }),
      diagram({ content: 'graph TD; unrelated-->done;' })
    );
    expect(withTag).toBeGreaterThan(withoutTag);
  });

  it('is deterministic across repeated calls', () => {
    const first = calculateDiagramRelevance(scenario(), diagram());
    const second = calculateDiagramRelevance(scenario(), diagram());
    expect(first).toBe(second);
  });
});

describe('linkDiagramsToScenario', () => {
  it('orders links by descending relevance', () => {
    const links = linkDiagramsToScenario(
      scenario(),
      [
        diagram({ id: 'billing', title: 'Invoice generation', content: 'invoice' }),
        diagram({ id: 'auth-flow' }),
      ],
      0
    );
    expect(links[0]!.diagramId).toBe('auth-flow');
  });

  it('drops diagrams below the minimum score', () => {
    const links = linkDiagramsToScenario(scenario(), [
      diagram({ id: 'unrelated', title: 'zzz', path: 'zzz', content: 'zzz' }),
    ]);
    expect(links).toEqual([]);
  });

  it('breaks score ties by diagram id so ordering is stable', () => {
    const identical = { title: 'zzz', path: 'zzz', content: 'zzz' };
    const links = linkDiagramsToScenario(
      scenario({ tags: [], stepTexts: [] }),
      [
        { ...diagram(), id: 'b', ...identical },
        { ...diagram(), id: 'a', ...identical },
      ],
      0
    );
    expect(links.map(l => l.diagramId)).toEqual(['a', 'b']);
  });

  it('returns an empty array when there are no diagrams', () => {
    expect(linkDiagramsToScenario(scenario(), [])).toEqual([]);
  });

  it('assigns a band consistent with the score', () => {
    const links = linkDiagramsToScenario(scenario(), [diagram()], 0);
    for (const link of links) {
      expect(link.relevance).toBe(relevanceBand(link.relevanceScore));
    }
  });
});

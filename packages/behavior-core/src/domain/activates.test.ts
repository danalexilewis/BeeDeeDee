import { describe, expect, it } from 'vitest';
import {
  activatesFrom,
  activatesMermaid,
  isActivatesStep,
  resolveActivatesEdges,
} from './activates.js';

describe('isActivatesStep', () => {
  it('matches kind or keyword', () => {
    expect(isActivatesStep({ keyword: 'Activates ', kind: 'activates' })).toBe(true);
    expect(isActivatesStep({ keyword: 'Activates ' })).toBe(true);
    expect(isActivatesStep({ keyword: 'And ', kind: 'activates' })).toBe(true);
    expect(isActivatesStep({ keyword: 'Given ' })).toBe(false);
  });
});

describe('resolveActivatesEdges', () => {
  const scenarios = [
    {
      id: 'a.accept',
      name: 'A young volunteer is accepted onto the event team',
      steps: [
        {
          keyword: 'Activates ',
          text: 'The volunteer completes event-medic training',
          line: 10,
          kind: 'activates' as const,
        },
      ],
    },
    {
      id: 'a.train',
      name: 'The volunteer completes event-medic training',
      steps: [
        {
          keyword: 'Activates ',
          text: 'Missing scenario title',
          line: 20,
          kind: 'activates' as const,
        },
      ],
    },
  ];

  it('resolves matching titles and leaves unknowns unresolved', () => {
    const edges = resolveActivatesEdges(scenarios);
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      fromScenarioId: 'a.accept',
      toScenarioId: 'a.train',
      resolved: true,
    });
    expect(edges[1]).toMatchObject({
      fromScenarioId: 'a.train',
      resolved: false,
      toScenarioId: undefined,
    });
  });

  it('filters outgoing edges', () => {
    const edges = resolveActivatesEdges(scenarios);
    expect(activatesFrom(edges, 'a.accept')).toHaveLength(1);
    expect(activatesFrom(edges, 'missing')).toHaveLength(0);
  });

  it('renders mermaid for resolved edges only', () => {
    const chart = activatesMermaid(resolveActivatesEdges(scenarios));
    expect(chart).toContain('flowchart LR');
    expect(chart).toContain('A young volunteer is accepted onto the event team');
    expect(chart).not.toContain('Missing scenario title');
  });
});

import { describe, expect, it } from 'vitest';
import { parseGurkiContent } from './gurki.js';

const SAMPLE = `---
type: spec
id: event-medics
title: Event medics
status: draft
summary: Volunteers produce cover hours and often leave financially stressed.
tags:
  - health
  - volunteer
---

System: Event medics

Scenario: An event medic covers a stadium fixture
Given a signed-off volunteer on the roster
When the event runs
Then patients are assessed in the first-aid room
Output 14 hours of event cover
And 9 patients assessed
Outcome the event can run with on-site first response
But they missed a paid weekend shift
Activates The volunteer sits a paramedicine application
`;

describe('parseGurkiContent', () => {
  it('maps a System into a feature-shaped document with value report', () => {
    const result = parseGurkiContent({
      path: 'specs/features/event-medics.spec.md',
      content: SAMPLE,
      featuresRoot: 'specs/features',
    });

    expect(result.isOk()).toBe(true);
    const [document] = result._unsafeUnwrap();
    expect(document?.featureId).toBe('event-medics');
    expect(document?.title).toBe('Event medics');
    expect(document?.dialect).toBe('gurki');
    expect(document?.tags).toEqual(['health', 'volunteer']);
    expect(document?.scenarios).toHaveLength(1);
    expect(document?.scenarios[0]?.name).toBe('An event medic covers a stadium fixture');
    expect(
      document?.scenarios[0]?.steps.map(function toKeyword(step) {
        return step.keyword.trim();
      })
    ).toEqual(['Given', 'When', 'Then', 'Output', 'And', 'Outcome', 'But', 'Activates']);
    expect(
      document?.systemOutputs.map(function toText(item) {
        return item.text;
      })
    ).toEqual(['14 hours of event cover', '9 patients assessed']);
    expect(document?.systemOutcomes).toEqual([
      { text: 'the event can run with on-site first response' },
      { text: 'they missed a paid weekend shift', connector: 'but' },
    ]);
  });

  it('rejects Gurki syntax errors as GherkinSyntax', () => {
    const result = parseGurkiContent({
      path: 'specs/features/broken.spec.md',
      content: 'Scenario: Missing primary\nAnd dangling continuation\n',
      featuresRoot: 'specs/features',
    });

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('GherkinSyntax');
    if (error.tag === 'GherkinSyntax') {
      expect(error.detail).toMatch(/gurki/i);
    }
  });
});

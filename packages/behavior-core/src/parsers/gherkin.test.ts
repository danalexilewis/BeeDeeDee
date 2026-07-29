import { describe, expect, it } from 'vitest';
import { parseGherkinContent } from './gherkin.js';

const ROOT = 'specs/features';

function parse(content: string, path = 'specs/features/login.feature') {
  return parseGherkinContent({ path, content, featuresRoot: ROOT });
}

const SIMPLE = `@auth @smoke
Feature: Login
  Users need to sign in.

  Scenario: Successful login
    Given a registered user
    When they submit valid credentials
    Then they reach the dashboard
`;

describe('parseGherkinContent', () => {
  it('extracts the feature title, description, and tags', () => {
    const result = parse(SIMPLE);
    expect(result.isOk()).toBe(true);
    const doc = result._unsafeUnwrap();
    expect(doc.title).toBe('Login');
    expect(doc.description).toBe('Users need to sign in.');
    expect(doc.tags).toEqual(['@auth', '@smoke']);
    expect(doc.featureId).toBe('login');
    expect(doc.line).toBe(2);
  });

  it('extracts scenarios with ids, steps, and line numbers', () => {
    const doc = parse(SIMPLE)._unsafeUnwrap();
    expect(doc.scenarios).toHaveLength(1);

    const scenario = doc.scenarios[0]!;
    expect(scenario.id).toBe('login/successful-login');
    expect(scenario.line).toBe(5);
    expect(scenario.steps.map(s => s.text)).toEqual([
      'a registered user',
      'they submit valid credentials',
      'they reach the dashboard',
    ]);
    expect(scenario.steps.map(s => s.line)).toEqual([6, 7, 8]);
    expect(scenario.steps[0]!.keyword).toBe('Given ');
  });

  it('scopes step ids to their scenario', () => {
    const doc = parse(SIMPLE)._unsafeUnwrap();
    expect(doc.scenarios[0]!.steps[0]!.id).toBe('login/successful-login#step-1');
  });

  it('preserves the original source', () => {
    expect(parse(SIMPLE)._unsafeUnwrap().source).toBe(SIMPLE);
  });

  it('carries scenario tags', () => {
    const doc = parse(`Feature: F
  @wip @slow
  Scenario: S
    Given x
`)._unsafeUnwrap();
    expect(doc.scenarios[0]!.tags).toEqual(['@wip', '@slow']);
  });

  it('parses a background block', () => {
    const doc = parse(`Feature: F

  Background:
    Given a clean database

  Scenario: S
    Given x
`)._unsafeUnwrap();

    expect(doc.background?.steps.map(s => s.text)).toEqual(['a clean database']);
    expect(doc.background?.line).toBe(3);
  });

  it('parses a doc string step argument', () => {
    const doc = parse(`Feature: F
  Scenario: S
    Given a payload
      """
      hello
      """
`)._unsafeUnwrap();

    const argument = doc.scenarios[0]!.steps[0]!.argument;
    expect(argument?.type).toBe('doc_string');
    expect(argument?.content).toBe('hello');
  });

  it('parses a data table step argument', () => {
    const doc = parse(`Feature: F
  Scenario: S
    Given users
      | name | role  |
      | ada  | admin |
      | bob  | user  |
`)._unsafeUnwrap();

    const argument = doc.scenarios[0]!.steps[0]!.argument;
    expect(argument?.type).toBe('table');
    expect(argument?.content).toEqual({
      headers: ['name', 'role'],
      rows: [
        ['ada', 'admin'],
        ['bob', 'user'],
      ],
      line: 4,
    });
  });

  it('indexes a Scenario Outline as one scenario and counts its examples', () => {
    const doc = parse(`Feature: F
  Scenario Outline: Login as <role>
    Given a <role>

    Examples:
      | role  |
      | admin |
      | user  |
`)._unsafeUnwrap();

    expect(doc.scenarios).toHaveLength(1);
    expect(doc.scenarios[0]!.isOutline).toBe(true);
    expect(doc.scenarios[0]!.exampleCount).toBe(2);
  });

  it('attributes scenarios inside a Rule to that rule', () => {
    const doc = parse(`Feature: F

  Rule: Only admins may delete
    Scenario: Admin deletes
      Given an admin
    Scenario: User cannot delete
      Given a user
`)._unsafeUnwrap();

    expect(doc.rules).toHaveLength(1);
    expect(doc.rules[0]!.name).toBe('Only admins may delete');
    expect(doc.rules[0]!.scenarioIds).toEqual(['login/admin-deletes', 'login/user-cannot-delete']);
    expect(doc.scenarios.every(s => s.ruleName === 'Only admins may delete')).toBe(true);
  });

  it('disambiguates duplicate scenario names', () => {
    const doc = parse(`Feature: F
  Scenario: Retry
    Given x
  Scenario: Retry
    Given y
`)._unsafeUnwrap();

    expect(doc.scenarios.map(s => s.id)).toEqual(['login/retry', 'login/retry-2']);
  });

  it('derives a nested feature id from the path', () => {
    const doc = parse(SIMPLE, 'specs/features/auth/login.feature')._unsafeUnwrap();
    expect(doc.featureId).toBe('auth/login');
    expect(doc.scenarios[0]!.id).toBe('auth/login/successful-login');
  });

  it('handles a feature with no scenarios', () => {
    const doc = parse('Feature: Empty\n')._unsafeUnwrap();
    expect(doc.scenarios).toEqual([]);
    expect(doc.title).toBe('Empty');
  });
});

describe('parseGherkinContent failures', () => {
  it('reports a syntax error with a line number', () => {
    const result = parse(`Feature: F
  Scenario: S
    Given x
  Nonsense line that is not Gherkin
`);
    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('GherkinSyntax');
    if (error.tag === 'GherkinSyntax') {
      expect(error.path).toBe('specs/features/login.feature');
      expect(error.line).toBe(4);
      expect(error.detail.length).toBeGreaterThan(0);
    }
  });

  it('reports a file with no Feature keyword', () => {
    const result = parse('');
    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error.tag).toBe('GherkinSyntax');
    if (error.tag === 'GherkinSyntax') {
      expect(error.detail).toContain('no Feature');
    }
  });

  it('reports a file containing only comments', () => {
    expect(parse('# just a comment\n').isErr()).toBe(true);
  });

  it('reports an unknown language directive', () => {
    const result = parse('# language: klingon\nFeature: F\n');
    expect(result.isErr()).toBe(true);
  });

  it('never throws, even on binary-looking input', () => {
    expect(() => parse('\u0000\u0001\u0002')).not.toThrow();
    expect(parse('\u0000\u0001\u0002').isErr()).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { catalogDataSchema, featureFilterSchema } from './catalog.js';
import { isoDateTimeSchema } from './common.js';
import { diagramLinkSchema } from './diagram.js';
import { behaviorErrorTagSchema, errorSchema } from './error.js';
import { featureDetailSchema } from './feature.js';
import { workbenchEventSchema } from './events.js';
import { gherkinArgumentSchema, gherkinStepSchema } from './gherkin.js';
import { indexStatusSchema } from './index-status.js';
import { ingestRequestSchema } from './requests.js';
import { scenarioDetailSchema } from './scenario.js';
import { testStatusSchema } from './test.js';

const AT = '2026-07-29T10:00:00.000Z';

function aStep(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'step-1',
    keyword: 'Given ',
    text: 'a registered user',
    line: 4,
    ...overrides,
  };
}

function aTestStatus() {
  return {
    scenarioId: 'login.happy-path',
    overall: 'pass' as const,
    results: [
      {
        testId: 'tests/e2e/login.spec.ts:12',
        testName: 'logs in successfully',
        status: 'pass' as const,
        durationMs: 412,
        timestamp: AT,
        file: 'tests/e2e/login.spec.ts',
        line: 12,
        tags: ['@smoke'],
      },
    ],
    lastRun: AT,
    flaky: false,
  };
}

function aScenarioDetail() {
  return {
    id: 'login.happy-path',
    name: 'Successful login',
    description: '',
    steps: [aStep()],
    tags: ['@smoke'],
    testLinks: [
      {
        testId: 'tests/e2e/login.spec.ts:12',
        framework: 'playwright' as const,
        path: 'tests/e2e/login.spec.ts',
        line: 12,
        status: 'pass' as const,
        durationMs: 412,
      },
    ],
    diagramLinks: [],
    status: aTestStatus(),
    line: 3,
    featureId: 'login',
    featureTitle: 'Login',
    featurePath: 'specs/features/login.feature',
    gherkinSource: 'Feature: Login\n  Scenario: Successful login\n    Given a registered user\n',
    lastUpdated: AT,
  };
}

describe('isoDateTimeSchema', () => {
  it('accepts an ISO timestamp with offset', () => {
    expect(isoDateTimeSchema.safeParse(AT).success).toBe(true);
  });

  it.each(['2026-07-29', 'not a date', '', '29/07/2026'])('rejects %o', input => {
    expect(isoDateTimeSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a Date instance, because the wire format carries strings', () => {
    expect(isoDateTimeSchema.safeParse(new Date()).success).toBe(false);
  });
});

describe('gherkinStepSchema', () => {
  it('parses a step without an argument', () => {
    expect(gherkinStepSchema.safeParse(aStep()).success).toBe(true);
  });

  it('parses a step with a doc string argument', () => {
    const step = aStep({
      argument: { type: 'doc_string', content: 'payload', line: 5 },
    });
    expect(gherkinStepSchema.safeParse(step).success).toBe(true);
  });

  it('parses a step with a table argument', () => {
    const step = aStep({
      argument: {
        type: 'table',
        content: { headers: ['name'], rows: [['ada']], line: 5 },
        line: 5,
      },
    });
    expect(gherkinStepSchema.safeParse(step).success).toBe(true);
  });

  it('rejects a zero line number', () => {
    expect(gherkinStepSchema.safeParse(aStep({ line: 0 })).success).toBe(false);
  });
});

describe('gherkinArgumentSchema', () => {
  it('rejects a table payload declared as a doc string', () => {
    const result = gherkinArgumentSchema.safeParse({
      type: 'doc_string',
      content: { headers: [], rows: [], line: 1 },
      line: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown argument type', () => {
    const result = gherkinArgumentSchema.safeParse({ type: 'blob', content: 'x', line: 1 });
    expect(result.success).toBe(false);
  });
});

describe('diagramLinkSchema', () => {
  it('accepts a relevance score at each boundary', () => {
    for (const relevanceScore of [0, 0.5, 1]) {
      const result = diagramLinkSchema.safeParse({
        diagramId: 'auth-flow',
        type: 'mermaid',
        path: 'specs/diagrams/auth-flow.mmd',
        title: 'Auth flow',
        relevance: 'high',
        relevanceScore,
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects a relevance score above 1', () => {
    const result = diagramLinkSchema.safeParse({
      diagramId: 'auth-flow',
      type: 'mermaid',
      path: 'specs/diagrams/auth-flow.mmd',
      title: 'Auth flow',
      relevance: 'high',
      relevanceScore: 1.01,
    });
    expect(result.success).toBe(false);
  });
});

describe('testStatusSchema', () => {
  it('allows a null lastRun for a scenario that never ran', () => {
    const result = testStatusSchema.safeParse({
      scenarioId: 'login.happy-path',
      overall: 'not-run',
      results: [],
      lastRun: null,
      flaky: false,
    });
    expect(result.success).toBe(true);
  });

  it('defaults result tags to an empty array', () => {
    const parsed = testStatusSchema.parse({
      scenarioId: 's',
      overall: 'pass',
      results: [
        {
          testId: 't',
          testName: 'n',
          status: 'pass',
          timestamp: AT,
          file: 'f.spec.ts',
        },
      ],
      lastRun: AT,
      flaky: false,
    });
    expect(parsed.results[0]!.tags).toEqual([]);
  });
});

describe('scenarioDetailSchema', () => {
  it('survives a JSON round trip unchanged', () => {
    const original = scenarioDetailSchema.parse(aScenarioDetail());
    const roundTripped = scenarioDetailSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });

  it('reports the path of a nested failure', () => {
    const broken = aScenarioDetail();
    broken.steps = [aStep({ line: -1 })] as never;
    const result = scenarioDetailSchema.safeParse(broken);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(['steps', 0, 'line']);
    }
  });
});

describe('featureDetailSchema', () => {
  it('defaults rules to an empty array', () => {
    const parsed = featureDetailSchema.parse({
      id: 'login',
      title: 'Login',
      description: '',
      path: 'specs/features/login.feature',
      tags: [],
      scenarioCount: 1,
      testCoverage: 100,
      status: 'passing',
      lastUpdated: AT,
      scenarios: [],
      diagramLinks: [],
      gherkinSource: 'Feature: Login\n',
    });
    expect(parsed.rules).toEqual([]);
  });

  it('rejects coverage above 100', () => {
    const result = featureDetailSchema.safeParse({
      id: 'login',
      title: 'Login',
      description: '',
      path: 'p',
      tags: [],
      scenarioCount: 1,
      testCoverage: 101,
      status: 'passing',
      lastUpdated: AT,
      scenarios: [],
      diagramLinks: [],
      gherkinSource: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('catalogDataSchema', () => {
  it('survives a JSON round trip unchanged', () => {
    const original = catalogDataSchema.parse({
      features: [],
      totalScenarios: 0,
      overallCoverage: 0,
      statusCounts: { passing: 0, failing: 0, untested: 0 },
      tags: [],
    });
    const roundTripped = catalogDataSchema.parse(JSON.parse(JSON.stringify(original)));
    expect(roundTripped).toEqual(original);
  });
});

describe('featureFilterSchema', () => {
  it('accepts an empty query', () => {
    expect(featureFilterSchema.parse({})).toEqual({});
  });

  it('splits a single tag into a one-element list', () => {
    expect(featureFilterSchema.parse({ tags: 'auth' }).tags).toEqual(['auth']);
  });

  it('splits a comma-separated tag list', () => {
    expect(featureFilterSchema.parse({ tags: 'auth,billing' }).tags).toEqual(['auth', 'billing']);
  });

  it('trims whitespace around tags', () => {
    expect(featureFilterSchema.parse({ tags: ' auth , billing ' }).tags).toEqual([
      'auth',
      'billing',
    ]);
  });

  it('treats an empty or comma-only value as no filter', () => {
    expect(featureFilterSchema.parse({ tags: '' }).tags).toBeUndefined();
    expect(featureFilterSchema.parse({ tags: ',,' }).tags).toBeUndefined();
  });

  it('rejects an array, since the wire format is a single string', () => {
    expect(featureFilterSchema.safeParse({ tags: ['auth'] }).success).toBe(false);
  });

  it('coerces numeric coverage bounds from query strings', () => {
    const parsed = featureFilterSchema.parse({ minCoverage: '20', maxCoverage: '80' });
    expect(parsed.minCoverage).toBe(20);
    expect(parsed.maxCoverage).toBe(80);
  });

  it('rejects an unknown status', () => {
    expect(featureFilterSchema.safeParse({ status: 'flaky' }).success).toBe(false);
  });
});

describe('ingestRequestSchema', () => {
  it('accepts native results', () => {
    const result = ingestRequestSchema.safeParse({
      format: 'native',
      results: [
        {
          testId: 't',
          testName: 'n',
          status: 'pass',
          timestamp: AT,
          file: 'f.spec.ts',
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects native format with no results', () => {
    expect(ingestRequestSchema.safeParse({ format: 'native', results: [] }).success).toBe(false);
  });

  it('accepts a raw playwright report', () => {
    const result = ingestRequestSchema.safeParse({
      format: 'playwright-json',
      report: { suites: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown format', () => {
    expect(ingestRequestSchema.safeParse({ format: 'junit-xml', report: {} }).success).toBe(false);
  });
});

describe('errorSchema', () => {
  it('accepts every declared tag', () => {
    for (const tag of behaviorErrorTagSchema.options) {
      expect(errorSchema.safeParse({ tag, message: 'boom' }).success).toBe(true);
    }
  });

  it('rejects an undeclared tag', () => {
    expect(errorSchema.safeParse({ tag: 'KaboomError', message: 'boom' }).success).toBe(false);
  });
});

describe('indexStatusSchema', () => {
  it('carries per-file problems without failing the whole index', () => {
    const parsed = indexStatusSchema.parse({
      state: 'ready',
      featureCount: 2,
      scenarioCount: 5,
      diagramCount: 1,
      testFileCount: 3,
      lastIndexedAt: AT,
      durationMs: 120,
      problems: [
        {
          path: 'specs/features/broken.feature',
          error: { tag: 'GherkinSyntax', message: 'unexpected token', details: { line: 7 } },
        },
      ],
    });
    expect(parsed.problems).toHaveLength(1);
    expect(parsed.state).toBe('ready');
  });
});

describe('workbenchEventSchema', () => {
  it('discriminates each event type', () => {
    const events = [
      { type: 'index-updated', at: AT, featureCount: 1, scenarioCount: 2 },
      { type: 'test-status-changed', at: AT, scenarioId: 's', status: 'fail' },
      { type: 'spec-changed', at: AT, path: 'p.feature', change: 'changed' },
      { type: 'index-failed', at: AT, error: { tag: 'ReadFailed', message: 'nope' } },
    ];
    for (const event of events) {
      expect(workbenchEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('rejects an unknown event type', () => {
    expect(workbenchEventSchema.safeParse({ type: 'coffee-ready', at: AT }).success).toBe(false);
  });

  it('rejects a known type with the wrong payload', () => {
    const result = workbenchEventSchema.safeParse({ type: 'spec-changed', at: AT, path: 'p' });
    expect(result.success).toBe(false);
  });
});

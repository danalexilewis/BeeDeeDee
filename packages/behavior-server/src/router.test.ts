import { createTestFiles } from '@eddy/behavior-core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './testing/harness.js';

let harness: Harness;

const SCENARIO = 'login.successful-login';

beforeEach(async () => {
  harness = await createHarness();
});

afterEach(async () => {
  await harness.close();
});

describe('GET /api/catalog', () => {
  it('returns the catalog', async () => {
    const response = await harness.client.getCatalog();
    expect(response.status).toBe(200);
    if (response.status !== 200) return;

    expect(response.body.features.map(feature => feature.id)).toEqual(['billing', 'login']);
    expect(response.body.totalScenarios).toBe(3);
  });

  it('returns 503 before the first scan', async () => {
    const notReady = await createHarness({ skipInitialIndex: true });
    const response = await notReady.client.getCatalog();

    expect(response.status).toBe(503);
    if (response.status === 503) expect(response.body.tag).toBe('IndexNotReady');

    await notReady.close();
  });
});

describe('GET /api/features', () => {
  it('returns every feature with no filter', async () => {
    const response = await harness.client.listFeatures({ query: {} });
    expect(response.status).toBe(200);
    if (response.status === 200) expect(response.body).toHaveLength(2);
  });

  it('filters by status', async () => {
    const response = await harness.client.listFeatures({ query: { status: 'untested' } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.every(feature => feature.status === 'untested')).toBe(true);
    }
  });

  it('filters by a single tag', async () => {
    const response = await harness.client.listFeatures({ query: { tags: 'auth' } });
    expect(response.status).toBe(200);
    if (response.status === 200) expect(response.body.map(f => f.id)).toEqual(['login']);
  });

  it('requires every tag in a comma-separated list', async () => {
    const response = await harness.client.listFeatures({ query: { tags: 'auth,billing' } });
    if (response.status === 200) expect(response.body).toEqual([]);
  });

  it('reads a comma-separated tag list from a hand-written query string', async () => {
    const response = await harness.server.app.inject({
      method: 'GET',
      url: '/api/features?tags=auth',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().map((f: { id: string }) => f.id)).toEqual(['login']);
  });

  it('filters by search text', async () => {
    const response = await harness.client.listFeatures({ query: { search: 'invoiced' } });
    if (response.status === 200) expect(response.body).toHaveLength(1);
  });

  it('rejects an unknown status with 400 from schema validation', async () => {
    const response = await harness.server.app.inject({
      method: 'GET',
      url: '/api/features?status=flaky',
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/features/:featureId', () => {
  it('returns a feature with its scenarios', async () => {
    const response = await harness.client.getFeature({ params: { featureId: 'login' } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.title).toBe('Login');
      expect(response.body.scenarios).toHaveLength(2);
    }
  });

  it('returns 404 for an unknown feature', async () => {
    const response = await harness.client.getFeature({ params: { featureId: 'nope' } });
    expect(response.status).toBe(404);
    if (response.status === 404) expect(response.body.tag).toBe('FeatureNotFound');
  });
});

describe('GET /api/scenarios/:scenarioId', () => {
  it('returns a scenario', async () => {
    const response = await harness.client.getScenario({ params: { scenarioId: SCENARIO } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.name).toBe('Successful login');
      expect(response.body.steps).toHaveLength(3);
    }
  });

  it('returns 404 for an unknown scenario', async () => {
    const response = await harness.client.getScenario({ params: { scenarioId: 'nope' } });
    expect(response.status).toBe(404);
  });

  it('handles a scenario id containing a slash', async () => {
    const response = await harness.client.getScenario({ params: { scenarioId: SCENARIO } });
    expect(response.status).toBe(200);
  });
});

describe('GET /api/scenarios/:scenarioId/context', () => {
  it('returns agent context', async () => {
    const response = await harness.client.getAgentContext({ params: { scenarioId: SCENARIO } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.scenario.id).toBe(SCENARIO);
      expect(response.body.codeReferences.length).toBeGreaterThan(0);
    }
  });

  it('returns 404 for an unknown scenario', async () => {
    const response = await harness.client.getAgentContext({ params: { scenarioId: 'nope' } });
    expect(response.status).toBe(404);
  });
});

describe('GET /api/diagrams/:diagramId', () => {
  it('returns diagram content', async () => {
    const response = await harness.client.getDiagram({ params: { diagramId: 'login' } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.title).toBe('Login flow');
      expect(response.body.content).toContain('flowchart');
    }
  });

  it('returns 404 for an unknown diagram', async () => {
    const response = await harness.client.getDiagram({ params: { diagramId: 'nope' } });
    expect(response.status).toBe(404);
  });
});

describe('POST /api/tests/results', () => {
  it('ingests native results and reports what changed', async () => {
    const response = await harness.client.ingestTestResults({
      body: {
        format: 'native',
        results: [
          {
            testId: 'tests/e2e/login.spec.ts:3',
            testName: 'Successful login',
            status: 'pass',
            timestamp: '2026-07-29T10:00:00.000Z',
            file: 'tests/e2e/login.spec.ts',
            line: 3,
            tags: [],
          },
        ],
      },
    });

    expect(response.status).toBe(202);
    if (response.status === 202) {
      expect(response.body.ingested).toBe(1);
      expect(response.body.scenariosChanged).toEqual([SCENARIO]);
    }
  });

  it('updates the scenario status visible on a later read', async () => {
    await harness.client.ingestTestResults({
      body: {
        format: 'native',
        results: [
          {
            testId: 'tests/e2e/login.spec.ts:3',
            testName: 'Successful login',
            status: 'fail',
            errorMessage: 'boom',
            timestamp: '2026-07-29T10:00:00.000Z',
            file: 'tests/e2e/login.spec.ts',
            line: 3,
            tags: [],
          },
        ],
      },
    });

    const response = await harness.client.getScenario({ params: { scenarioId: SCENARIO } });
    if (response.status === 200) {
      expect(response.body.status.overall).toBe('fail');
      expect(response.body.testLinks[0]!.errorMessage).toBe('boom');
    }
  });

  it('ingests a Playwright report', async () => {
    const response = await harness.client.ingestTestResults({
      body: {
        format: 'playwright-json',
        report: {
          suites: [
            {
              file: 'tests/e2e/login.spec.ts',
              specs: [
                {
                  title: 'Successful login',
                  line: 3,
                  tests: [{ results: [{ status: 'passed', duration: 5 }] }],
                },
              ],
            },
          ],
        },
      },
    });

    expect(response.status).toBe(202);
    if (response.status === 202) expect(response.body.matchedScenarios).toBe(1);
  });

  it('returns 422 for a malformed report', async () => {
    const response = await harness.client.ingestTestResults({
      body: { format: 'playwright-json', report: { suites: 'nope' } },
    });
    expect(response.status).toBe(422);
    if (response.status === 422) expect(response.body.tag).toBe('SchemaValidation');
  });

  it('rejects an empty native result set with 400 from schema validation', async () => {
    const response = await harness.server.app.inject({
      method: 'POST',
      url: '/api/tests/results',
      payload: { format: 'native', results: [] },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/tests/:scenarioId/status', () => {
  it('returns aggregated status', async () => {
    const response = await harness.client.getTestStatus({ params: { scenarioId: SCENARIO } });
    expect(response.status).toBe(200);
    if (response.status === 200) expect(response.body.overall).toBe('not-run');
  });

  it('returns 404 for an unknown scenario', async () => {
    const response = await harness.client.getTestStatus({ params: { scenarioId: 'nope' } });
    expect(response.status).toBe(404);
  });
});

describe('index routes', () => {
  it('reports status', async () => {
    const response = await harness.client.getIndexStatus();
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.state).toBe('ready');
      expect(response.body.featureCount).toBe(2);
    }
  });

  it('reports an idle state before the first scan', async () => {
    const notReady = await createHarness({ skipInitialIndex: true });
    const response = await notReady.client.getIndexStatus();
    if (response.status === 200) expect(response.body.state).toBe('idle');
    await notReady.close();
  });

  it('re-indexes on request', async () => {
    const response = await harness.client.refreshIndex({ body: { force: true } });
    expect(response.status).toBe(202);
    if (response.status === 202) expect(response.body.state).toBe('ready');
  });

  it('surfaces a parse problem in the status', async () => {
    const broken = await createHarness({
      files: {
        ...createTestFiles(),
        'specs/features/broken.feature': 'Feature: B\n  Scenario: S\n    Given x\n  Nonsense\n',
      },
    });

    const response = await broken.client.getIndexStatus();
    if (response.status === 200) {
      expect(response.body.problems).toHaveLength(1);
      expect(response.body.problems[0]!.error.tag).toBe('GherkinSyntax');
    }

    await broken.close();
  });
});

describe('POST /api/lint', () => {
  it('returns no findings for clean specs', async () => {
    const response = await harness.client.lintSpecs({ body: {} });
    expect(response.status).toBe(200);
    if (response.status === 200) expect(response.body).toEqual([]);
  });

  it('reports findings for a messy feature', async () => {
    const messy = await createHarness({
      files: {
        'specs/features/messy.feature': 'Feature: Messy\n  Scenario: S\n    When x\n',
      },
    });

    const response = await messy.client.lintSpecs({ body: {} });
    if (response.status === 200) {
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.map(result => result.rule)).toContain('untagged-feature');
    }

    await messy.close();
  });
});

describe('POST /api/gherkin/validate', () => {
  it('accepts conventional Gherkin', async () => {
    const response = await harness.client.validateGherkin({
      body: {
        gherkin:
          '@auth\nFeature: Reset\n  Scenario: Reset requested\n    Given a registered user\n',
      },
    });

    expect(response.status).toBe(200);
    if (response.status === 200) expect(response.body.valid).toBe(true);
  });

  it('reports unparseable input as invalid rather than failing', async () => {
    const response = await harness.client.validateGherkin({ body: { gherkin: 'nonsense' } });
    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.valid).toBe(false);
      expect(response.body.compatibility).toBe(0);
    }
  });

  it('rejects an empty string with 400 from schema validation', async () => {
    const response = await harness.server.app.inject({
      method: 'POST',
      url: '/api/gherkin/validate',
      payload: { gherkin: '' },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /api/editor-links', () => {
  it('returns a link per configured editor', async () => {
    const response = await harness.client.getEditorLinks({
      query: { target: 'scenario', id: SCENARIO },
    });

    expect(response.status).toBe(200);
    if (response.status === 200) {
      expect(response.body.map(link => link.editor)).toEqual(['vscode', 'cursor']);
      expect(response.body[0]!.url).toContain('specs/features/login.feature');
    }
  });

  it('honours an explicit editor', async () => {
    const response = await harness.client.getEditorLinks({
      query: { target: 'scenario', id: SCENARIO, editor: 'kiro' },
    });
    if (response.status === 200) {
      expect(response.body).toHaveLength(1);
      expect(response.body[0]!.editor).toBe('kiro');
    }
  });

  it('returns 404 for an unknown target', async () => {
    const response = await harness.client.getEditorLinks({
      query: { target: 'feature', id: 'nope' },
    });
    expect(response.status).toBe(404);
  });

  it('rejects an unknown target kind with 400', async () => {
    const response = await harness.server.app.inject({
      method: 'GET',
      url: '/api/editor-links?target=banana&id=x',
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('unknown routes', () => {
  it('returns JSON for an unknown API path rather than HTML', async () => {
    const response = await harness.server.app.inject({ method: 'GET', url: '/api/nope' });
    expect(response.statusCode).toBe(404);
  });
});

describe('GET /api/health', () => {
  it('reports the index state', async () => {
    const response = await harness.server.app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', state: 'ready' });
  });
});

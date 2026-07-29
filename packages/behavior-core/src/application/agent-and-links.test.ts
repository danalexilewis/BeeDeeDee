import { beforeEach, describe, expect, it } from 'vitest';
import { createRecordingLogger } from '../adapters/logger.js';
import { createMemoryIndexStore } from '../adapters/memory-index-store.js';
import { createFixedClock } from '../adapters/system-clock.js';
import type { FileSystemPort } from '../ports/file-system.js';
import type { IndexStorePort } from '../ports/index-store.js';
import { createFakeFileSystem, createTestFiles, createTestProject } from '../testing/fakes.js';
import { generateAgentContext } from './agent-context.js';
import { generateEditorLinks } from './editor-links.js';
import { indexBehaviorSpecs } from './index-specs.js';
import { ingestTestResults } from './ingest-results.js';
import { conventionsFrom, lintSpecs, validateGherkin } from './lint-and-validate.js';

let indexStore: IndexStorePort;
let fileSystem: FileSystemPort;

const SCENARIO = 'login/successful-login';

beforeEach(async () => {
  indexStore = createMemoryIndexStore();
  fileSystem = createFakeFileSystem(createTestFiles());
  const index = await indexBehaviorSpecs(
    { fileSystem, clock: createFixedClock(), logger: createRecordingLogger() },
    { project: createTestProject() }
  );
  indexStore.write(index._unsafeUnwrap());
});

describe('generateAgentContext', () => {
  it('returns the scenario with its related siblings', () => {
    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(context.scenario.id).toBe(SCENARIO);
    expect(context.relatedScenarios.length).toBeGreaterThan(0);
    expect(context.relatedScenarios.every(s => s.id !== SCENARIO)).toBe(true);
  });

  it('ranks same-feature scenarios ahead of others', () => {
    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(context.relatedScenarios[0]!.id).toBe('login/locked-account');
  });

  it('includes a code reference to the Gherkin and to each linked test', () => {
    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(context.codeReferences.some(r => r.type === 'config')).toBe(true);
    expect(context.codeReferences.some(r => r.type === 'test')).toBe(true);
  });

  it('suggests writing a test for an untested scenario', () => {
    const context = generateAgentContext(
      { indexStore },
      'billing/invoice-generated'
    )._unsafeUnwrap();
    expect(context.suggestedActions.some(a => a.type === 'generate-test')).toBe(true);
  });

  it('does not suggest writing a test for a covered scenario', () => {
    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(context.suggestedActions.some(a => a.type === 'generate-test')).toBe(false);
  });

  it('suggests investigating a failing scenario', () => {
    ingestTestResults(
      { indexStore, clock: createFixedClock() },
      {
        format: 'native',
        results: [
          {
            testId: 'tests/e2e/login.spec.ts:3',
            testName: 'Successful login',
            status: 'fail',
            timestamp: '2026-07-29T10:00:00.000Z',
            file: 'tests/e2e/login.spec.ts',
            line: 3,
            tags: [],
          },
        ],
      }
    );

    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(context.suggestedActions.some(a => a.type === 'fix-scenario')).toBe(true);
  });

  it('reports a missing scenario', () => {
    expect(generateAgentContext({ indexStore }, 'nope')._unsafeUnwrapErr().tag).toBe(
      'ScenarioNotFound'
    );
  });

  it('returns a JSON-serialisable context', () => {
    const context = generateAgentContext({ indexStore }, SCENARIO)._unsafeUnwrap();
    expect(JSON.parse(JSON.stringify(context))).toEqual(context);
  });
});

describe('generateEditorLinks', () => {
  it('builds a link per configured editor for a scenario', async () => {
    const links = (
      await generateEditorLinks(
        { indexStore, fileSystem, projectRoot: '/repo' },
        { target: 'scenario', id: SCENARIO }
      )
    )._unsafeUnwrap();

    expect(links.map(link => link.editor)).toEqual(['vscode', 'cursor']);
    expect(links[0]!.url).toBe('vscode://file//repo/specs/features/login.feature:5');
    expect(links[0]!.targetExists).toBe(true);
  });

  it('honours an explicit editor', async () => {
    const links = (
      await generateEditorLinks(
        { indexStore, fileSystem, projectRoot: '/repo' },
        { target: 'scenario', id: SCENARIO, editor: 'cursor' }
      )
    )._unsafeUnwrap();

    expect(links).toHaveLength(1);
    expect(links[0]!.editor).toBe('cursor');
  });

  it('links a feature to its declaration line', async () => {
    const links = (
      await generateEditorLinks(
        { indexStore, fileSystem, projectRoot: '/repo' },
        { target: 'feature', id: 'login' }
      )
    )._unsafeUnwrap();

    expect(links[0]!.line).toBe(2);
  });

  it('links a test through the scenario it covers', async () => {
    const links = (
      await generateEditorLinks(
        { indexStore, fileSystem, projectRoot: '/repo' },
        { target: 'test', id: SCENARIO }
      )
    )._unsafeUnwrap();

    // The link carries the absolute path, because that is what an editor URL needs.
    expect(links[0]!.path).toBe('/repo/tests/e2e/login.spec.ts');
    expect(links[0]!.url).toContain('/repo/tests/e2e/login.spec.ts');
  });

  it('marks the target missing when the file is gone', async () => {
    const emptyFs = createFakeFileSystem({});
    const links = (
      await generateEditorLinks(
        { indexStore, fileSystem: emptyFs, projectRoot: '/repo' },
        { target: 'scenario', id: SCENARIO }
      )
    )._unsafeUnwrap();

    expect(links[0]!.targetExists).toBe(false);
  });

  it('reports a missing feature', async () => {
    const result = await generateEditorLinks(
      { indexStore, fileSystem, projectRoot: '/repo' },
      { target: 'feature', id: 'nope' }
    );
    expect(result._unsafeUnwrapErr().tag).toBe('FeatureNotFound');
  });

  it('reports IndexNotReady before the first scan', async () => {
    const result = await generateEditorLinks(
      { indexStore: createMemoryIndexStore(), fileSystem, projectRoot: '/repo' },
      { target: 'scenario', id: SCENARIO }
    );
    expect(result._unsafeUnwrapErr().tag).toBe('IndexNotReady');
  });
});

describe('lintSpecs', () => {
  /** An index containing one clean feature and one with several problems. */
  async function storeWithLintProblems(): Promise<IndexStorePort> {
    const store = createMemoryIndexStore();
    const index = await indexBehaviorSpecs(
      {
        fileSystem: createFakeFileSystem({
          ...createTestFiles(),
          'specs/features/messy.feature': `Feature: Messy
  Scenario: Same name
    And a continuation with nothing to continue
  Scenario: Same name
    Given x
`,
        }),
        clock: createFixedClock(),
        logger: createRecordingLogger(),
      },
      { project: createTestProject() }
    );
    store.write(index._unsafeUnwrap());
    return store;
  }

  it('finds nothing to report in clean specs', () => {
    expect(lintSpecs({ indexStore, fileSystem })._unsafeUnwrap()).toEqual([]);
  });

  it('reports findings for a feature with problems', async () => {
    const store = await storeWithLintProblems();
    const results = lintSpecs({ indexStore: store, fileSystem })._unsafeUnwrap();

    const rules = new Set(results.map(result => result.rule));
    expect(rules).toContain('duplicate-scenario-name');
    expect(rules).toContain('inconsistent-step-keyword');
    expect(rules).toContain('untagged-feature');
    expect(rules).toContain('missing-feature-description');
    expect(results.every(result => result.path === 'specs/features/messy.feature')).toBe(true);
  });

  it('orders findings by line', async () => {
    const store = await storeWithLintProblems();
    const lines = lintSpecs({ indexStore: store, fileSystem })
      ._unsafeUnwrap()
      .map(result => result.line ?? 0);
    expect([...lines].sort((a, b) => a - b)).toEqual(lines);
  });

  it('narrows to the requested paths', async () => {
    const store = await storeWithLintProblems();
    const results = lintSpecs({ indexStore: store, fileSystem }, [
      'specs/features/login.feature',
    ])._unsafeUnwrap();
    expect(results).toEqual([]);
  });

  it('reports IndexNotReady before the first scan', () => {
    const result = lintSpecs({ indexStore: createMemoryIndexStore(), fileSystem });
    expect(result._unsafeUnwrapErr().tag).toBe('IndexNotReady');
  });
});

describe('conventionsFrom', () => {
  it('collects tags, scenario names, and step texts already in use', () => {
    const conventions = conventionsFrom(indexStore.read()._unsafeUnwrap());
    expect(conventions.knownTags).toContain('@auth');
    expect(conventions.existingScenarioNames).toContain('Successful login');
    expect(conventions.knownStepTexts).toContain('a registered user');
  });
});

describe('validateGherkin', () => {
  it('accepts Gherkin that follows existing conventions', () => {
    const result = validateGherkin(
      { indexStore },
      `@auth
Feature: Password reset
  Scenario: Reset requested
    Given a registered user
    When they request a reset
    Then they receive an email
`
    )._unsafeUnwrap();

    expect(result.valid).toBe(true);
    expect(result.compatibility).toBeGreaterThan(50);
  });

  it('reports a syntax error as invalid rather than failing the call', () => {
    const result = validateGherkin({ indexStore }, 'not gherkin at all');
    expect(result.isOk()).toBe(true);

    const validation = result._unsafeUnwrap();
    expect(validation.valid).toBe(false);
    expect(validation.compatibility).toBe(0);
    expect(validation.warnings[0]!.severity).toBe('error');
  });

  it('warns when a scenario name already exists', () => {
    const result = validateGherkin(
      { indexStore },
      `Feature: Login again
  Scenario: Successful login
    Given a registered user
`
    )._unsafeUnwrap();

    expect(result.warnings.some(w => w.message.includes('already exists'))).toBe(true);
    expect(result.compatibility).toBeLessThan(100);
  });

  it('flags a tag no other spec uses', () => {
    const result = validateGherkin(
      { indexStore },
      `Feature: New thing
  @totallyNovel
  Scenario: Something new
    Given a registered user
`
    )._unsafeUnwrap();

    expect(result.warnings.some(w => w.message.includes('@totallyNovel'))).toBe(true);
  });

  it('reports a scenario with no steps as invalid', () => {
    const result = validateGherkin(
      { indexStore },
      `Feature: Empty
  Scenario: Nothing here
`
    )._unsafeUnwrap();

    expect(result.valid).toBe(false);
  });
});

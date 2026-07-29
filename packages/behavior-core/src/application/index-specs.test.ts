import { describe, expect, it } from 'vitest';
import { createRecordingLogger } from '../adapters/logger.js';
import { createFixedClock } from '../adapters/system-clock.js';
import { createFakeFileSystem, createTestFiles, createTestProject } from '../testing/index.js';
import { indexBehaviorSpecs, type IndexDeps } from './index-specs.js';

function deps(files: Record<string, string>, options = {}): IndexDeps {
  return {
    fileSystem: createFakeFileSystem(files, options),
    clock: createFixedClock(),
    logger: createRecordingLogger(),
  };
}

async function indexOf(files: Record<string, string>, options = {}) {
  const result = await indexBehaviorSpecs(deps(files, options), { project: createTestProject() });
  return result;
}

describe('indexBehaviorSpecs', () => {
  it('indexes features, scenarios, and diagrams', async () => {
    const result = await indexOf(createTestFiles());
    expect(result.isOk()).toBe(true);

    const index = result._unsafeUnwrap();
    expect([...index.features.keys()].sort()).toEqual(['billing', 'login']);
    expect(index.scenarios.size).toBe(3);
    expect([...index.diagrams.keys()]).toEqual(['login']);
    expect(index.problems).toEqual([]);
  });

  it('counts test files', async () => {
    const index = (await indexOf(createTestFiles()))._unsafeUnwrap();
    expect(index.testFileCount).toBe(1);
  });

  it('links a matching test to its scenario', async () => {
    const index = (await indexOf(createTestFiles()))._unsafeUnwrap();
    expect(index.testLinks.get('login.successful-login')).toHaveLength(1);
    expect(index.scenarioByTestId.size).toBe(1);
  });

  it('links a relevant diagram to a scenario', async () => {
    const index = (await indexOf(createTestFiles()))._unsafeUnwrap();
    const scenario = index.scenarios.get('login.successful-login');
    expect(scenario?.diagramLinks.map(link => link.diagramId)).toContain('login');
  });

  it('records a syntax error as a problem without losing the other features', async () => {
    const files = {
      ...createTestFiles(),
      'specs/features/broken.feature': 'Feature: Broken\n  Scenario: S\n    Given x\n  Nonsense\n',
    };

    const index = (await indexOf(files))._unsafeUnwrap();
    expect(index.features.size).toBe(2);
    expect(index.problems).toHaveLength(1);
    expect(index.problems[0]!.path).toBe('specs/features/broken.feature');
    expect(index.problems[0]!.error.tag).toBe('GherkinSyntax');
    expect(index.problems[0]!.error.details?.['line']).toBe(4);
  });

  it('records an unreadable file as a problem', async () => {
    const files = createTestFiles();
    const index = (
      await indexOf(files, { unreadable: { 'specs/features/login.feature': 'EACCES' } })
    )._unsafeUnwrap();

    expect(index.features.size).toBe(1);
    expect(index.problems[0]!.error.tag).toBe('ReadFailed');
  });

  it('records an invalid diagram as a problem', async () => {
    const files = { ...createTestFiles(), 'specs/diagrams/bad.mmd': 'not a diagram\n' };
    const index = (await indexOf(files))._unsafeUnwrap();
    expect(index.diagrams.size).toBe(1);
    expect(index.problems.some(p => p.error.tag === 'MermaidSyntax')).toBe(true);
  });

  it('produces an empty index for a project with no specs', async () => {
    const index = (await indexOf({}))._unsafeUnwrap();
    expect(index.features.size).toBe(0);
    expect(index.scenarios.size).toBe(0);
    expect(index.problems).toEqual([]);
  });

  it('fails when a spec directory exists but cannot be listed', async () => {
    const result = await indexOf(createTestFiles(), { unlistable: ['specs/features'] });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().tag).toBe('ReadFailed');
  });

  it('records the indexing timestamp from the clock', async () => {
    const index = (await indexOf(createTestFiles()))._unsafeUnwrap();
    expect(index.indexedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('logs a summary', async () => {
    const logger = createRecordingLogger();
    await indexBehaviorSpecs(
      {
        fileSystem: createFakeFileSystem(createTestFiles()),
        clock: createFixedClock(),
        logger,
      },
      { project: createTestProject() }
    );

    expect(logger.entries.some(entry => entry.message.includes('Indexed behavior specs'))).toBe(
      true
    );
  });

  it('is idempotent: indexing twice yields the same shape', async () => {
    const files = createTestFiles();
    const first = (await indexOf(files))._unsafeUnwrap();
    const second = (await indexOf(files))._unsafeUnwrap();

    expect([...second.features.keys()]).toEqual([...first.features.keys()]);
    expect([...second.scenarios.keys()]).toEqual([...first.scenarios.keys()]);
    expect(second.indexedAt).toBe(first.indexedAt);
    expect([...second.testLinks.entries()]).toEqual([...first.testLinks.entries()]);
  });

  it('carries the feature background onto the indexed feature', async () => {
    const index = (
      await indexOf({
        'specs/features/a.feature': `Feature: A
  Background:
    Given a clean slate

  Scenario: S
    Given x
`,
      })
    )._unsafeUnwrap();

    expect(index.features.get('a')?.background?.steps).toHaveLength(1);
  });

  it('scans an optional unit test directory when configured', async () => {
    const result = await indexBehaviorSpecs(
      deps({
        ...createTestFiles(),
        'tests/unit/thing.test.ts': "test('unit thing', () => {});",
      }),
      {
        project: createTestProject({
          testPaths: { e2e: 'tests/e2e', components: 'tests/components', unit: 'tests/unit' },
        }),
      }
    );

    expect(result._unsafeUnwrap().testFileCount).toBe(2);
  });
});

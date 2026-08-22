import { createFixedClock, createSilentLogger } from '@eddy/behavior-core';
import { createFakeFileSystem, createTestFiles } from '@eddy/behavior-core/testing';
import { describe, expect, it } from 'vitest';
import {
  runExport,
  runIndex,
  runIngestTests,
  runInit,
  runLint,
  runValidateLinks,
  type CommandDeps,
} from './commands.js';
import { createMemoryOutput } from './output.js';

type Harness = CommandDeps & {
  output: ReturnType<typeof createMemoryOutput>;
  fileSystem: ReturnType<typeof createFakeFileSystem>;
};

function harness(files: Record<string, string> = createTestFiles()): Harness {
  const output = createMemoryOutput();
  const fileSystem = createFakeFileSystem(files);

  return {
    fileSystem,
    clock: createFixedClock(),
    logger: createSilentLogger(),
    output,
    projectRoot: '/repo',
  };
}

/** All stdout lines joined, for substring assertions. */
function stdout(deps: Harness): string {
  return deps.output.lines.join('\n');
}

describe('runInit', () => {
  it('writes a .behaviorrc and succeeds', async () => {
    const deps = harness({});
    const code = await runInit(deps, false);

    expect(code).toBe(0);
    expect(deps.fileSystem.written.has('.behaviorrc')).toBe(true);
    expect(stdout(deps)).toContain('Wrote .behaviorrc');
  });

  it('suggests what to do next', async () => {
    const deps = harness({});
    await runInit(deps, false);
    expect(stdout(deps)).toContain('behavior index');
  });

  it('refuses to overwrite without --force', async () => {
    const deps = harness({ '.behaviorrc': '{}' });
    const code = await runInit(deps, false);

    expect(code).toBe(1);
    expect(deps.output.errors.join('\n')).toContain('--force');
  });

  it('overwrites with --force', async () => {
    const deps = harness({ '.behaviorrc': '{}' });
    expect(await runInit(deps, true)).toBe(0);
    expect(deps.fileSystem.written.has('.behaviorrc')).toBe(true);
  });
});

describe('runIndex', () => {
  it('reports what was indexed', async () => {
    const deps = harness();
    const code = await runIndex(deps, false);

    expect(code).toBe(0);
    expect(stdout(deps)).toContain('features:   2');
    expect(stdout(deps)).toContain('scenarios:  3');
  });

  it('emits JSON on request', async () => {
    const deps = harness();
    await runIndex(deps, true);

    const parsed = JSON.parse(stdout(deps));
    expect(parsed.featureCount).toBe(2);
    expect(parsed.state).toBe('ready');
  });

  it('lists parse problems but still succeeds', async () => {
    // Requirement 1.5 treats a malformed file as a finding, not a failure: the
    // rest of the index is still useful.
    const deps = harness({
      ...createTestFiles(),
      'specs/features/broken.feature': 'Feature: B\n  Scenario: S\n    Given x\n  Nonsense\n',
    });

    const code = await runIndex(deps, false);
    expect(code).toBe(0);
    expect(stdout(deps)).toContain('problems (1)');
    expect(stdout(deps)).toContain('broken.feature');
  });

  it('reports an empty project without failing', async () => {
    const deps = harness({});
    expect(await runIndex(deps, false)).toBe(0);
    expect(stdout(deps)).toContain('features:   0');
  });

  it('fails when the configuration file is malformed', async () => {
    const deps = harness({ '.behaviorrc': 'not json' });
    expect(await runIndex(deps, false)).toBe(1);
    expect(deps.output.errors.join('\n')).toContain('Invalid .behaviorrc');
  });

  it('honours configured spec directories', async () => {
    const deps = harness({
      '.behaviorrc': '{"specPaths":{"features":"docs/features","diagrams":"docs/diagrams"}}',
      'docs/features/a.feature': 'Feature: A\n  Scenario: S\n    Given x\n',
    });

    await runIndex(deps, false);
    expect(stdout(deps)).toContain('features:   1');
  });
});

describe('runIngestTests', () => {
  const PLAYWRIGHT_REPORT = JSON.stringify({
    suites: [
      {
        file: 'tests/e2e/login.spec.ts',
        specs: [
          {
            title: 'Successful login',
            line: 3,
            tests: [{ results: [{ status: 'passed', duration: 12 }] }],
          },
        ],
      },
    ],
  });

  it('ingests a Playwright report and reports what matched', async () => {
    const deps = harness({ ...createTestFiles(), 'results.json': PLAYWRIGHT_REPORT });
    const code = await runIngestTests(deps, 'results.json', 'playwright-json');

    expect(code).toBe(0);
    expect(stdout(deps)).toContain('ingested:  1');
    expect(stdout(deps)).toContain('matched:   1 scenarios');
  });

  it('lists tests that matched no scenario', async () => {
    const report = JSON.stringify({
      suites: [
        {
          file: 'tests/e2e/unknown.spec.ts',
          specs: [{ title: 'zzz', line: 9, tests: [{ results: [{ status: 'passed' }] }] }],
        },
      ],
    });
    const deps = harness({ ...createTestFiles(), 'results.json': report });

    await runIngestTests(deps, 'results.json', 'playwright-json');
    expect(stdout(deps)).toContain('unmatched tests (1)');
  });

  it('fails when the report file is missing', async () => {
    const deps = harness();
    expect(await runIngestTests(deps, 'nope.json', 'playwright-json')).toBe(1);
    expect(deps.output.errors.join('\n')).toContain('nope.json');
  });

  it('fails with a clear message when the report is not JSON', async () => {
    const deps = harness({ ...createTestFiles(), 'results.json': 'not json' });
    expect(await runIngestTests(deps, 'results.json', 'playwright-json')).toBe(1);
    expect(deps.output.errors.join('\n')).toContain('not valid JSON');
  });

  it('fails when the report does not match the declared format', async () => {
    const deps = harness({ ...createTestFiles(), 'results.json': '{"suites":"nope"}' });
    expect(await runIngestTests(deps, 'results.json', 'playwright-json')).toBe(1);
  });
});

describe('runLint', () => {
  it('reports no findings for clean specs', async () => {
    const deps = harness();
    expect(await runLint(deps, [])).toBe(0);
    expect(stdout(deps)).toContain('No lint findings.');
  });

  it('reports findings in a parseable form', async () => {
    const deps = harness({
      'specs/features/messy.feature': 'Feature: Messy\n  Scenario: S\n    When x\n',
    });

    await runLint(deps, []);
    expect(stdout(deps)).toMatch(/specs\/features\/messy\.feature:\d+ \w+ [\w-]+: /);
  });

  it('exits non-zero when a finding is an error', async () => {
    const deps = harness({
      'specs/features/empty.feature': 'Feature: E\n  Scenario: Nothing\n',
    });

    const code = await runLint(deps, []);
    expect(code).toBe(1);
    expect(stdout(deps)).toContain('empty-scenario');
  });

  it('exits zero when findings are only warnings or info', async () => {
    const deps = harness({
      'specs/features/warn.feature': 'Feature: W\n  Scenario: S\n    When x\n',
    });
    expect(await runLint(deps, [])).toBe(0);
  });

  it('narrows to the given paths', async () => {
    const deps = harness({
      ...createTestFiles(),
      'specs/features/messy.feature': 'Feature: Messy\n  Scenario: S\n    When x\n',
    });

    await runLint(deps, ['specs/features/login.feature']);
    expect(stdout(deps)).toContain('No lint findings.');
  });
});

describe('runValidateLinks', () => {
  it('reports that all links resolve for a healthy project', async () => {
    const deps = harness();
    const code = await runValidateLinks(deps);

    expect(code).toBe(0);
    expect(stdout(deps)).toContain('all links resolve');
    expect(stdout(deps)).toContain('across 3 scenarios');
  });

  it('reports zero links for an empty project', async () => {
    const deps = harness({});
    expect(await runValidateLinks(deps)).toBe(0);
    expect(stdout(deps)).toContain('checked 0 links');
  });
});

describe('runExport', () => {
  it('writes JSON by default', async () => {
    const deps = harness();
    expect(await runExport(deps, 'json')).toBe(0);

    const parsed = JSON.parse(stdout(deps));
    expect(parsed.features).toHaveLength(2);
  });

  it('writes CSV with a header row', async () => {
    const deps = harness();
    await runExport(deps, 'csv');

    const lines = deps.output.lines;
    expect(lines[0]).toBe('id,title,path,scenarios,coverage,status,tags');
    expect(lines).toHaveLength(3);
  });

  it('quotes CSV fields containing a comma', async () => {
    const deps = harness({
      'specs/features/a.feature': 'Feature: One, two\n  Scenario: S\n    Given x\n',
    });

    await runExport(deps, 'csv');
    expect(stdout(deps)).toContain('"One, two"');
  });

  it('writes a Markdown table', async () => {
    const deps = harness();
    await runExport(deps, 'markdown');

    expect(stdout(deps)).toContain('| Feature | Scenarios | Coverage | Status |');
    expect(stdout(deps)).toContain('| Login |');
  });

  it('summarises totals in the Markdown header', async () => {
    const deps = harness();
    await runExport(deps, 'markdown');
    expect(stdout(deps)).toContain('2 features, 3 scenarios');
  });
});

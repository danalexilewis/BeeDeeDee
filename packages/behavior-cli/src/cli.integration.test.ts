import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestFiles } from '@eddy/behavior-core/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const builtCli = join(packageRoot, 'dist/cli.js');

let root: string;

/**
 * The built binary is what users run, so these tests exercise it as a process:
 * real argument parsing, real exit codes, real stdout. Unit tests cover the
 * command bodies; this covers the wiring in between.
 */
beforeAll(function requireBuild() {
  if (!existsSync(builtCli)) {
    throw new Error(
      `${builtCli} is missing. Run \`pnpm --filter @eddy/behavior-cli build\` before this suite.`
    );
  }
});

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'behavior-cli-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

/** Writes the standard fixture project into the temp root. */
async function writeFixtureProject(): Promise<void> {
  for (const [path, content] of Object.entries(createTestFiles())) {
    const absolute = join(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
}

type CliResult = { code: number; stdout: string; stderr: string };

/** Runs the built CLI against the temp project. */
function runCli(args: readonly string[]): Promise<CliResult> {
  return new Promise(function spawnCli(resolve, reject) {
    const child = spawn(process.execPath, [builtCli, '--cwd', root, ...args], {
      cwd: root,
      env: { ...process.env, NO_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', function onStdout(chunk: Buffer) {
      stdout += chunk.toString();
    });
    child.stderr.on('data', function onStderr(chunk: Buffer) {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', function onClose(code) {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

describe('behavior --help', () => {
  it('lists every command', async () => {
    const result = await runCli(['--help']);

    expect(result.code).toBe(0);
    for (const command of [
      'init',
      'index',
      'serve',
      'ingest-tests',
      'lint',
      'validate-links',
      'export',
    ]) {
      expect(result.stdout).toContain(command);
    }
  });

  it('reports its version', async () => {
    const result = await runCli(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('0.1.0');
  });
});

describe('behavior init', () => {
  it('writes a config file and exits zero', async () => {
    const result = await runCli(['init']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Wrote .behaviorrc');
    expect(existsSync(join(root, '.behaviorrc'))).toBe(true);
  });

  it('exits non-zero rather than clobbering an existing file', async () => {
    await runCli(['init']);
    const second = await runCli(['init']);

    expect(second.code).toBe(1);
    expect(second.stderr).toContain('--force');
  });
});

describe('behavior index', () => {
  it('reports counts for a real project', async () => {
    await writeFixtureProject();
    const result = await runCli(['index']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('features:   2');
    expect(result.stdout).toContain('scenarios:  3');
  });

  it('emits machine-readable JSON with --json', async () => {
    await writeFixtureProject();
    const result = await runCli(['index', '--json']);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).featureCount).toBe(2);
  });

  it('exits zero on an empty project', async () => {
    const result = await runCli(['index']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('features:   0');
  });

  it('exits non-zero for a malformed config file', async () => {
    await writeFile(join(root, '.behaviorrc'), 'not json');
    const result = await runCli(['index']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('.behaviorrc');
  });
});

describe('behavior lint', () => {
  it('exits zero for clean specs', async () => {
    await writeFixtureProject();
    const result = await runCli(['lint']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('No lint findings.');
  });

  it('exits non-zero when a finding is an error', async () => {
    await mkdir(join(root, 'specs/features'), { recursive: true });
    await writeFile(
      join(root, 'specs/features/empty.feature'),
      'Feature: E\n  Scenario: Nothing\n'
    );

    const result = await runCli(['lint']);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain('empty-scenario');
  });
});

describe('behavior ingest-tests', () => {
  it('ingests a Playwright report', async () => {
    await writeFixtureProject();
    await writeFile(
      join(root, 'results.json'),
      JSON.stringify({
        suites: [
          {
            file: 'tests/e2e/login.spec.ts',
            specs: [
              {
                title: 'Successful login',
                line: 3,
                tests: [{ results: [{ status: 'passed', duration: 9 }] }],
              },
            ],
          },
        ],
      })
    );

    const result = await runCli(['ingest-tests', 'results.json']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('matched:   1 scenarios');
  });

  it('rejects an unknown format before doing any work', async () => {
    await writeFixtureProject();
    const result = await runCli(['ingest-tests', 'results.json', '--format', 'junit-xml']);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('unknown format junit-xml');
  });
});

describe('behavior export', () => {
  it('writes JSON by default', async () => {
    await writeFixtureProject();
    const result = await runCli(['export']);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).features).toHaveLength(2);
  });

  it('writes CSV', async () => {
    await writeFixtureProject();
    const result = await runCli(['export', '--format', 'csv']);

    expect(result.code).toBe(0);
    expect(result.stdout.split('\n')[0]).toBe('id,title,path,scenarios,coverage,status,tags');
  });

  it('writes Markdown', async () => {
    await writeFixtureProject();
    const result = await runCli(['export', '--format', 'markdown']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('| Feature | Scenarios | Coverage | Status |');
  });

  it('rejects an unknown format', async () => {
    const result = await runCli(['export', '--format', 'xml']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('unknown format xml');
  });
});

describe('behavior validate-links', () => {
  it('reports that links resolve for a healthy project', async () => {
    await writeFixtureProject();
    const result = await runCli(['validate-links']);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('all links resolve');
  });
});

describe('unknown commands', () => {
  it('exits non-zero and suggests help', async () => {
    const result = await runCli(['frobnicate']);
    expect(result.code).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});

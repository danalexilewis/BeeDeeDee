import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

/** Port for the workbench under test, distinct from the demo project's default. */
const PORT = 4180;

/** Repository root, since the server command uses repo-relative paths. */
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const isCi = process.env['CI'] !== undefined;

/**
 * Lives in `e2e/` rather than the repository root on purpose.
 *
 * Playwright's TypeScript loader walks up from the config file for a tsconfig and
 * cannot follow the directory-style project references in the root solution file.
 * Keeping the config beside `e2e/tsconfig.json` avoids that entirely.
 */
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  reporter: isCi ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  /**
   * Serves the built SPA from Fastify, exactly as a user would run it.
   *
   * Watching is off so a re-index cannot race an assertion; the live-update tests
   * drive changes through the ingest API instead, which is deterministic.
   */
  webServer: {
    command: [
      'node',
      'packages/behavior-cli/dist/cli.js',
      '--cwd',
      'examples/demo-project',
      'serve',
      '--port',
      String(PORT),
      '--no-watch',
    ].join(' '),
    cwd: repoRoot,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !isCi,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});

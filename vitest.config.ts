import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const nodePackages = [
  'behavior-contracts',
  'behavior-core',
  'behavior-server',
  'behavior-cli',
  'behavior-mcp',
  'test-support',
];

/** Absolute path to a workspace package's entry source file. */
function sourceEntry(packageName: string): string {
  return fileURLToPath(new URL(`./packages/${packageName}/src/index.ts`, import.meta.url));
}

/**
 * Resolve workspace packages to source rather than built `dist`.
 *
 * Tests then need no prior build, and every package shares one module graph. The
 * latter matters for fast-check: loading it as both ESM and CJS yields two
 * `Arbitrary` classes, and arbitraries built by one fail the other's instanceof
 * check.
 */
const workspaceAliases = {
  '@eddy/behavior-contracts': sourceEntry('behavior-contracts'),
  // The more specific subpath must precede the bare package name, or the bare
  // alias would swallow it.
  '@eddy/behavior-core/testing': fileURLToPath(
    new URL('./packages/behavior-core/src/testing/index.ts', import.meta.url)
  ),
  '@eddy/behavior-core': sourceEntry('behavior-core'),
  '@eddy/behavior-server': sourceEntry('behavior-server'),
  '@eddy/behavior-cli': sourceEntry('behavior-cli'),
  '@eddy/behavior-mcp': sourceEntry('behavior-mcp'),
  '@eddy/test-support': sourceEntry('test-support'),
};

export default defineConfig({
  test: {
    // Packages gain tests as phases land; a filtered run should not fail for an
    // empty project.
    passWithNoTests: true,
    projects: [
      ...nodePackages.map(function toProject(name) {
        return {
          resolve: {
            alias: workspaceAliases,
          },
          test: {
            name,
            root: `packages/${name}`,
            environment: 'node' as const,
            include: ['src/**/*.test.ts', 'src/**/*.prop.test.ts'],
            passWithNoTests: true,
          },
        };
      }),
      // The SPA runs its own project in browser mode, configured alongside its
      // Vite build so plugins and aliases match what ships.
      './packages/behavior-web/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.prop.test.ts',
        'packages/*/src/index.ts',
        // Test doubles, fixtures, and harnesses are test infrastructure rather
        // than shipped logic, so counting them would dilute the figure they help
        // produce.
        'packages/*/src/testing/**',
        'packages/*/src/test/**',
        // Exercised by cli.integration.test.ts, which spawns the built binary;
        // v8 coverage does not follow into a child process.
        'packages/behavior-cli/src/cli.ts',
        'packages/test-support/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        // design.md sets a higher bar for the core parsing and analysis modules.
        'packages/behavior-core/src/domain/**/*.ts': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
      },
    },
  },
});

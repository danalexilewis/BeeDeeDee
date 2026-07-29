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
    projects: nodePackages.map(function toProject(name) {
      return {
        resolve: {
          alias: workspaceAliases,
        },
        test: {
          name,
          root: `packages/${name}`,
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.prop.test.ts'],
          passWithNoTests: true,
        },
      };
    }),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/*.prop.test.ts',
        'packages/*/src/index.ts',
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

import { defineConfig } from 'vitest/config';

const nodePackages = [
  'behavior-contracts',
  'behavior-core',
  'behavior-server',
  'behavior-cli',
  'behavior-mcp',
  'test-support',
];

export default defineConfig({
  test: {
    // Packages gain tests as phases land; a filtered run should not fail for an
    // empty project.
    passWithNoTests: true,
    projects: nodePackages.map(function toProject(name) {
      return {
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

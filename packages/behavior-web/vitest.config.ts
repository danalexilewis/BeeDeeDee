import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Component tests run in a real browser rather than jsdom.
 *
 * This UI renders Mermaid SVG, measures rows for virtual scrolling, and drives
 * panels through ResizeObserver. jsdom has no layout engine, so all three would
 * need mocking and the tests would end up asserting the mocks. Browser mode also
 * reuses the Playwright install the e2e suite already needs.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@eddy/behavior-contracts': fileURLToPath(
        new URL('../behavior-contracts/src/index.ts', import.meta.url)
      ),
    },
  },
  /**
   * Pre-bundle the React-dependent packages.
   *
   * On a cold cache Vite optimises these mid-run, and modules imported during
   * that window can pick up a half-initialised React whose hook dispatcher is
   * null. Naming them here makes the first run behave like a warm one, which
   * matters most in CI where the cache is always cold.
   */
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-dev-runtime',
      '@tanstack/react-query',
      '@tanstack/react-router',
      '@tanstack/react-virtual',
      'react-resizable-panels',
      '@xyflow/react',
    ],
  },
  test: {
    name: 'behavior-web',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    passWithNoTests: true,
    setupFiles: ['./src/test/setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});

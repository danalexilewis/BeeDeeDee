import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Where the API lives during development. */
const API_TARGET = process.env['BEHAVIOR_API_URL'] ?? 'http://127.0.0.1:4000';

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
  server: {
    port: 5173,
    // In development Vite serves the SPA and forwards the API to Fastify. In
    // production Fastify serves both, so no proxy exists and the same relative
    // URLs keep working.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        // SSE must not be buffered, so the proxy streams the response through.
        ws: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

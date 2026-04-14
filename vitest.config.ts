import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      ['tests/renderer/**', 'jsdom'],
      ['tests/main/**', 'node'],
      ['tests/infrastructure/**', 'node'],
      ['tests/shared/**', 'node'],
    ],
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@renderer': resolve('src/renderer/src'),
      '@main': resolve('src/main'),
      '@infra': resolve('src/infrastructure')
    }
  }
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    // Use jsdom for React component tests
    environmentMatchGlobs: [
      ['components/**/*.{test.ts,test.tsx}', 'jsdom'],
      ['context/**/*.{test.ts,test.tsx}', 'jsdom'],
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

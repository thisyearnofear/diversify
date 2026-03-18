import { defineConfig } from 'vitest/config';

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
});

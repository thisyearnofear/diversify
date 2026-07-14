import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.{ts,tsx}'],
    env: {
      NODE_ENV: 'test',
    },
    // setupFiles runs before each test file. The import registers
    // @testing-library/react's auto-cleanup hook so component tests
    // don't leak DOM between cases.
    setupFiles: ['./vitest.setup.ts'],
    // Use jsdom for React component tests
    environmentMatchGlobs: [
      ['components/**/*.{test.ts,test.tsx}', 'jsdom'],
      ['context/**/*.{test.ts,test.tsx}', 'jsdom'],
    ],
    server: {
      // The GoodDollar SDK + its CJS deps (lz-string, etc.) need to be
      // transformed by Vite rather than loaded as native ESM. Without this
      // any test that imports gooddollar-service will crash with
      // "Named export 'X' not found" for the SDK's CJS transitive deps.
      //
      // @diversifi/shared-0g is inlined so test files that transitively pull
      // in `@diversifi/shared` (which the AI decorator barrel re-exports
      // from shared-0g's source path) don't fail with MODULE_NOT_FOUND
      // against the unbuilt source under vitest's resolver.
      deps: {
        inline: [/@goodsdks\//, /lz-string/, /axios/, /@diversifi\/shared-0g/],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

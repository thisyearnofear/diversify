/**
 * Vitest setup — runs before each test file.
 *
 * Explicitly registers `@testing-library/react`'s `cleanup()` after each
 * test so component tests don't leak DOM between cases. Component test
 * files no longer need to remember this themselves — they get isolation
 * for free.
 *
 * The bare `import '@testing-library/react'` does NOT reliably register
 * cleanup inside vitest setupFiles (the package side-effect registers
 * `afterEach` only against the jest global, not the vitest runner).
 * Calling `afterEach` ourselves from the vitest namespace is the
 * reliable pattern.
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

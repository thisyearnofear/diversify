import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedPaths, selectChecks } from './pre-push-checks.mjs';

const local = 'a'.repeat(40);
const remote = 'b'.repeat(40);
const zero = '0'.repeat(40);
const record = (old = remote, next = local) => `refs/heads/main ${next} refs/heads/main ${old}`;
const git = (args) => {
  if (args[0] === 'rev-parse') return `${local}\n`;
  if (args[0] === 'cat-file') return '';
  assert.equal(args.at(-1), `${remote}..${local}`);
  assert.ok(args.includes('--no-renames'));
  return 'apps/web/components/agent/AIChat.tsx\0docs/setup.md\0';
};

test('uses the entire outgoing range and deduplicates multiple ref records', () => {
  assert.deepEqual(changedPaths(`${record()}\n${record()}`, git), [
    'apps/web/components/agent/AIChat.tsx', 'docs/setup.md',
  ]);
});
test('new branches, absent records and malformed records fall back fully', () => {
  assert.equal(changedPaths(record(zero), git), null);
  assert.equal(changedPaths('', git), null);
  assert.equal(changedPaths('invalid', git), null);
});
test('a deleted ref needs no tests', () => {
  assert.deepEqual(changedPaths(record(remote, zero), git), []);
});
test('missing remote objects never become an empty change set', () => {
  assert.equal(changedPaths(record(), (args) => {
    if (args[0] === 'rev-parse') return local;
    throw new Error('missing object');
  }), null);
});
test('rejects testing a checkout different from the pushed ref', () => {
  assert.throws(() => changedPaths(record(), () => remote), /Check out/);
});
test('documentation-only pushes skip code checks', () => {
  assert.equal(selectChecks(['docs/setup.md', 'README.md']).mode, 'skip');
});
test('app source and edited test files select related tests', () => {
  assert.equal(selectChecks(['apps/web/components/agent/AIChat.tsx']).mode, 'related');
  assert.equal(selectChecks(['apps/web/lib/__tests__/wallet-auth.test.ts']).mode, 'related');
});
test('deleted app source falls back fully while deleted docs need no tests', () => {
  assert.equal(selectChecks(['apps/web/components/retired.tsx'], () => false).mode, 'full');
  assert.equal(selectChecks(['docs/retired.md'], () => false).mode, 'skip');
});
test('a mixed deletion and code push still checks the code', () => {
  assert.equal(selectChecks(changedPaths(`${record(remote, zero)}\n${record()}`, git)).mode, 'related');
});
test('shared code, tooling, config and unknown assets run fully', () => {
  for (const path of [
    'packages/shared/src/services/ai-service.ts', 'pnpm-lock.yaml',
    'vitest.setup.ts', '.github/workflows/tests.yml', '.husky/pre-push',
    'scripts/pre-push-checks.mjs', 'apps/web/styles/globals.css',
    'apps/web/next.config.js', 'apps/web/public/rive/guardian.riv',
  ]) assert.equal(selectChecks([path]).mode, 'full', path);
  assert.equal(selectChecks(null).mode, 'full');
});

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SAFETY_TESTS = [
  'apps/web/lib/__tests__/signer-env-leak.test.ts',
  'apps/web/lib/__tests__/wallet-auth.test.ts',
  'apps/web/lib/__tests__/vault-executor-fail-closed.test.ts',
  'apps/web/lib/guardian/__tests__/cycle-execution.test.ts',
  'packages/shared/src/services/compliance/__tests__/sanctions-screening.service.test.ts',
  'apps/web/tests/api/agent/memory.test.ts',
  'packages/shared/src/services/swap/__tests__/swap-orchestrator.service.test.ts',
];

const ZERO = /^0+$/;
const SHA = /^[a-f0-9]{40,64}$/;

/** Plan from every ref supplied by Git, never just the most recent commit. */
export function changedPaths(records, git) {
  if (!records.trim()) return null;
  const paths = new Set();
  for (const line of records.trim().split('\n').filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length !== 4) return null;
    const [, local, , remote] = fields;
    if (!SHA.test(local) || !SHA.test(remote)) return null;
    if (ZERO.test(local)) continue; // Remote branch deletion.
    // Hooks test the checkout, not an arbitrary pushed ref.
    if (git(['rev-parse', 'HEAD']).trim() !== local) {
      throw new Error('Check out the ref being pushed before running its checks.');
    }
    // A new branch or missing remote object cannot yield a trusted small diff.
    if (ZERO.test(remote)) return null;
    try {
      git(['cat-file', '-e', `${remote}^{commit}`]);
      for (const path of git(['diff', '--name-only', '--no-renames', '-z', `${remote}..${local}`]).split('\0')) {
        if (path) paths.add(path);
      }
    } catch {
      return null;
    }
  }
  return [...paths];
}

export function selectChecks(paths, exists = () => true) {
  if (paths === null) return { mode: 'full', paths: [] };
  const code = paths.filter((p) => !(
    p.startsWith('docs/') && p.endsWith('.md') ||
    !p.includes('/') && p.endsWith('.md')
  ));
  if (!code.length) return { mode: 'skip', paths: [] };
  // Related-test graph selection is limited to application source. Shared
  // packages, tooling, configuration, deletions and unknown assets run fully.
  if (code.some((p) => !exists(p) || !/^apps\/web\/(components|context|hooks|lib|pages|constants)\/.*\.(ts|tsx)$/.test(p))) {
    return { mode: 'full', paths: [] };
  }
  return { mode: 'related', paths: code };
}

function run(args) {
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

export function main(records) {
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const paths = changedPaths(records, git);
  // Include local modifications: tests run against the worktree, not Git blobs.
  const dirty = git(['diff', '--name-only', '--no-renames', '-z', 'HEAD'])
    .split('\0').filter(Boolean);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean);
  const plan = selectChecks(paths === null ? null : [...new Set([...paths, ...dirty, ...untracked])], existsSync);
  console.log(`Pre-push: ${plan.mode === 'skip' ? 'documentation only; no code checks' : `${plan.mode} tests + typecheck`}`);
  if (plan.mode === 'skip') return;
  const policy = spawnSync(process.execPath, ['--test', 'scripts/pre-push-checks.test.mjs'], { stdio: 'inherit' });
  if (policy.status !== 0) throw new Error('Push-selection regression tests failed.');
  if (!existsSync('packages/shared/dist/types/strategy.d.ts') ||
      !existsSync('packages/mento-utils/dist/index.d.ts')) {
    run(['exec', 'turbo', 'run', 'build', '--filter=@diversifi/shared', '--filter=@stable-station/mento-utils']);
  }
  run(['exec', 'tsc', '--noEmit']);
  if (plan.mode === 'full') {
    run(['exec', 'vitest', 'run']);
  } else {
    const changedTests = plan.paths.filter((p) => /\.test\.(ts|tsx)$/.test(p));
    const explicitTests = [...new Set([...SAFETY_TESTS, ...changedTests])];
    run(['exec', 'vitest', 'run', ...explicitTests]);
    // Do not repeat the explicit tests if they also appear in the import graph.
    const exclusions = explicitTests.flatMap((p) => ['--exclude', p]);
    run(['exec', 'vitest', 'related', '--run', '--passWithNoTests', ...exclusions, ...plan.paths]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(readFileSync(0, 'utf8')); }
  catch (error) { console.error(`Pre-push checks failed: ${error.message}`); process.exitCode = 1; }
}

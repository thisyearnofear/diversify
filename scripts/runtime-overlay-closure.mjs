#!/usr/bin/env node
/**
 * runtime-overlay-closure — compute the full dependency closure of the
 * runtime-loaded packages the Hetzner deploy overlays on top of the
 * Next.js standalone trace.
 *
 * NFT tracing misses packages loaded via eval('require(...)') /
 * `new Function` dynamic imports, and even the ones it partially ships
 * arrive with incomplete trees (e.g. @noble/hashes missing hkdf.js).
 * The deploy therefore rsyncs every package in this closure IN FULL.
 *
 * Resolution follows node semantics: a dep resolves from the requiring
 * package's own nested node_modules first (handles version conflicts like
 * open-jsonrpc-provider's nested axios@0.27/ws), then the hoisted root
 * node_modules (repo uses node-linker=hoisted).
 *
 * Output: unique package directories, one per line, relative to the repo
 * root (e.g. `node_modules/ai` or
 * `node_modules/open-jsonrpc-provider/node_modules/ws`).
 * Exits non-zero if a non-optional dependency cannot be resolved locally.
 */
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = JSON.parse(
  readFileSync(join(ROOT, 'scripts/runtime-loaded-packages.json'), 'utf8'),
);

const visited = new Set(); // dedupe by real path (pnpm symlinks → store)
const dirs = [];           // repo-relative package dirs, in visit order
const missing = [];
const peerWarnings = [];

function resolvePkg(name, fromDir) {
  const nested = join(fromDir, 'node_modules', name);
  if (existsSync(join(nested, 'package.json'))) return nested;
  const hoisted = join(ROOT, 'node_modules', name);
  if (existsSync(join(hoisted, 'package.json'))) return hoisted;
  return null;
}

function walk(name, fromDir, optional) {
  const dir = resolvePkg(name, fromDir);
  if (!dir) {
    if (!optional) missing.push(`${name} (required by ${relative(ROOT, fromDir) || 'root list'})`);
    return;
  }
  const real = realpathSync(dir);
  if (visited.has(real)) return;
  visited.add(real);
  dirs.push(relative(ROOT, dir));

  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const deps = pkg.dependencies ?? {};
  const optDeps = pkg.optionalDependencies ?? {};
  const peerDeps = pkg.peerDependencies ?? {};
  const peerMeta = pkg.peerDependenciesMeta ?? {};
  for (const dep of Object.keys(deps)) walk(dep, dir, Object.hasOwn(optDeps, dep));
  for (const dep of Object.keys(optDeps)) {
    if (!Object.hasOwn(deps, dep)) walk(dep, dir, true);
  }
  // Peers are real runtime imports too (e.g. @ai-sdk/provider-utils → zod)
  // and are equally partial in the standalone trace — include them when
  // they resolve locally. An unresolvable non-optional peer warns rather
  // than fails (it may be provided by the app, not this overlay).
  for (const dep of Object.keys(peerDeps)) {
    if (Object.hasOwn(deps, dep) || Object.hasOwn(optDeps, dep)) continue;
    if (resolvePkg(dep, dir)) {
      walk(dep, dir, peerMeta[dep]?.optional === true);
    } else if (peerMeta[dep]?.optional !== true) {
      peerWarnings.push(`${dep} (peer of ${pkg.name ?? relative(ROOT, dir)})`);
    }
  }
}

for (const name of ROOTS) walk(name, ROOT, false);

if (missing.length > 0) {
  console.error('runtime-overlay-closure: unresolved non-optional dependencies:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}
if (peerWarnings.length > 0) {
  console.error('runtime-overlay-closure: unresolvable non-optional peers (skipped):');
  for (const m of peerWarnings) console.error(`  - ${m}`);
}

for (const dir of dirs.sort()) console.log(dir);

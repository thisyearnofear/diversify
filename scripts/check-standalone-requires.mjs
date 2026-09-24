#!/usr/bin/env node
/**
 * check-standalone-requires — post-build guard for the Hetzner deploy.
 *
 * Next.js NFT tracing only includes files it can see statically. Anything
 * reached through a bare `require("pkg")` / `import("pkg")` inside the
 * compiled server chunks — especially packages our dependency audit called
 * "unused" because they load via runtime `new Function('import(specifier)')`
 * tricks — can be absent from `.next/standalone/node_modules` and only fail
 * at runtime on the server (the 0g-storage regression, 2026-09-24).
 *
 * This scans `apps/web/.next/standalone/apps/web/.next/server/**` for bare
 * specifiers and resolves each against the standalone tree (the same
 * node_modules layout the PM2 process runs with). Anything that doesn't
 * resolve fails the deploy BEFORE rsync ships a broken bundle.
 *
 * Skips: node builtins, `node:` specifiers, relative/absolute paths, and
 * the AI Gateway overlay set the deploy script copies in afterwards.
 *
 * Usage: node scripts/check-standalone-requires.mjs
 * Exit: 0 clean, 1 unresolved specifiers listed on stderr.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const STANDALONE = join(ROOT, 'apps/web/.next/standalone');
const SERVER_DIR = join(STANDALONE, 'apps/web/.next/server');

// Packages the deploy overlays into the runtime AFTER this check runs
// (scripts/deploy-to-hetzner.sh — AI Gateway SDK for TypeSafe routes).
// They aren't traced into standalone by design; flagging them would be noise.
const OVERLAY_ALLOWLIST = new Set([
  'ai',
  '@ai-sdk/gateway',
  '@ai-sdk/provider',
  '@ai-sdk/provider-utils',
  '@vercel/oidc',
  '@standard-schema/spec',
  '@workflow/serde',
  'eventsource-parser',
  'json-schema',
  'undici',
  // 0G evidence anchoring — shared-0g loads the SDK via eval('require(...)')
  // so NFT never traces it (the 2026-09-24 production outage). The deploy
  // overlays it; its standalone-missing transitive deps ride along.
  '@0gfoundation/0g-storage-ts-sdk',
  'open-jsonrpc-provider',
  'reconnecting-websocket',
]);

// Optional integrations Next emits as guarded `require()`s (try/catch inside
// the compiled _document chunk) — only loaded when the feature is configured,
// which ours isn't (no nextScriptWorkers / partytown setup).
const OPTIONAL_NEXT_ALLOWLIST = new Set([
  '@builder.io/partytown',
]);

const BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

// Bare specifier only: `pkg`, `pkg/sub`, `@scope/pkg`, `@scope/pkg/sub`.
// Relative/absolute/URL specifiers are never bare.
const REQUIRE_RE = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
const IMPORT_RE = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

function packageName(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return `${scope}/${name}`;
  }
  return specifier.split('/')[0];
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.name.endsWith('.js')) yield p;
  }
}

if (!existsSync(SERVER_DIR)) {
  console.error(`[check-standalone] standalone server output not found: ${SERVER_DIR}`);
  console.error('[check-standalone] run `pnpm build` first.');
  process.exit(1);
}

// Resolution context: ONLY the standalone tree's own node_modules dirs —
// deliberately not Node's ancestor walk (a hoisted copy in the repo root
// would mask a package the rsync doesn't ship). Node resolves from the
// requiring file upward: apps/web/node_modules, then standalone/node_modules,
// then workspace packages/node_modules.
const NM_DIRS = [join(STANDALONE, 'apps/web/node_modules'), join(STANDALONE, 'node_modules')];
const PACKAGES_DIR = join(STANDALONE, 'packages');
if (existsSync(PACKAGES_DIR)) {
  for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) NM_DIRS.push(join(PACKAGES_DIR, entry.name, 'node_modules'));
  }
}

function resolvesInStandalone(pkg) {
  // Directory existence is the check — partially-traced packages may ship
  // without a package.json (Next copies only the files it needs), so a
  // strict require.resolve would false-positive on valid builds.
  return NM_DIRS.some((nm) => existsSync(join(nm, pkg)));
}

const unresolved = new Map(); // specifier -> Set<file>
let files = 0;
let specifiers = 0;

for (const file of walk(SERVER_DIR)) {
  files++;
  const src = readFileSync(file, 'utf8');
  for (const re of [REQUIRE_RE, IMPORT_RE]) {
    for (const match of src.matchAll(re)) {
      const spec = match[1];
      if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) continue;
      if (BUILTINS.has(spec)) continue;
      const pkg = packageName(spec);
      if (OVERLAY_ALLOWLIST.has(pkg) || OVERLAY_ALLOWLIST.has(spec)) continue;
      if (OPTIONAL_NEXT_ALLOWLIST.has(pkg)) continue;
      specifiers++;
      if (!resolvesInStandalone(pkg)) {
        if (!unresolved.has(spec)) unresolved.set(spec, new Set());
        unresolved.get(spec).add(file.replace(`${ROOT}/`, ''));
      }
    }
  }
}

console.log(`[check-standalone] scanned ${files} server files, ${specifiers} bare specifiers`);

// Overlay packages must also exist in the ROOT node_modules — the deploy
// rsyncs them from there; a removed dependency otherwise sails through the
// allowlist and the overlay warns-but-ships-nothing (same outage class).
const missingOverlay = [...OVERLAY_ALLOWLIST].filter(
  (pkg) => !existsSync(join(ROOT, 'node_modules', pkg)),
);
for (const pkg of missingOverlay) {
  if (!unresolved.has(pkg)) unresolved.set(pkg, new Set());
  unresolved.get(pkg).add('(deploy overlay — package not installed locally)');
}

if (unresolved.size > 0) {
  console.error(`[check-standalone] FAIL — ${unresolved.size} unresolvable bare specifier(s) in standalone output:`);
  for (const [spec, where] of [...unresolved.entries()].sort()) {
    console.error(`  ${spec}  ← ${[...where].slice(0, 3).join(', ')}${where.size > 3 ? ` (+${where.size - 3} more)` : ''}`);
  }
  console.error('[check-standalone] restore the package as an apps/web dependency, or add it to the deploy overlay allowlist if it is synced post-build.');
  process.exit(1);
}

console.log('[check-standalone] OK — every bare specifier resolves from the standalone tree');

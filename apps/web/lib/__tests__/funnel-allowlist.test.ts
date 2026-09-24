/**
 * Funnel allowlist tripwire — every trackFunnelEvent string literal fired
 * anywhere in the app must be in FUNNEL_EVENTS, or the sink silently drops
 * it. lens_offered / intent_handoff / handoff_settled shipped client-side
 * while missing from the allowlist; this scan makes that class of bug a
 * build failure instead of a quiet data gap.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FUNNEL_EVENTS } from '../../models/FunnelEvent';

const WEB_ROOT = join(__dirname, '../..');
const SCAN_DIRS = ['components', 'hooks', 'lib', 'pages', 'context'];
const EVENT_RE = /trackFunnelEvent\(\s*['"]([^'"]+)['"]/g;

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(name)) {
      yield path;
    }
  }
}

describe('FUNNEL_EVENTS allowlist', () => {
  it('covers every trackFunnelEvent literal fired in the app', () => {
    const missing: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(join(WEB_ROOT, dir))) {
        const src = readFileSync(file, 'utf8');
        for (const match of src.matchAll(EVENT_RE)) {
          const event = match[1];
          if (!(FUNNEL_EVENTS as readonly string[]).includes(event)) {
            missing.push(`${event} (${file.replace(WEB_ROOT, 'apps/web')})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});

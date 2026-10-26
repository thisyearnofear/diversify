// @vitest-environment node

/**
 * Every client-side API call must go through `apiUrl()`.
 *
 * The API lives on the Hetzner runtime, not on Vercel. A relative
 * `/api/...` fetch is a request to the *page* origin — which, for an API
 * route, is a Vercel lambda. That split is what put ~85 routes on
 * serverless compute: the client asked the page origin for some routes and
 * the runtime for others, and the lambdas kept serving the first set.
 *
 * `next.config.js` also rewrites `/api/*` to the runtime on Vercel (a
 * `beforeFiles` rewrite, so the filesystem can never win), but the client
 * should not depend on that hop — the rewrite is a backstop for routes the
 * client still calls relatively, not the intended path.
 *
 * This test reads the source, because the failure mode is a *string* in a
 * call, not a behaviour a unit test can observe.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOTS = ['apps/web/components', 'apps/web/hooks', 'apps/web/lib', 'apps/web/context'];
const SKIP_DIRS = new Set(['__tests__', 'node_modules']);

/** Files that legitimately mention an /api path without making a request. */
const EXEMPT = new Set([
  // The helper itself documents the path shape.
  'apps/web/lib/api-url.ts',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

/**
 * A `/api/...` literal that is a request URL. Excluded:
 *   - the Auth0 OAuth redirect_uri — a browser redirect, not an XHR, and
 *     Auth0 has the page origin registered
 *   - `.includes('/api/...')` — a substring test on an already-built URL
 *   - comment lines
 */
const LITERAL = /(['"`])(\/api\/[^'"`\n]*)\1/g;

describe('client API calls target the runtime, not the page origin', () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it('finds client source to scan', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no client source fetches a relative /api path', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const rel = relative(process.cwd(), file);
      if (EXEMPT.has(rel)) continue;

      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\*|\/\/)/.test(line)) return;
        if (/window\.location\.origin\s*\+/.test(line)) return;
        if (/\.includes\(/.test(line)) return;

        const re = new RegExp(LITERAL.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(line))) {
          const before = line.slice(Math.max(0, m.index - 10), m.index);
          if (before.includes('apiUrl(')) continue;
          offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 100)}`);
        }
      });
    }

    expect(
      offenders,
      `Relative /api request literals must go through apiUrl() from '@/lib/api-url'.\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('the helper exists and resolves the API base', async () => {
    const { apiUrl, API_BASE } = await import('@/lib/api-url');
    expect(typeof apiUrl).toBe('function');
    expect(apiUrl('/api/healthz')).toBe(`${API_BASE}/api/healthz`);
    // An absolute URL passes through untouched.
    expect(apiUrl('https://example.com/x')).toBe('https://example.com/x');
  });
});

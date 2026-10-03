import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Stylesheet contracts do not need jsdom or the React rendering graph.
describe('instrument stage CSS', () => {
  it('lets the object grow rather than handing all free space to the status margin', () => {
    const css = readFileSync(resolve(process.cwd(), 'apps/web/styles/globals.css'), 'utf8');
    const objectBlock = /\.instrument-object\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(objectBlock).toMatch(/(^|;)\s*flex:\s*1\s*;/);
    expect(objectBlock).not.toMatch(/flex:\s*0\s+1\s+auto/);
  });
});

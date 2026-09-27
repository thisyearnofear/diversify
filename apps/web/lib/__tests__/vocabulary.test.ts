/**
 * Vocabulary tripwire — one name per concept in user-facing copy.
 *
 * Guardian is the only agent name. Its permission is a "daily limit"; the
 * optional ERC-7715 grant is a "wallet-enforced limit". "Protection plan" is
 * the only plan noun. Retired names (Auto-Saver, Advisor as a product name,
 * "Protection Settings", "Custom Strategy") must not reach string literals.
 *
 * Internal identifiers (askAdvisor, advisor-core, AutonomyLevel) are fine —
 * this only scans quoted strings and JSX text. Logs are skipped. A line that
 * must quote a retired name (e.g. a prompt's "never say X" list) carries
 * `vocabulary-allow`. Source of truth: docs/product.md § Vocabulary.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../../..");
const SCAN_DIRS = [
  "apps/web/components",
  "apps/web/pages",
  "apps/web/hooks",
  "apps/web/lib",
  "apps/web/constants",
  "apps/web/context",
  "packages/shared/src",
];

const RETIRED: Array<{ term: RegExp; use: string }> = [
  { term: /Auto-Saver/, use: '"Guardian" / "daily limit"' },
  { term: /\bDiversiFi Advisor\b|\bthe Advisor\b|\bAdvisor (recommendation|intent|analysis|is)\b/i, use: '"Guardian"' },
  { term: /Protection Settings/, use: '"Notifications & integrations"' },
  { term: /Custom Strategy/, use: '"Custom plan"' },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|stories)\./.test(entry.name)) out.push(full);
  }
  return out;
}

// Quoted strings, template literals, and JSX text between tags.
const STRINGISH = /(['"`])(?:(?!\1)[^\\\n]|\\.)*\1|>[^<>{}\n]+</g;

describe("user-facing vocabulary", () => {
  it("no retired product names reach copy", () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      const abs = path.join(ROOT, dir);
      if (!fs.existsSync(abs)) continue;
      for (const file of walk(abs)) {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
          if (/console\.|logger\.|vocabulary-allow/.test(line)) return;
          for (const chunk of line.match(STRINGISH) ?? []) {
            for (const { term, use } of RETIRED) {
              if (term.test(chunk)) {
                offenders.push(`${path.relative(ROOT, file)}:${i + 1} ${chunk.trim()} → use ${use}`);
              }
            }
          }
        });
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});

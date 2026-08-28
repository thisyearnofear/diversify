import { describe, expect, it } from 'vitest';

/**
 * The Caribbean rail has no separate native chain — it settles savings on the
 * always-on Celo home rail — so its constants are always-live (no "coming soon"
 * branch like the APAC rail). These tests cover the messaging predicate's
 * delegation to the shared profile check and the copy/explorer constants.
 */

async function importCaribbeanRail() {
  return import('../caribbean-rail');
}

describe('caribbean-rail constants', () => {
  it('exposes always-live explanatory copy', async () => {
    const { getCaribbeanRailCopy, CARIBBEAN_RAIL_COPY, CELO_EXPLORER_ADDRESS_URL } =
      await importCaribbeanRail();
    expect(getCaribbeanRailCopy()).toBe(CARIBBEAN_RAIL_COPY);
    expect(CARIBBEAN_RAIL_COPY.title).toContain('Celo');
    // The Caribbean rail settles on Celo, so the verify link is the Celo explorer.
    expect(CELO_EXPLORER_ADDRESS_URL).toMatch(/^https:\/\/celo\.blockscout\.com\/address\/0x/);
  });

  it('gates messaging on the shared Caribbean profile predicate', async () => {
    const { needsCaribbeanRailMessaging } = await importCaribbeanRail();
    expect(needsCaribbeanRailMessaging('pan_caribbean', 'Caribbean')).toBe(true);
    expect(needsCaribbeanRailMessaging('pan_caribbean', 'Africa')).toBe(false);
    expect(needsCaribbeanRailMessaging('africapitalism', 'Caribbean')).toBe(false);
    expect(needsCaribbeanRailMessaging('confucian', 'Caribbean')).toBe(false);
    expect(needsCaribbeanRailMessaging(null, null)).toBe(false);
  });

  it('narrows the verify link to the short ledger address', async () => {
    const { CELO_LEDGER_ADDRESS, CELO_LEDGER_SHORT_ADDRESS } = await importCaribbeanRail();
    expect(CELO_LEDGER_SHORT_ADDRESS).toBe(
      `${CELO_LEDGER_ADDRESS.slice(0, 6)}…${CELO_LEDGER_ADDRESS.slice(-4)}`,
    );
  });
});
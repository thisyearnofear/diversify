import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The APAC rail constants read NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT at
 * module load, so each test resets the module registry and re-imports.
 * Covers the copy swap (honest "coming soon" vs live rail) and the
 * messaging predicate's delegation to the shared profile check.
 */

const LEDGER = '0x' + 'aa'.repeat(20);

async function importApacRail() {
  return import('../apac-rail');
}

describe('apac-rail constants', () => {
  const saved = process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT;
  });

  afterEach(() => {
    if (saved) process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT = saved;
    else delete process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT;
  });

  it('shows honest "coming soon" copy while the rail is not configured', async () => {
    const { isApacRailLive, getApacRailCopy, APAC_RAIL_HONESTY_COPY, HASHKEY_EXPLORER_ADDRESS_URL } =
      await importApacRail();
    expect(isApacRailLive()).toBe(false);
    expect(getApacRailCopy()).toBe(APAC_RAIL_HONESTY_COPY);
    expect(HASHKEY_EXPLORER_ADDRESS_URL).toBe('');
  });

  it('swaps to live-rail copy with an explorer link once configured', async () => {
    process.env.NEXT_PUBLIC_HASHKEY_LEDGER_CONTRACT = LEDGER;
    const { isApacRailLive, getApacRailCopy, APAC_RAIL_LIVE_COPY, HASHKEY_EXPLORER_ADDRESS_URL } =
      await importApacRail();
    expect(isApacRailLive()).toBe(true);
    expect(getApacRailCopy()).toBe(APAC_RAIL_LIVE_COPY);
    expect(HASHKEY_EXPLORER_ADDRESS_URL).toBe(`https://hashkey.blockscout.com/address/${LEDGER}`);
  });

  it('gates messaging on the shared APAC profile predicate', async () => {
    const { needsApacRailMessaging } = await importApacRail();
    expect(needsApacRailMessaging('confucian', 'Asia')).toBe(true);
    expect(needsApacRailMessaging('gotong_royong', 'Asia')).toBe(true);
    expect(needsApacRailMessaging('confucian', 'Africa')).toBe(false);
    expect(needsApacRailMessaging('africapitalism', 'Asia')).toBe(false);
    expect(needsApacRailMessaging(null, null)).toBe(false);
  });
});

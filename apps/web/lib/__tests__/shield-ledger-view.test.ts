import { describe, expect, it } from "vitest";
import {
  LEDGER_OTHER_TOKEN,
  MAX_LEDGER_ARCS,
  ledgerViewFrom,
} from "@/lib/shield-ledger-view";
import type { LedgerRecommendation, ProofFeedData } from "@/hooks/use-proof-feed";

function record(overrides: Partial<LedgerRecommendation>): LedgerRecommendation {
  return {
    id: 1,
    user: "0xuser",
    action: "REBALANCE",
    targetToken: "USDC",
    evidenceCid: "cid",
    servingModel: "model",
    settlementTxHash: "0xabc",
    timestamp: 1_700_000_000,
    confidence: 0.5,
    chainId: 42220,
    ...overrides,
  };
}

function feed(recent: LedgerRecommendation[], total = recent.length): ProofFeedData {
  return {
    stats: {
      totalRecommendations: total,
      contractAddress: "0xledger",
      chainId: 42220,
      isDeployed: true,
    },
    recent,
    capturedAt: new Date().toISOString(),
    explorerBase: "https://explorer",
    contractExplorer: "https://explorer/address/0xledger",
  };
}

const READABLE = { isLoading: false, isStale: false, error: null };

describe("ledgerViewFrom — the ledger as ring material", () => {
  it("counts decisions per token and sizes arcs by share of the window", () => {
    const view = ledgerViewFrom(
      feed([
        record({ id: 1, targetToken: "USDm", timestamp: 30 }),
        record({ id: 2, targetToken: "cUSD", timestamp: 20 }),
        record({ id: 3, targetToken: "BRLm", timestamp: 10 }),
      ]),
      READABLE
    );

    expect(view.state).toBe("ready");
    expect(view.windowCount).toBe(3);
    // cUSD and USDm are the same asset spelled two ways — one arc.
    expect(view.legs.find((l) => l.token === "cUSD")?.count).toBe(2);
    expect(view.legs.find((l) => l.token === "cUSD")?.percent).toBeCloseTo(66.7);
    expect(view.legs.reduce((sum, l) => sum + l.count, 0)).toBe(3);
  });

  it("keeps the newest record per token so a row can be read and checked", () => {
    const view = ledgerViewFrom(
      feed([
        record({ id: 1, targetToken: "USDC", timestamp: 10, action: "HOLD" }),
        record({ id: 2, targetToken: "USDC", timestamp: 99, action: "SWAP" }),
      ]),
      READABLE
    );
    expect(view.legs[0].latest.action).toBe("SWAP");
  });

  it("reads the whole ledger for the hole, not just the window", () => {
    const view = ledgerViewFrom(feed([record({})], 1812), READABLE);
    expect(view.totalDecisions).toBe(1812);
    expect(view.windowCount).toBe(1);
  });

  it("folds the tail into one quiet arc instead of drawing a seventh wedge", () => {
    const many = Array.from({ length: MAX_LEDGER_ARCS + 3 }, (_, i) =>
      record({ id: i, targetToken: `TOK${i}`, timestamp: i })
    );
    const view = ledgerViewFrom(feed(many), READABLE);
    // The cap counts the folded arc: MAX_LEDGER_ARCS rows, never one more.
    expect(view.legs.length).toBe(MAX_LEDGER_ARCS);
    const other = view.legs.find((l) => l.token === LEDGER_OTHER_TOKEN);
    expect(other?.foldedTokens).toBe(4);
    expect(view.legs.reduce((sum, l) => sum + l.count, 0)).toBe(many.length);
  });

  it("never out-rows the plan legend the reading replaces (stage floor, §5)", () => {
    const five = Array.from({ length: 5 }, (_, i) =>
      record({ id: i, targetToken: `TOK${i}`, timestamp: i })
    );
    const view = ledgerViewFrom(feed(five), { ...READABLE, maxLegs: 3 });
    expect(view.legs.length).toBe(3);
    expect(view.legs.at(-1)?.foldedTokens).toBe(3);
    expect(view.legs.reduce((sum, l) => sum + l.count, 0)).toBe(5);
  });

  it("fails closed — no arcs when the feed cannot be read", () => {
    expect(
      ledgerViewFrom(null, { isLoading: true, isStale: false, error: null }).state
    ).toBe("loading");
    expect(
      ledgerViewFrom(null, { isLoading: false, isStale: false, error: "HTTP 500" })
        .state
    ).toBe("unreachable");
    expect(ledgerViewFrom(null, READABLE).state).toBe("empty");
    expect(ledgerViewFrom(feed([]), READABLE).legs).toHaveLength(0);
    // A record with no target names no token — it draws nothing.
    expect(
      ledgerViewFrom(feed([record({ targetToken: "" })]), READABLE).legs
    ).toHaveLength(0);
  });

  it("carries staleness through, so a cached reading says so", () => {
    const view = ledgerViewFrom(feed([record({})]), {
      isLoading: false,
      isStale: true,
      error: null,
    });
    expect(view.isStale).toBe(true);
  });
});

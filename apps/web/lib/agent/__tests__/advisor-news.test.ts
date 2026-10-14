import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearch, mockConfigured } = vi.hoisted(() => ({
  mockSearch: vi.fn(),
  mockConfigured: vi.fn(() => true),
}));

vi.mock("@diversifi/shared/src/services/tavily-search.service", () => ({
  tavilySearch: mockSearch,
  tavilySearchService: { isConfigured: mockConfigured },
}));
vi.mock("@diversifi/shared/src/services/ai/ai-service", () => ({
  AIService: { chat: vi.fn() },
  chatStream: vi.fn(),
  generateChatCompletion: vi.fn(),
  getAdaptiveTokenLimit: () => 512,
}));
vi.mock("@diversifi/shared/src/services/fx-rate.service", () => ({
  getLiveDepreciation: vi.fn(async () => null),
  getLiveRate: vi.fn(async () => null),
}));
vi.mock("@/lib/vault/guardian-state", () => ({ appendDecisionLog: vi.fn() }));

import { buildCurrencyNewsContext } from "../advisor-core";

const RESULTS = {
  results: [
    {
      title: "Central bank holds rates",
      url: "https://example.com/a",
      content: "…",
      source: "Example Wire",
      publishedDate: "2026-10-10",
    },
  ],
};

describe("buildCurrencyNewsContext", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockSearch.mockResolvedValue(RESULTS);
    mockConfigured.mockReturnValue(true);
  });

  it("cites headlines for a news-flavoured question about one currency", async () => {
    const block = await buildCurrencyNewsContext("What is the latest on the naira?");
    expect(block).toContain("RECENT HEADLINES for NGN");
    expect(block).toContain("never predict");
    expect(mockSearch).toHaveBeenCalledTimes(1);
  });

  it("stays silent for questions that are not about recent events", async () => {
    expect(await buildCurrencyNewsContext("Should I hold naira long term?")).toBe("");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("stays silent when the hand-off already carried headlines", async () => {
    const msg = "latest on NGN?\n\nRecent headlines, for context only: 1. x";
    expect(await buildCurrencyNewsContext(msg)).toBe("");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("stays silent when Tavily is unconfigured or fails", async () => {
    mockConfigured.mockReturnValue(false);
    expect(await buildCurrencyNewsContext("latest on the naira?")).toBe("");
    mockConfigured.mockReturnValue(true);
    mockSearch.mockRejectedValue(new Error("down"));
    expect(await buildCurrencyNewsContext("latest on the naira?")).toBe("");
  });

  it("stays silent when no currency is mentioned", async () => {
    expect(await buildCurrencyNewsContext("what is the latest news?")).toBe("");
    expect(mockSearch).not.toHaveBeenCalled();
  });
});

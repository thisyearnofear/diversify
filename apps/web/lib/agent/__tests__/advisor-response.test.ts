import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the AI seam at the shared barrel — advisor-core must never reach a
// real provider; tests only inspect the prompt it builds and the text it
// returns.
const { mockChat, mockChatStream, mockCompletion, mockLiveDep, mockAnalyze } =
  vi.hoisted(() => ({
    mockChat: vi.fn(
      async (_opts: {
        messages: Array<{ role: string; content: string }>;
      }) => ({ content: "ok", provider: "mock", model: "mock-model" }),
    ),
    mockChatStream: vi.fn(),
    mockCompletion: vi.fn(
      async (_opts: { messages: Array<{ role: string; content: string }> }) => ({
        content: JSON.stringify({ action: "HOLD", reasoning: "mock" }),
        provider: "mock",
        model: "mock-model",
      }),
    ),
    mockLiveDep: vi.fn(async () => null as any),
    mockAnalyze: vi.fn(() => ({
      totalValue: 0,
      tokenCount: 0,
      tokens: [],
      regionCount: 0,
      regionalExposure: [],
      weightedInflationRisk: 0,
      diversificationScore: 0,
      concentrationRisk: "low",
      rebalancingOpportunities: [],
      targetAllocations: {},
      projections: { optimizedPath: { purchasingPowerPreserved: 0 } },
    })),
  }));

vi.mock("@diversifi/shared", () => ({
  AIService: { chat: mockChat },
  chatStream: mockChatStream,
  GoodDollarService: {
    createReadOnly: () => ({
      isVerified: async () => false,
      checkClaimEligibility: async () => ({
        canClaim: false,
        alreadyClaimed: false,
        claimAmount: "0",
      }),
    }),
  },
  StrategyService: { getAIPrompt: () => "" },
  generateChatCompletion: mockCompletion,
  analyzePortfolio: mockAnalyze,
  getOnrampSystemPrompt: () => "",
  getAdaptiveTokenLimit: () => 512,
  cogneeMemoryService: {
    getAdvisorContext: async () => "",
    persistInteraction: () => {},
    isAvailable: () => false,
  },
}));

// Never let tests reach the live FX dataset — controlled stubs only.
vi.mock("@diversifi/shared/src/services/fx-rate.service", () => ({
  getLiveDepreciation: mockLiveDep,
}));

import {
  runAdvisorConversation,
  runAdvisorConversationStream,
  runAdvisorAnalysis,
  buildCurrencyFacts,
  formatViewContext,
} from "../advisor-core";

async function drainStream(input: Parameters<typeof runAdvisorConversationStream>[0]) {
  const events: any[] = [];
  for await (const ev of runAdvisorConversationStream(input)) events.push(ev);
  return events;
}

function lastSystemPrompt(mock: typeof mockChat) {
  const call = mock.mock.calls.at(-1);
  return call?.[0].messages.find((m) => m.role === "system")?.content ?? "";
}

beforeEach(() => {
  mockChat.mockClear();
  mockChat.mockResolvedValue({ content: "ok", provider: "mock", model: "mock-model" });
  mockChatStream.mockReset();
  mockCompletion.mockClear();
  mockLiveDep.mockReset();
  mockLiveDep.mockResolvedValue(null);
  mockAnalyze.mockClear();
});

describe("empty-reply fix (action-only responses)", () => {
  it("emits an honest caption when the model replies with only a NAVIGATE marker", async () => {
    mockChat.mockResolvedValueOnce({
      content: "[ACTION:NAVIGATE:exchange]",
      provider: "mock",
      model: "mock-model",
    });
    const result = await runAdvisorConversation({
      message: "I'm in Nigeria with savings in naira. What should I do this month?",
    });
    expect(result.action).toEqual({ type: "navigate", tab: "exchange" });
    expect(result.response.length).toBeGreaterThan(0);
    expect(result.response).toContain("Exchange");
    expect(result.response).not.toContain("[ACTION:");
  });

  it("keeps real text when the model writes an answer plus a marker", async () => {
    mockChat.mockResolvedValueOnce({
      content: "Move some naira savings to USDm. [ACTION:NAVIGATE:exchange]",
      provider: "mock",
      model: "m",
    });
    const result = await runAdvisorConversation({ message: "What should I do?" });
    expect(result.response).toBe("Move some naira savings to USDm.");
    expect(result.action?.type).toBe("navigate");
  });

  it("resolves a hallucinated legacy tab name and still captions it", async () => {
    mockChat.mockResolvedValueOnce({
      content: "[ACTION:NAVIGATE:guardian_setup]",
      provider: "mock",
      model: "m",
    });
    const result = await runAdvisorConversation({ message: "set up guardian" });
    expect(result.action).toEqual({ type: "navigate", tab: "protect" });
    expect(result.response).toContain("Shield");
  });

  it("never returns an empty string even with no action at all", async () => {
    mockChat.mockResolvedValueOnce({ content: "", provider: "mock", model: "m" });
    const result = await runAdvisorConversation({ message: "???", history: [] });
    expect(result.response.length).toBeGreaterThan(0);
    expect(result.action).toBeNull();
  });

  it("streaming path emits a non-empty done.response for a marker-only reply", async () => {
    mockChatStream.mockReturnValueOnce(
      (async function* () {
        yield { type: "chunk", text: "[ACTION:NAVIGATE:exchange]", provider: "mock", model: "m" };
      })(),
    );
    const events = await drainStream({ message: "help me move savings" });
    const done = events.find((e) => e.type === "done");
    expect(done).toBeDefined();
    expect(done.response.length).toBeGreaterThan(0);
    expect(done.action).toEqual({ type: "navigate", tab: "exchange" });
    expect(done.response).toContain("Exchange");
  });
});

describe("FACTS grounding", () => {
  it("detects 'naira'/'Nigeria' and injects live 1yr depreciation + dated events", async () => {
    mockLiveDep.mockResolvedValue({ "1yr": 13.2, "3yr": null, "5yr": null, asOf: "2026-01-15", source: "fawazahmed0" });
    await runAdvisorConversation({
      message: "I'm in Nigeria with savings in naira. What should I do this month?",
    });
    const system = lastSystemPrompt(mockChat);
    expect(system).toContain("FACTS");
    expect(system).toContain("NGN (Nigeria)");
    expect(system).toContain("gained 13.2% vs USD over the last 12 months");
    expect(system).toContain("live mid-market, as of 2026-01-15");
    // Newest dated risk events travel with the block
    expect(system).toMatch(/\d{4} — .+/);
  });

  it("falls back to the labelled curated snapshot when the live feed misses", async () => {
    mockLiveDep.mockResolvedValue(null);
    await runAdvisorConversation({ message: "How is the cedi doing?" });
    const system = lastSystemPrompt(mockChat);
    expect(system).toContain("GHS (Ghana)");
    expect(system).toContain("curated snapshot");
    expect(system).toContain("1yr 7%");
  });

  it("adds no FACTS block when no currency is mentioned", async () => {
    await runAdvisorConversation({ message: "hello there" });
    expect(lastSystemPrompt(mockChat)).not.toContain("FACTS (real data");
    expect(mockLiveDep).not.toHaveBeenCalled();
  });

  it("does not let English words masquerade as ISO codes", async () => {
    const block = await buildCurrencyFacts("I'll try to rub two coins together");
    expect(block).toBe("");
    expect(mockLiveDep).not.toHaveBeenCalled();
  });

  it("buildCurrencyFacts is capped and never fabricates placeholders", async () => {
    mockLiveDep.mockResolvedValue({ "1yr": -10, "3yr": null, "5yr": null, asOf: "2026-01-15", source: "fawazahmed0" });
    const block = await buildCurrencyFacts("naira and cedi and rand vs the dollar");
    expect(block).toContain("FACTS");
    expect(block.split("\n").filter((l) => l.trim()).length).toBeLessThanOrEqual(16);
    expect(block).not.toContain("undefined");
    expect(block).not.toContain("null");
  });
});

describe("view context", () => {
  it("renders a validated tab + pair as 'User is viewing'", async () => {
    await runAdvisorConversation({
      message: "what should I do here?",
      view: { tab: "exchange", pair: { from: "EURm", to: "USDm" } },
    });
    const system = lastSystemPrompt(mockChat);
    expect(system).toContain("USER'S CURRENT VIEW: the Exchange tab · the EURm → USDm pair");
  });

  it("drops hallucinated tabs and unknown symbols", () => {
    expect(formatViewContext({ tab: "definitely-not-a-tab" })).toBe("");
    expect(formatViewContext({ pair: { from: "FAKE", to: "USDm" } })).toBe("");
    expect(formatViewContext(undefined)).toBe("");
    expect(formatViewContext({ tab: 42 } as never)).toBe("");
  });
});

describe("no fabricated defaults (analysis mode)", () => {
  it("marks missing network momentum and market data as unavailable", async () => {
    await runAdvisorAnalysis({ userRegion: "NG" });
    const call = mockCompletion.mock.calls.at(-1);
    const userPrompt = call?.[0].messages.find((m) => m.role === "user")?.content ?? "";
    expect(userPrompt).toContain("unavailable");
    expect(userPrompt).not.toContain("84 users");
    expect(userPrompt).not.toContain("$1.2M");
    expect(userPrompt).not.toContain("1.25");
    // '3.2%' phantom inflation and '4.5%' phantom treasury must be gone too
    expect(userPrompt).not.toContain("3.2%");
    expect(userPrompt).not.toContain("4.5%");
  });
});

describe("response logging", () => {
  it("logs provider/model/ms/hadAction/chars at info level — no message text", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockChat.mockResolvedValueOnce({
      content: "Here is the answer. [ACTION:HOLD]",
      provider: "mock-provider",
      model: "mock-model",
    });
    await runAdvisorConversation({ message: "status?" });
    const entry = spy.mock.calls.find((c) => c[0] === "[Advisor] response");
    expect(entry).toBeDefined();
    const meta = entry![1] as Record<string, unknown>;
    expect(meta.provider).toBe("mock-provider");
    expect(meta.model).toBe("mock-model");
    expect(typeof meta.ms).toBe("number");
    expect(meta.hadAction).toBe(true);
    expect(typeof meta.chars).toBe("number");
    expect(JSON.stringify(meta)).not.toContain("Here is the answer");
    spy.mockRestore();
  });

  it("logs the stream path the same way", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    mockChatStream.mockReturnValueOnce(
      (async function* () {
        yield { type: "chunk", text: "hi", provider: "stream-p", model: "sm" };
      })(),
    );
    await drainStream({ message: "hi" });
    const entry = spy.mock.calls.find((c) => c[0] === "[Advisor] response");
    expect(entry).toBeDefined();
    expect((entry![1] as any).provider).toBe("stream-p");
    spy.mockRestore();
  });
});

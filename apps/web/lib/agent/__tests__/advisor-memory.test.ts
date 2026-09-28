/**
 * Advisor opt-in memory tests.
 *
 * Pins the security contract: cloud memory is keyed ONLY by the
 * signature-verified address (`verifiedAddress`, set by the API route via
 * requireWalletAuth) — never the unauthenticated body `address`. Off means
 * no recall and no writes; device facts arrive on the request and are
 * sanitised server-side before entering the prompt.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockChat, mockChatStream, mockProvider } = vi.hoisted(() => ({
  mockChat: vi.fn(
    async (_opts: { messages: Array<{ role: string; content: string }> }) => ({
      content: "ok",
      provider: "mock",
      model: "mock-model",
    }),
  ),
  mockChatStream: vi.fn(),
  mockProvider: {
    id: 'cognee' as const,
    location: 'Cognee — stored in the USA (AWS)',
    isAvailable: vi.fn(() => true),
    list: vi.fn(async () => [] as Array<{ id: string; text: string; createdAt: string }>),
    add: vi.fn(async () => []),
    remove: vi.fn(async () => true),
    forget: vi.fn(async () => true),
  },
}));

const mockPersistInteraction = vi.hoisted(() => vi.fn());

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
  generateChatCompletion: vi.fn(async () => ({
    content: JSON.stringify({ action: "HOLD", reasoning: "mock" }),
    provider: "mock",
    model: "mock-model",
  })),
  analyzePortfolio: vi.fn(() => ({
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
  getOnrampSystemPrompt: () => "",
  getAdaptiveTokenLimit: () => 512,
  cogneeMemoryService: {
    getAdvisorContext: async () => "",
    persistInteraction: mockPersistInteraction,
    isAvailable: () => false,
  },
  guardianMemoryService: {
    providerFor: (id: unknown) => (id === 'cognee' ? mockProvider : null),
    listAvailableProviders: () => [],
    providers: [mockProvider],
  },
}));

vi.mock("@diversifi/shared/src/services/fx-rate.service", () => ({
  getLiveDepreciation: vi.fn(async () => null),
}));

import {
  runAdvisorConversation,
  runAdvisorConversationStream,
} from "../advisor-core";

const VERIFIED = "0xverified000000000000000000000000000000000001";
const BODY_ADDR = "0xbodyaddress000000000000000000000000000002";

function systemPrompt(): string {
  const call = mockChat.mock.calls[0]?.[0] as
    | { messages: Array<{ role: string; content: string }> }
    | undefined;
  return call?.messages.find((m) => m.role === "system")?.content ?? "";
}

beforeEach(() => {
  vi.clearAllMocks();
  mockProvider.isAvailable.mockReturnValue(true);
  mockProvider.list.mockResolvedValue([]);
});

describe("device mode", () => {
  it("injects sanitised facts in a delimited section", async () => {
    const result = await runAdvisorConversation({
      message: "hi",
      memory: {
        mode: "device",
        facts: ["  you\tpay a supplier\nin USD  ", "x".repeat(200), 42, ""],
      },
    });
    const prompt = systemPrompt();
    expect(prompt).toContain("FACTS THE USER ASKED GUARDIAN TO REMEMBER");
    expect(prompt).toContain("you pay a supplier in USD");
    // Sanitised: capped at 140 chars, non-strings and empties dropped.
    expect(prompt).toContain(`- ${"x".repeat(140)}`);
    expect(prompt).not.toContain("- 42");
    expect(result.memoryEnabled).toBe(true);
    expect(mockProvider.list).not.toHaveBeenCalled();
  });

  it("works without a wallet — device facts live client-side", async () => {
    const result = await runAdvisorConversation({
      message: "hi",
      memory: { mode: "device", facts: ["You save in KES"] },
    });
    expect(result.memoryEnabled).toBe(true);
    expect(result.memoryStatus).toBeUndefined();
  });
});

describe("cloud mode", () => {
  it("never recalls from a body address alone — auth_required, no provider call", async () => {
    const result = await runAdvisorConversation({
      message: "hi",
      address: BODY_ADDR,
      memory: { mode: "cloud", provider: "cognee" },
    });
    expect(result.memoryStatus).toBe("auth_required");
    expect(result.memoryEnabled).toBe(false);
    expect(mockProvider.list).not.toHaveBeenCalled();
    expect(systemPrompt()).not.toContain("FACTS THE USER ASKED");
  });

  it("recalls from the verified address and injects the section", async () => {
    mockProvider.list.mockResolvedValue([
      { id: "f1", text: "You pay a supplier in USD monthly", createdAt: new Date().toISOString() },
    ]);
    const result = await runAdvisorConversation({
      message: "hi",
      address: BODY_ADDR,
      verifiedAddress: VERIFIED,
      memory: { mode: "cloud", provider: "cognee" },
    });
    expect(mockProvider.list).toHaveBeenCalledWith(VERIFIED);
    expect(systemPrompt()).toContain("You pay a supplier in USD monthly");
    expect(result.memoryEnabled).toBe(true);
  });

  it("fails soft when the provider is unavailable", async () => {
    mockProvider.isAvailable.mockReturnValue(false);
    const result = await runAdvisorConversation({
      message: "hi",
      verifiedAddress: VERIFIED,
      memory: { mode: "cloud", provider: "cognee" },
    });
    expect(result.memoryEnabled).toBe(false);
    expect(mockProvider.list).not.toHaveBeenCalled();
  });
});

describe("off mode", () => {
  it("makes no memory calls and injects nothing", async () => {
    const result = await runAdvisorConversation({
      message: "hi",
      memory: { mode: "off", facts: ["should not appear"] },
    });
    expect(result.memoryEnabled).toBe(false);
    expect(mockProvider.list).not.toHaveBeenCalled();
    expect(systemPrompt()).not.toContain("FACTS THE USER ASKED");
  });
});

describe("no implicit writes", () => {
  it("persistInteraction is never called — memory is consent-only", async () => {
    await runAdvisorConversation({ message: "hi", memory: { mode: "device", facts: ["f"] } });
    expect(mockPersistInteraction).not.toHaveBeenCalled();
  });

  it("the streaming path carries memoryStatus and also never persists", async () => {
    mockChatStream.mockImplementation(async function* () {
      yield { type: "content", content: "streamed answer" };
    });
    const events: any[] = [];
    for await (const ev of runAdvisorConversationStream({
      message: "hi",
      address: BODY_ADDR,
      memory: { mode: "cloud", provider: "cognee" },
    })) {
      events.push(ev);
    }
    const done = events.find((e) => e.type === "done");
    expect(done?.memoryStatus).toBe("auth_required");
    expect(mockProvider.list).not.toHaveBeenCalled();
    expect(mockPersistInteraction).not.toHaveBeenCalled();
  });
});

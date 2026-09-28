import { describe, expect, it } from "vitest";
import {
  celoExecutionTarget,
  resolveTargetChainId,
  withValidatedTargetChain,
} from "../target-chain";

const CELO = 42220;
const ARBITRUM = 42161;

describe("resolveTargetChainId", () => {
  it("infers the rail a token lives on", () => {
    expect(resolveTargetChainId("PAXG")).toBe(ARBITRUM);
    expect(resolveTargetChainId("USDC")).toBe(ARBITRUM);
    expect(resolveTargetChainId("KESm")).toBe(CELO);
    expect(resolveTargetChainId("cEUR")).toBe(CELO);
  });

  it("accepts a requested chain only when the token is on it", () => {
    expect(resolveTargetChainId("PAXG", ARBITRUM)).toBe(ARBITRUM);
    expect(resolveTargetChainId("PAXG", CELO)).toBeNull();
    expect(resolveTargetChainId("EURm", 999999)).toBeNull();
  });

  it("returns null for tokens no executable rail holds", () => {
    expect(resolveTargetChainId("GOLD")).toBeNull();
    expect(resolveTargetChainId(undefined)).toBeNull();
  });
});

describe("celoExecutionTarget", () => {
  it("maps Celo targets to the executor's symbol", () => {
    expect(celoExecutionTarget("cEUR")).toBe("cEUR");
    expect(celoExecutionTarget("EURm")).toBe("cEUR");
    expect(celoExecutionTarget("KESm", CELO)).toBe("KESm");
  });

  it("rejects non-Celo targets instead of coercing them", () => {
    expect(celoExecutionTarget("PAXG")).toBeNull();
    expect(celoExecutionTarget("cEUR", ARBITRUM)).toBeNull();
    expect(celoExecutionTarget(undefined)).toBeNull();
  });
});

describe("withValidatedTargetChain", () => {
  it("fills a missing chain from the token's rail", () => {
    expect(
      withValidatedTargetChain({ action: "SWAP", targetToken: "PAXG" }).targetChainId,
    ).toBe(ARBITRUM);
  });

  it("keeps a valid model-supplied chain (numeric strings included)", () => {
    const advice = withValidatedTargetChain({
      action: "SWAP",
      targetToken: "PAXG",
      targetChainId: "42161",
    });
    expect(advice.targetChainId).toBe(ARBITRUM);
    expect(advice.contract).toBeUndefined();
  });

  it("turns an impossible token/chain pair into observation-only", () => {
    const advice = withValidatedTargetChain({
      action: "SWAP",
      targetToken: "PAXG",
      targetChainId: CELO,
    });
    expect(advice.targetChainId).toBeUndefined();
    expect(advice.contract?.action).toEqual({ type: "observation_only" });
  });

  it("turns a token on no rail into observation-only", () => {
    const advice = withValidatedTargetChain({ action: "BUY", targetToken: "GOLD" });
    expect(advice.contract?.action).toEqual({ type: "observation_only" });
  });

  it("leaves HOLD advice without a chain", () => {
    const advice = withValidatedTargetChain({
      action: "HOLD",
      targetToken: "PAXG",
      targetChainId: CELO,
    });
    expect(advice.targetChainId).toBeUndefined();
    expect(advice.contract).toBeUndefined();
  });
});

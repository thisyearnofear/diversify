import React from "react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VerifiedEvidence } from "../VerifiedEvidence";

vi.mock("framer-motion", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useReducedMotion: () => true,
    motion: {
      div: Passthrough,
      span: ({ children }: { children?: React.ReactNode }) => (
        <span>{children}</span>
      ),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

// The verdict reads the shared proof feed; the check reads the RPC endpoint.
// Both are stubbed so the test states exactly what the ledger is saying.
const TX_HASH = "0x" + "ab".repeat(32);
let feed: any = { data: null, isLoading: false, isStale: false, error: null };
let chainStatus: Record<string, string> = {};

vi.mock("@/hooks/use-proof-feed", () => ({
  useProofFeed: () => feed,
}));
vi.mock("@/hooks/use-verify-tx", () => ({
  useVerifiedTxs: () => chainStatus,
}));
vi.mock("@/hooks/use-count-up", () => ({
  useCountUp: (n: number) => n.toLocaleString(),
}));

const RECORD = {
  id: 41,
  chainId: 42161,
  action: "REBALANCE",
  targetToken: "USDm",
  settlementTxHash: TX_HASH,
  timestamp: Math.floor(Date.now() / 1000) - 3 * 86400,
  confidence: 0.7,
  user: "0xuser",
  evidenceCid: "",
  servingModel: "",
};

const loadedFeed = {
  data: {
    stats: { totalRecommendations: 1204, chainId: 42161, chainIds: [42161, 42220], contractAddress: "0x3BCf", isDeployed: true },
    recent: [RECORD],
    capturedAt: new Date().toISOString(),
    explorerBase: "https://arbi-scan.example/tx",
    contractExplorer: "https://arbi-scan.example/address/0x3BCf",
  },
  isLoading: false,
  isStale: false,
  error: null,
};

const verifyOk = {
  verified: true,
  found: true,
  status: 1,
  explorerUrl: "https://chainscan.0g.ai/tx/" + TX_HASH,
  chainId: 16661,
};

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

function openVerifier() {
  fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
}

function openCheck() {
  openVerifier();
  fireEvent.click(screen.getByRole("button", { name: /check a receipt/i }));
}

function openDetail() {
  openVerifier();
  fireEvent.click(screen.getByRole("button", { name: /technical detail/i }));
}

beforeEach(() => {
  feed = { data: null, isLoading: false, isStale: false, error: null };
  chainStatus = {};
});

describe("VerifiedEvidence — the verdict layer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on what the ledger actually says, with no hex in sight", () => {
    feed = loadedFeed;
    render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByTestId("verifier-verdict")).toBeInTheDocument();
    expect(screen.getByText("1,204")).toBeInTheDocument();
    expect(screen.getByText(/decisions on one shared ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/rebalance → usdm/i)).toBeInTheDocument();
    expect(screen.queryByText(/0x3BCf/)).not.toBeInTheDocument();
    // §7: chain names belong to the technical layer, not the first view.
    expect(screen.queryByText(/arbitrum/i)).not.toBeInTheDocument();
  });

  it("claims Verified only when the chain's own RPC attests the receipt", () => {
    feed = loadedFeed;
    const { rerender } = render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByText(/the guardian’s last public record/i)).toBeInTheDocument();
    expect(screen.queryByText(/^verified on the chain/i)).not.toBeInTheDocument();
    chainStatus = { "42161-41": "verified" };
    rerender(<VerifiedEvidence />);
    expect(screen.getByText(/verified on the chain/i)).toBeInTheDocument();
  });

  it("says so plainly when the chain has not confirmed the record", () => {
    feed = loadedFeed;
    chainStatus = { "42161-41": "unverified" };
    render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByText(/the chain hasn’t confirmed this receipt/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified on the chain/i)).not.toBeInTheDocument();
  });

  it("renders an empty ledger honestly", () => {
    feed = {
      ...loadedFeed,
      data: { ...loadedFeed.data, stats: { ...loadedFeed.data.stats, totalRecommendations: 0 }, recent: [] },
    };
    render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByText(/nothing has settled on the ledger yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/decisions on one shared ledger/i)).not.toBeInTheDocument();
  });

  it("renders nothing claimed when the feed is unreachable", () => {
    feed = { data: null, isLoading: false, isStale: false, error: new Error("down") };
    render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByText(/isn.t reachable right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it("discloses a stale read instead of presenting it as live", () => {
    feed = { ...loadedFeed, isStale: true };
    render(<VerifiedEvidence />);
    openVerifier();
    expect(screen.getByRole("status")).toHaveTextContent(/last read, not a fresh one/i);
  });

  it("keeps hex and chain names behind the technical detail door", () => {
    feed = loadedFeed;
    render(<VerifiedEvidence />);
    openDetail();
    expect(screen.getByTestId("verifier-detail")).toBeInTheDocument();
    expect(screen.getAllByText(/0x3BCf/).length).toBeGreaterThan(0);
    expect(screen.getByText(/same ledger/i)).toBeInTheDocument();
    expect(screen.getByText(/guardian #1/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /← verdict/i }));
    expect(screen.queryByText(/0x3BCf/)).not.toBeInTheDocument();
  });
});

describe("VerifiedEvidence — the check layer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("arrives prefilled with the newest record and its chain", () => {
    feed = loadedFeed;
    render(<VerifiedEvidence />);
    openCheck();
    expect(screen.getByLabelText(/transaction hash/i)).toHaveValue(TX_HASH);
    expect(screen.getByLabelText(/ledger network/i)).toHaveValue("42161");
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeEnabled();
  });

  it("falls back to an empty field and the default network with no feed", () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    openCheck();
    expect(screen.getByLabelText(/transaction hash/i)).toHaveValue("");
    expect(screen.getByLabelText(/ledger network/i)).toHaveValue("42161");
    const verifyButton = screen.getByRole("button", { name: /^verify$/i });
    expect(verifyButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: "0x1234" },
    });
    expect(verifyButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    expect(verifyButton).toBeEnabled();
  });

  it("verifies the prefilled hash in one tap", async () => {
    feed = loadedFeed;
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    openCheck();
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/agent/zero-g-ledger?verify=${TX_HASH}&chainId=42161`),
    );
    expect(screen.getByRole("link", { name: /explorer/i })).toHaveAttribute(
      "href",
      verifyOk.explorerUrl,
    );
  });

  it("reports honestly when the hash doesn't settle to the ledger", async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...verifyOk, verified: false }), { status: 200 }),
      ),
    );
    render(<VerifiedEvidence />);
    openCheck();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/didn't settle to the ledger/i),
    );
  });

  it("passes the explicitly chosen network to the check — Arc included", async () => {
    mockFetch((input) => {
      const url = String(input);
      const requested = Number(new URL(url, "http://x").searchParams.get("chainId"));
      return Promise.resolve(
        new Response(JSON.stringify({ ...verifyOk, chainId: requested }), { status: 200 }),
      );
    });
    render(<VerifiedEvidence />);
    openCheck();
    const select = screen.getByLabelText(/ledger network/i);
    fireEvent.change(select, { target: { value: "5042" } });
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`verify=${TX_HASH}&chainId=5042`),
    );

    for (const chainId of ["42220", "16661", "177", "4663"]) {
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();
      fireEvent.change(select, { target: { value: chainId } });
      fireEvent.change(screen.getByLabelText(/transaction hash/i), {
        target: { value: TX_HASH },
      });
      fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
      );
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`&chainId=${chainId}`));
    }
  });

  it("clears a confirmed result when the network changes", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    openCheck();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
    fireEvent.change(screen.getByLabelText(/ledger network/i), { target: { value: "16661" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores a stale response after the network changed mid-flight", async () => {
    let resolveFirst!: (r: Response) => void;
    mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    render(<VerifiedEvidence />);
    openCheck();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    fireEvent.change(screen.getByLabelText(/ledger network/i), { target: { value: "5042" } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolveFirst(new Response(JSON.stringify(verifyOk), { status: 200 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("&chainId=5042")),
    );
  });

  it("ignores a stale response after the hash changed mid-flight", async () => {
    const otherHash = "0x" + "cd".repeat(32);
    let resolveFirst!: (r: Response) => void;
    mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    render(<VerifiedEvidence />);
    openCheck();
    const input = screen.getByLabelText(/transaction hash/i);
    fireEvent.change(input, { target: { value: TX_HASH } });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    fireEvent.change(input, { target: { value: otherHash } });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolveFirst(new Response(JSON.stringify(verifyOk), { status: 200 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining(`verify=${otherHash}`),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
  });

  it("shows an error state when the verification service is unreachable", async () => {
    mockFetch(() => Promise.reject(new Error("network down")));
    render(<VerifiedEvidence />);
    openCheck();
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach/i),
    );
  });

  it("folds back to the verdict — the layers are modes, not a stack", () => {
    feed = loadedFeed;
    render(<VerifiedEvidence />);
    openCheck();
    expect(screen.getByTestId("verifier-check")).toBeInTheDocument();
    expect(screen.queryByTestId("verifier-verdict")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /← verdict/i }));
    expect(screen.getByTestId("verifier-verdict")).toBeInTheDocument();
    expect(screen.queryByTestId("verifier-check")).not.toBeInTheDocument();
  });
});

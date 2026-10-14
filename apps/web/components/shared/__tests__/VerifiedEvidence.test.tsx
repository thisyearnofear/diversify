import React from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VerifiedEvidence } from "../VerifiedEvidence";

vi.mock("framer-motion", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    useReducedMotion: () => true,
    motion: { div: Passthrough },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

const TX_HASH = "0x" + "ab".repeat(32);

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

describe("VerifiedEvidence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the quiet trust line with no hex in the collapsed default", () => {
    render(<VerifiedEvidence />);
    const toggle = screen.getByRole("button", { name: /verify evidence/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // No hex anywhere until the user asks for it (§7: no hex in first viewport).
    expect(screen.queryByText(/0x3BCf/)).not.toBeInTheDocument();
  });

  it("expands in place to chain dots, ledger address, and Guardian #1", () => {
    render(<VerifiedEvidence />);
    const toggle = screen.getByRole("button", { name: /verify evidence/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/same ledger/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0x3BCf/).length).toBeGreaterThan(0);
    expect(screen.getByText(/guardian #1/i)).toBeInTheDocument();
  });

  it("keeps the verify button disabled until the hash looks like a tx hash", () => {
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
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

  it("verifies a hash against the RPC-backed endpoint and reports confirmation", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/agent/zero-g-ledger?verify=${TX_HASH}`),
    );
    const explorerLink = screen.getByRole("link", { name: /explorer/i });
    expect(explorerLink).toHaveAttribute("href", verifyOk.explorerUrl);
  });

  it("reports honestly when the hash doesn't settle to the ledger", async () => {
    mockFetch(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...verifyOk, verified: false }), {
          status: 200,
        }),
      ),
    );
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/didn't settle to the ledger/i),
    );
  });

  it("passes the explicitly chosen network to the verify check — Arc included", async () => {
    mockFetch((input) => {
      const url = String(input);
      const requested = Number(new URL(url, "http://x").searchParams.get("chainId"));
      return Promise.resolve(
        new Response(
          JSON.stringify({ ...verifyOk, chainId: requested }),
          { status: 200 },
        ),
      );
    });
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
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
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`&chainId=${chainId}`),
      );
    }
  });

  it("defaults the network to Arbitrum (42161)", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    expect(screen.getByLabelText(/ledger network/i)).toHaveValue("42161");
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("&chainId=42161"),
      ),
    );
  });

  it("clears a confirmed result when the network changes", async () => {
    mockFetch(() =>
      Promise.resolve(new Response(JSON.stringify(verifyOk), { status: 200 })),
    );
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/confirmed on-chain/i),
    );
    fireEvent.change(screen.getByLabelText(/ledger network/i), {
      target: { value: "16661" },
    });
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
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    fireEvent.change(screen.getByLabelText(/ledger network/i), {
      target: { value: "5042" },
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    resolveFirst(new Response(JSON.stringify(verifyOk), { status: 200 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("&chainId=5042"),
      ),
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
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /verify evidence/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach/i),
    );
  });
});

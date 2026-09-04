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
    const toggle = screen.getByRole("button", { name: /verified/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // No hex anywhere until the user asks for it (§7: no hex in first viewport).
    expect(screen.queryByText(/0x3BCf/)).not.toBeInTheDocument();
  });

  it("expands in place to chain dots, ledger address, and Guardian #1", () => {
    render(<VerifiedEvidence />);
    const toggle = screen.getByRole("button", { name: /verified/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/same ledger/i)).toBeInTheDocument();
    expect(screen.getAllByText(/0x3BCf/).length).toBeGreaterThan(0);
    expect(screen.getByText(/guardian #1/i)).toBeInTheDocument();
  });

  it("keeps the verify button disabled until the hash looks like a tx hash", () => {
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verified/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /verified/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /verified/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/didn't settle to the ledger/i),
    );
  });

  it("shows an error state when the verification service is unreachable", async () => {
    mockFetch(() => Promise.reject(new Error("network down")));
    render(<VerifiedEvidence />);
    fireEvent.click(screen.getByRole("button", { name: /verified/i }));
    fireEvent.change(screen.getByLabelText(/transaction hash/i), {
      target: { value: TX_HASH },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/couldn't reach/i),
    );
  });
});

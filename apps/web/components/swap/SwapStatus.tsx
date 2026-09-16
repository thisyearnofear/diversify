import React from "react";
import { NETWORKS } from "../../config";
import RiveNetPair from "../shared/RiveNetPair";
import { codeCoinTint } from "../shared/palette";
import type { SwapErrorClass } from "@diversifi/shared/src/services/swap/strategies/base-swap.strategy";

interface SwapStatusProps {
    status: "idle" | "approving" | "swapping" | "completed" | "error";
    error: string | null;
    errorClass?: SwapErrorClass | null;
    txHash: string | null;
    fromChainId: number;
    /** The pair in flight — the two coins converge while the tx confirms. */
    fromToken?: string;
    toToken?: string;
    /** Recovery offer: hub symbol (e.g. USDm) + handler refills the ticket. */
    viaHubSymbol?: string | null;
    onViaHub?: () => void;
}

const EXPLORER_BY_CHAIN: Record<number, string> = Object.fromEntries(
    Object.values(NETWORKS).map((n) => [n.chainId, n.explorerUrl]),
);

function explorerTxUrl(chainId: number, txHash: string): string {
    const base = EXPLORER_BY_CHAIN[chainId] ?? NETWORKS.CELO_MAINNET.explorerUrl;
    return `${base}/tx/${txHash}`;
}

/** Per-class title/body — the number/line carries the meaning (§6). */
function errorCopy(
    errorClass: SwapErrorClass | null | undefined,
    error: string | null,
): { title: string; body: string } {
    switch (errorClass) {
        case "onchain-failed":
            return {
                title: "Route failed on-chain",
                body: "Your tokens never left your wallet — only the network fee was spent.",
            };
        case "no-route":
            return {
                title: "No route for this amount",
                body: "Try a larger amount, or route through USDm below.",
            };
        case "session":
            return {
                title: "Wallet session expired",
                body: "Reconnect your wallet and try again.",
            };
        case "no-gas":
            return {
                title: "Not enough for network fees",
                body: error || "You need a little of the chain's native token for gas.",
            };
        default:
            return {
                title: "Transaction needs attention",
                body: error || "Something went wrong while trying to protect your savings",
            };
    }
}

const SwapStatus: React.FC<SwapStatusProps> = ({
    status,
    error,
    errorClass,
    txHash,
    fromChainId,
    fromToken,
    toToken,
    viaHubSymbol,
    onViaHub,
}) => {
    if (status === "idle" || status === "completed") return null;

    const inFlight = status === "approving" || status === "swapping";
    const copy = errorCopy(errorClass, error);

    return (
        <section
            aria-live="polite"
            aria-atomic="true"
            className={`rounded-2xl border p-4 shadow-sm ${status === "error"
                ? "border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                : "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200"
                }`}
        >
            {/* The pair object IS the wait — the two coins converge while
                the transaction is out. Reduced motion renders the static
                linked pair; completion is the success modal's minted coin. */}
            {inFlight && fromToken && toToken && (
                <div data-testid="swap-pair-wait" className="mb-3 flex justify-center">
                    <RiveNetPair
                        size={120}
                        leftColor={codeCoinTint(fromToken)}
                        rightColor={codeCoinTint(toToken)}
                    />
                </div>
            )}
            <div className="flex items-start gap-3">
                {status === "approving" && (
                    <>
                        <svg
                            className="mt-0.5 size-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-bold">Preparing your route</p>
                            <p className="mt-1 text-sm leading-6 opacity-90">
                                Reviewing approvals and building the transaction request.
                            </p>
                        </div>
                    </>
                )}

                {status === "swapping" && (
                    <>
                        <svg
                            className="mt-0.5 size-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-bold">Transaction in progress</p>
                            <p className="mt-1 text-sm leading-6 opacity-90">
                                Confirming the swap or deposit onchain. Keep this screen open until confirmation.
                            </p>
                        </div>
                    </>
                )}

                {status === "error" && (
                    <>
                        <svg
                            className="mt-0.5 size-4"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 10-1.414-1.414L11.414 10l1.293 1.293a1 1 0 001.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-bold">{copy.title}</p>
                            <p className="mt-1 text-sm leading-6">
                                {copy.body}
                            </p>
                            {error && error !== copy.body && (
                                <p className="mt-1 text-xs leading-5 opacity-75">{error}</p>
                            )}
                            {viaHubSymbol && onViaHub && (
                                <button
                                    type="button"
                                    onClick={onViaHub}
                                    data-testid="via-hub-action"
                                    className="mt-2 inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 dark:bg-gray-900 dark:text-emerald-300 dark:hover:bg-gray-800"
                                >
                                    Route via {viaHubSymbol} instead →
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {txHash && (
                <div className="mt-4 border-t border-current/10 pt-4 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            Transaction ID:
                        </span>
                        <button
                            onClick={(e) => {
                                navigator.clipboard.writeText(txHash);
                                // Brief inline feedback instead of alert()
                                const btn = e.currentTarget;
                                const orig = btn.textContent;
                                btn.textContent = 'Copied!';
                                setTimeout(() => { btn.textContent = orig; }, 1500);
                            }}
                            className="rounded-md bg-white px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                            title="Copy to clipboard"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="flex items-center">
                        <code className="w-full overflow-hidden rounded bg-white px-2 py-1 text-xs font-mono text-gray-800 text-ellipsis dark:bg-gray-900 dark:text-gray-200">
                            {txHash}
                        </code>
                    </div>
                    <div className="mt-2">
                        <a
                            href={explorerTxUrl(fromChainId, txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-sky-700 hover:underline dark:bg-gray-900 dark:text-sky-300"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="size-4 mr-1"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                            </svg>
                            View on Explorer
                        </a>
                    </div>
                </div>
            )}
        </section>
    );
};

export default SwapStatus;

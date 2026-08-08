import React from "react";
import { NETWORKS } from "../../config";

interface SwapStatusProps {
    status: "idle" | "approving" | "swapping" | "completed" | "error";
    error: string | null;
    txHash: string | null;
    fromChainId: number;
}

const SwapStatus: React.FC<SwapStatusProps> = ({
    status,
    error,
    txHash,
    fromChainId,
}) => {
    if (status === "idle" || status === "completed") return null;

    return (
        <section
            aria-live="polite"
            aria-atomic="true"
            className={`rounded-2xl border p-4 shadow-sm ${status === "error"
                ? "border-red-200 bg-red-50/80 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200"
                : "border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200"
                }`}
        >
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
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <div>
                            <p className="text-sm font-bold">Transaction needs attention</p>
                            <p className="mt-1 text-sm leading-6">
                                {error || "Something went wrong while trying to protect your savings"}
                            </p>
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
                            href={
                                fromChainId === NETWORKS.CELO_SEPOLIA.chainId
                                    ? `${NETWORKS.CELO_SEPOLIA.explorerUrl}/tx/${txHash}`
                                    : fromChainId === NETWORKS.ARC_TESTNET.chainId
                                        ? `${NETWORKS.ARC_TESTNET.explorerUrl}/tx/${txHash}`
                                        : fromChainId === NETWORKS.ARBITRUM_ONE.chainId
                                            ? `${NETWORKS.ARBITRUM_ONE.explorerUrl}/tx/${txHash}`
                                            : `${NETWORKS.ARBITRUM_ONE.explorerUrl}/tx/${txHash}`
                            }
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

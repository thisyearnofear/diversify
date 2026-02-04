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
    if (status === "idle") return null;

    return (
        <div
            className={`p-3 rounded-card ${status === "error"
                ? "bg-accent-error/5 text-accent-error border border-accent-error/10"
                : status === "completed"
                    ? "bg-accent-success/5 text-accent-success border border-accent-success/10"
                    : "bg-accent-info/5 text-accent-info border border-accent-info/10"
                }`}
        >
            <div className="flex items-center">
                {status === "approving" && (
                    <>
                        <svg
                            className="animate-spin -ml-1 mr-2 size-4"
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
                        <span>Approving token transfer...</span>
                    </>
                )}

                {status === "swapping" && (
                    <>
                        <svg
                            className="animate-spin -ml-1 mr-2 size-4"
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
                        <span>Executing swap transaction...</span>
                    </>
                )}

                {status === "completed" && !error && (
                    <>
                        <svg
                            className="size-4 mr-2 text-accent-success"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>Swap completed successfully!</span>
                    </>
                )}

                {status === "error" && (
                    <>
                        <svg
                            className="size-4 mr-2 text-accent-error"
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
                        <span>
                            {error || "An error occurred during the swap"}
                        </span>
                    </>
                )}
            </div>

            {txHash && (
                <div className="mt-2 text-sm border-t border-gray-200 pt-2">
                    <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                            Transaction Hash:
                        </span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(txHash);
                                // In a real app we'd use a toast, but keeping consistent with original code
                                alert("Transaction hash copied to clipboard!");
                            }}
                            className="text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md transition-colors"
                            title="Copy to clipboard"
                        >
                            Copy
                        </button>
                    </div>
                    <div className="flex items-center">
                        <code className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs font-mono w-full overflow-hidden text-ellipsis">
                            {txHash}
                        </code>
                    </div>
                    <div className="mt-2">
                        <a
                            href={
                                fromChainId === NETWORKS.ALFAJORES.chainId
                                    ? `${NETWORKS.ALFAJORES.explorerUrl}/tx/${txHash}`
                                    : fromChainId === NETWORKS.ARC_TESTNET.chainId
                                        ? `${NETWORKS.ARC_TESTNET.explorerUrl}/tx/${txHash}`
                                        : fromChainId === NETWORKS.ARBITRUM_ONE.chainId
                                            ? `${NETWORKS.ARBITRUM_ONE.explorerUrl}/tx/${txHash}`
                                            : `${NETWORKS.CELO_MAINNET.explorerUrl}/tx/${txHash}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-accent-info hover:underline bg-accent-info/10 px-3 py-1.5 rounded-md text-sm font-medium"
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
        </div>
    );
};

export default SwapStatus;

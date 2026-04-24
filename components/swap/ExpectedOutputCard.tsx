import React from "react";
import RegionalIconography from "../regional/RegionalIconography";
import { REGION_COLORS } from "../../config";
import type { Region } from "../../hooks/use-user-region";

interface ExpectedOutputCardProps {
    expectedOutput: string | null;
    amount: string;
    fromToken: string;
    toToken: string;
    fromTokenRegion?: string;
    toTokenRegion?: string;
    fromChainName?: string;
    toChainName?: string;
    slippageTolerance?: number;
    isCrossChain?: boolean;
    mounted: boolean;
}

const ExpectedOutputCard: React.FC<ExpectedOutputCardProps> = ({
    expectedOutput,
    amount,
    fromToken,
    toToken,
    fromTokenRegion,
    toTokenRegion,
    fromChainName,
    toChainName,
    slippageTolerance,
    isCrossChain = false,
    mounted,
}) => {
    if (!mounted || !expectedOutput || Number.parseFloat(expectedOutput) <= 0) {
        return null;
    }

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return null;
    }

    const rate = Number.parseFloat(expectedOutput) / parsedAmount;
    const reviewItems = [
        {
            label: "You send",
            value: `${Number.parseFloat(amount).toFixed(4)} ${fromToken}`,
        },
        {
            label: "You receive",
            value: `${Number.parseFloat(expectedOutput).toFixed(4)} ${toToken}`,
        },
        {
            label: "Route",
            value: isCrossChain ? "Cross-chain review" : "Same-chain review",
        },
        {
            label: "Slippage",
            value: typeof slippageTolerance === "number" ? `${slippageTolerance}% max` : "Default",
        },
    ];

    return (
        <section
            className="relative mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/20"
            aria-label="Swap review"
        >
            <div className="relative">
                <div className="mb-2 flex items-center text-sm font-bold text-gray-900 dark:text-gray-100">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="mr-2 size-4 text-sky-600"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path
                            fillRule="evenodd"
                            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                            clipRule="evenodd"
                        />
                    </svg>
                    Review This Route
                </div>
                <p className="mb-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    Check the estimated output, destination chain, and slippage before submitting the transaction.
                </p>

                <div className="rounded-2xl border border-white/60 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                {fromTokenRegion && (
                                    <div
                                        className="size-7 rounded-full flex items-center justify-center shadow-sm"
                                        style={{
                                            backgroundColor: REGION_COLORS[fromTokenRegion as keyof typeof REGION_COLORS],
                                        }}
                                    >
                                        <RegionalIconography
                                            region={fromTokenRegion as Region}
                                            size="sm"
                                            className="text-white scale-75"
                                        />
                                    </div>
                                )}
                                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                                    {fromToken}
                                    {fromChainName ? (
                                        <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                            on {fromChainName}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
                                    1 {fromToken} ≈ {rate.toFixed(4)} {toToken}
                                </span>
                                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                    {isCrossChain ? "Bridge + deposit path" : "Direct deposit path"}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-sky-50 px-4 py-3 dark:bg-sky-950/40">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Estimated receive
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                                <span className="text-2xl font-black text-sky-700 dark:text-sky-300" suppressHydrationWarning>
                                    {Number.parseFloat(expectedOutput).toFixed(4)}
                                </span>
                                <span className="text-sm font-bold text-sky-700 dark:text-sky-300">
                                    {toToken}
                                </span>
                                {toTokenRegion && (
                                    <div
                                        className="size-7 rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                                        style={{
                                            backgroundColor: REGION_COLORS[toTokenRegion as keyof typeof REGION_COLORS],
                                        }}
                                    >
                                        <RegionalIconography
                                            region={toTokenRegion as Region}
                                            size="sm"
                                            className="text-white scale-75"
                                        />
                                    </div>
                                )}
                            </div>
                            {toChainName ? (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Destination: {toChainName}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {reviewItems.map((item) => (
                        <div
                            key={item.label}
                            className="rounded-xl bg-white/70 px-3 py-2.5 dark:bg-gray-900/60"
                        >
                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {item.label}
                            </dt>
                            <dd className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                                {item.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    );
};

export default ExpectedOutputCard;

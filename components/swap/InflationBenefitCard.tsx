import React from "react";
import RegionalIconography from "../regional/RegionalIconography";
import { REGION_COLORS } from "../../config";
import type { Region } from "../../hooks/use-user-region";

interface InflationBenefitCardProps {
    fromToken: string;
    toToken: string;
    fromTokenRegion?: string;
    toTokenRegion?: string;
    inflationDifference: number;
    hasInflationBenefit: boolean;
}

const InflationBenefitCard: React.FC<InflationBenefitCardProps> = ({
    fromToken,
    toToken,
    fromTokenRegion,
    toTokenRegion,
    inflationDifference,
    hasInflationBenefit,
}) => {
    if (!fromToken || !toToken || !hasInflationBenefit) {
        return null;
    }

    return (
        <section
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20"
            aria-label="Inflation protection insight"
        >
            <div className="relative">
                <h3 className="mb-2 flex items-center text-sm font-bold text-gray-900 dark:text-gray-100">
                    <span className="mr-2 text-base" aria-hidden="true">✨</span>
                    Inflation Protection
                </h3>
                <div className="mb-3 flex items-center gap-1">
                    <div className="flex items-center">
                        {fromTokenRegion && fromTokenRegion !== 'Unknown' && (
                            <div
                                className="mr-1 flex size-6 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: fromTokenRegion
                                        ? REGION_COLORS[fromTokenRegion as keyof typeof REGION_COLORS]
                                        : undefined,
                                }}
                            >
                                <RegionalIconography
                                    region={fromTokenRegion as Region}
                                    size="sm"
                                    className="text-white scale-[0.65]"
                                />
                            </div>
                        )}
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {fromToken}
                        </span>
                    </div>
                    <span className="mx-1 text-sm font-bold text-gray-600 dark:text-gray-400">→</span>
                    <div className="flex items-center">
                        {toTokenRegion && toTokenRegion !== 'Unknown' && (
                            <div
                                className="mr-1 flex size-6 items-center justify-center rounded-full"
                                style={{
                                    backgroundColor: toTokenRegion
                                        ? REGION_COLORS[toTokenRegion as keyof typeof REGION_COLORS]
                                        : undefined,
                                }}
                            >
                                <RegionalIconography
                                    region={toTokenRegion as Region}
                                    size="sm"
                                    className="text-white scale-[0.65]"
                                />
                            </div>
                        )}
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {toToken}
                        </span>
                    </div>
                </div>
                <p className="text-sm leading-6 text-gray-800 dark:text-gray-200">
                    Save ~{" "}
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                        {inflationDifference.toFixed(1)}%
                    </span>{" "}
                    per year in {toTokenRegion && toTokenRegion !== 'Unknown' ? toTokenRegion : 'target region'}.
                </p>
            </div>
        </section>
    );
};

export default InflationBenefitCard;

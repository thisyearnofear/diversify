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
        <div className="relative p-3 rounded-lg overflow-hidden border-2 shadow-md bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="relative">
                <h3 className="text-xs font-bold mb-1.5 flex items-center text-gray-900 dark:text-gray-100">
                    <span className="mr-1.5 text-sm">✨</span>
                    Inflation Protection
                </h3>
                <div className="flex items-center mb-2 gap-1">
                    <div className="flex items-center">
                        {fromTokenRegion && fromTokenRegion !== 'Unknown' && (
                            <div
                                className="size-5 rounded-full flex items-center justify-center mr-1"
                                style={{
                                    backgroundColor: fromTokenRegion
                                        ? REGION_COLORS[fromTokenRegion as keyof typeof REGION_COLORS]
                                        : undefined,
                                }}
                            >
                                <RegionalIconography
                                    region={fromTokenRegion as Region}
                                    size="sm"
                                    className="text-white scale-[0.6]"
                                />
                            </div>
                        )}
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                            {fromToken}
                        </span>
                    </div>
                    <span className="mx-1 text-gray-600 dark:text-gray-400 font-bold text-xs">→</span>
                    <div className="flex items-center">
                        {toTokenRegion && toTokenRegion !== 'Unknown' && (
                            <div
                                className="size-5 rounded-full flex items-center justify-center mr-1"
                                style={{
                                    backgroundColor: toTokenRegion
                                        ? REGION_COLORS[toTokenRegion as keyof typeof REGION_COLORS]
                                        : undefined,
                                }}
                            >
                                <RegionalIconography
                                    region={toTokenRegion as Region}
                                    size="sm"
                                    className="text-white scale-[0.6]"
                                />
                            </div>
                        )}
                        <span className="font-bold text-xs text-gray-900 dark:text-gray-100">
                            {toToken}
                        </span>
                    </div>
                </div>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    Save ~{" "}
                    <span className="font-bold text-green-700 dark:text-green-400 text-sm">
                        {inflationDifference.toFixed(1)}%
                    </span>{" "}
                    per year in {toTokenRegion && toTokenRegion !== 'Unknown' ? toTokenRegion : 'target region'}.
                </p>
            </div>
        </div>
    );
};

export default InflationBenefitCard;

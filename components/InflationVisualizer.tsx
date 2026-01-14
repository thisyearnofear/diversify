import React from "react";
import type { Region } from "@/hooks/use-user-region";
import { RegionalPattern } from "./RegionalIconography";

interface InflationVisualizerProps {
  region: Region;
  inflationRate: number;
  years?: number;
  initialAmount?: number;
}

/**
 * Component that visualizes how inflation affects the value of money over time
 */
export default function InflationVisualizer({
  region,
  inflationRate,
  years = 5,
  initialAmount = 100,
}: InflationVisualizerProps) {
  // Calculate the value of money over time with compound inflation
  const valueOverTime = Array.from({ length: years + 1 }, (_, i) => {
    const value = initialAmount * Math.pow(1 - inflationRate / 100, i);
    return {
      year: i,
      value: Math.round(value * 100) / 100,
      percentage: Math.round((value / initialAmount) * 100),
    };
  });

  // Calculate total loss over the period
  const totalLoss = initialAmount - valueOverTime[years].value;
  const totalLossPercentage = Math.round((totalLoss / initialAmount) * 100);

  return (
    <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
      <RegionalPattern region={region} />
      <div className="relative">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <h3 className="font-bold text-gray-900">
              Value of ${initialAmount} Over Time
            </h3>
          </div>
          <div className="flex items-center">
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full font-medium border border-red-200">
              {inflationRate.toFixed(2)}% Inflation
            </span>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-900 font-medium mb-1">
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
              Today
            </span>
            <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100">
              {years} Years
            </span>
          </div>
          <div className="relative h-10 bg-gray-100 rounded-md overflow-hidden">
            <div
              className={`absolute top-0 left-0 h-full bg-region-${region.toLowerCase()}-medium rounded-md`}
              style={{ width: "100%" }}
            >
              <div className="h-full flex items-center justify-start pl-3">
                <span className="text-white font-bold text-base bg-black/30 px-2 py-0.5 rounded">
                  ${initialAmount}
                </span>
              </div>
            </div>
            <div
              className="absolute top-0 right-0 h-full bg-gray-200 rounded-r-md flex items-center justify-end pr-2"
              style={{ width: `${100 - valueOverTime[years].percentage}%` }}
            >
              <span className="text-white font-bold bg-red-600 px-2 py-0.5 rounded shadow-sm">
                -${totalLoss.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-700 font-medium mt-1">
            <span>Full Value</span>
            <span>
              ${valueOverTime[years].value.toFixed(2)} (
              {valueOverTime[years].percentage}% of original)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {valueOverTime.map((data) => (
            <div key={data.year} className="text-center">
              <div className="text-xs font-medium text-gray-700 mb-1">
                Year {data.year}
              </div>
              <div
                className={`mx-auto rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                  data.year === 0
                    ? `bg-region-${region.toLowerCase()}-dark text-white border-2 border-white`
                    : `bg-region-${region.toLowerCase()}-light border border-gray-300`
                }`}
                style={{
                  width: data.year === 0 ? "42px" : "36px",
                  height: data.year === 0 ? "42px" : "36px",
                  opacity: data.year === 0 ? 1 : 1 - (data.year / years) * 0.2,
                }}
              >
                <span className="text-black">${data.value.toFixed(0)}</span>
              </div>
              <div className="text-xs mt-1 font-bold bg-white px-1 rounded text-gray-900 shadow-sm border border-gray-100">
                {data.percentage}%
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-900 font-medium">
            With{" "}
            <span className="text-red-700 font-bold">
              {inflationRate.toFixed(2)}%
            </span>{" "}
            annual inflation in {region}, your ${initialAmount} will lose{" "}
            <span className="text-red-700 font-bold">
              ${totalLoss.toFixed(2)} ({totalLossPercentage}%)
            </span>{" "}
            of its purchasing power over {years} years.
          </p>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import type { Region } from "@/hooks/use-user-region";
import { RegionalPattern } from "../regional/RegionalIconography";

interface InflationVisualizerProps {
  region: Region;
  inflationRate: number;
  years?: number;
  initialAmount?: number;
  safeHavenYield?: number; // Typical RWA yield (e.g. 5.2% for Treasuries)
}

/**
 * Component that visualizes how inflation affects the value of money over time
 * and compares it with Agent-recommended Safe Havens.
 */
export default function InflationVisualizer({
  region,
  inflationRate,
  years = 5,
  initialAmount = 100,
  safeHavenYield = 5.2,
}: InflationVisualizerProps) {
  // Calculate the value of money over time with compound inflation
  const cashValueOverTime = Array.from({ length: years + 1 }, (_, i) => {
    const value = initialAmount * Math.pow(1 - inflationRate / 100, i);
    return {
      year: i,
      value: Math.round(value * 100) / 100,
      percentage: Math.round((value / initialAmount) * 100),
    };
  });

  // Calculate the value of money over time in a Safe Haven (yield + hedge)
  const safeHavenValueOverTime = Array.from({ length: years + 1 }, (_, i) => {
    // safeHavenYield is added, inflation is subtracted (assuming target stable is USD)
    // For simplicity, we show nominal growth of safe haven vs erosion of local cash
    const value = initialAmount * Math.pow(1 + safeHavenYield / 100, i);
    return {
      year: i,
      value: Math.round(value * 100) / 100,
    };
  });

  // Calculate total loss over the period
  // const totalLoss = initialAmount - cashValueOverTime[years].value;
  const wealthPreserved = safeHavenValueOverTime[years].value - cashValueOverTime[years].value;

  return (
    <div className="relative overflow-hidden bg-white rounded-2xl shadow-xl p-5 mb-6 border border-gray-200">
      <RegionalPattern region={region} />
      <div className="relative">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="font-black text-gray-900 text-lg tracking-tight uppercase">
              Wealth Preservation Gap
            </h3>
            <p className="text-xs font-bold text-gray-500">Projected: ${initialAmount} over {years} years</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200 uppercase mb-1">
              Local: {inflationRate.toFixed(1)}% Infl.
            </span>
            <span className="text-[10px] font-black bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200 uppercase">
              Vault: {safeHavenYield.toFixed(1)}% APY
            </span>
          </div>
        </div>

        {/* COMPARISON BARS */}
        <div className="space-y-6 mb-8">
          <div>
            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-1.5">
              <span>Local Cash / Stablecoins</span>
              <span className="text-red-600">Eroding</span>
            </div>
            <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200">
              <div
                className={`absolute top-0 left-0 h-full bg-gradient-to-r from-red-600 to-red-400 opacity-20`}
                style={{ width: "100%" }}
              />
              <div
                className={`absolute top-0 left-0 h-full bg-region-${region.toLowerCase()}-medium shadow-lg transition-all duration-1000 ease-out`}
                style={{ width: `${cashValueOverTime[years].percentage}%` }}
              >
                <div className="h-full flex items-center pl-3">
                  <span className="text-white font-black text-sm drop-shadow-md">
                    ${cashValueOverTime[years].value.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="absolute inset-y-0 right-3 flex items-center">
                <span className="text-[10px] font-bold text-gray-400">-{years}Y Erosion</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase mb-1.5">
              <span>Agent Recommended RWAs</span>
              <span className="text-green-600">Appreciating</span>
            </div>
            <div className="relative h-10 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200">
              <div
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 to-teal-500 shadow-xl transition-all duration-1000 ease-out"
                style={{ width: "100%" }}
              >
                <div className="h-full flex items-center justify-between px-3">
                  <span className="text-white font-black text-sm drop-shadow-md">
                    ${safeHavenValueOverTime[years].value.toFixed(0)}
                  </span>
                  <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">
                    SAFE HAVEN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* YEARLY BREAKDOWN DOTS */}
        <div className="grid grid-cols-6 gap-2 mb-6">
          {cashValueOverTime.map((data, idx) => (
            <div key={data.year} className="text-center group">
              <div className="text-[9px] font-black text-gray-400 mb-2 uppercase group-hover:text-gray-900 transition-colors">
                Yr {data.year}
              </div>
              <div className="relative flex flex-col items-center gap-1">
                {/* Safe Haven Ghost */}
                <div
                  className="w-10 h-10 rounded-full border border-emerald-200 bg-emerald-50/50 flex items-center justify-center text-[9px] font-black text-emerald-700"
                >
                  ${safeHavenValueOverTime[idx].value.toFixed(0)}
                </div>
                {/* Eroding Cash */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition-all ${data.year === 0
                      ? `bg-region-${region.toLowerCase()}-dark text-white scale-110`
                      : `bg-white border-2 border-red-100 text-red-600`
                    }`}
                  style={{
                    opacity: 1 - (data.year / (years + 1)) * 0.1,
                  }}
                >
                  <span>${data.value.toFixed(0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* IMPACT SUMMARY */}
        <div className="relative bg-black rounded-xl p-4 overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="relative flex items-center gap-4">
            <div className="flex-shrink-0 size-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-2xl">
              🛡️
            </div>
            <div>
              <h4 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-1">Protection Outcome</h4>
              <p className="text-white font-bold text-[13px] leading-tight">
                By deploying to the Oracle&#39;s RWA Safe Haven, you preserve <span className="text-emerald-400">${wealthPreserved.toFixed(2)}</span> in wealth that would otherwise be lost to inflation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef } from "react";
import type { Region } from "../hooks/use-user-region";

// Region colors for visualization - brighter, more vibrant colors
const REGION_COLORS: Record<Region, string> = {
  USA: "#4299E1", // blue
  Europe: "#48BB78", // green
  LatAm: "#F6AD55", // orange
  Africa: "#F56565", // red
  Asia: "#9F7AEA", // purple
};

interface CurrencyPerformanceChartProps {
  data: {
    dates: string[];
    currencies: {
      symbol: string;
      name: string;
      region: Region;
      values: number[];
      percentChange: number;
    }[];
    baseCurrency: string;
    source?: "api" | "cache";
  };
  title?: string;
}

export default function CurrencyPerformanceChart({
  data,
  title = "Currency Performance",
}: CurrencyPerformanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.dates.length || !data.currencies.length)
      return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up chart dimensions
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Find min and max values across all currencies
    let minValue = Number.MAX_VALUE;
    let maxValue = Number.MIN_VALUE;

    data.currencies.forEach((currency) => {
      const currMin = Math.min(...currency.values);
      const currMax = Math.max(...currency.values);

      if (currMin < minValue) minValue = currMin;
      if (currMax > maxValue) maxValue = currMax;
    });

    // Add padding to min/max
    minValue = minValue * 0.95;
    maxValue = maxValue * 1.05;

    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = "#CBD5E0";
    ctx.lineWidth = 1;

    // Y-axis
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);

    // X-axis
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);

    ctx.stroke();

    // Draw Y-axis labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#4A5568";
    ctx.font = "10px sans-serif";

    const yLabelCount = 5;
    for (let i = 0; i <= yLabelCount; i++) {
      const value =
        minValue + ((maxValue - minValue) * (yLabelCount - i)) / yLabelCount;
      const y = padding.top + (chartHeight * i) / yLabelCount;

      ctx.fillText(value.toFixed(2), padding.left - 5, y);

      // Draw horizontal grid line
      ctx.beginPath();
      ctx.strokeStyle = "#EDF2F7";
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();
    }

    // Draw X-axis labels (dates)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Only show a few dates to avoid crowding
    const dateStep = Math.ceil(data.dates.length / 5);
    for (let i = 0; i < data.dates.length; i += dateStep) {
      const x = padding.left + (chartWidth * i) / (data.dates.length - 1);
      const date = new Date(data.dates[i]);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

      ctx.fillText(formattedDate, x, canvas.height - padding.bottom + 5);
    }

    // Draw lines for each currency with enhanced styling
    data.currencies.forEach((currency) => {
      const color = REGION_COLORS[currency.region] || "#A0AEC0";

      // Draw shadow for depth effect
      ctx.beginPath();
      ctx.strokeStyle = REGION_COLORS[currency.region] || "#A0AEC0";
      ctx.lineWidth = 2;

      for (let i = 0; i < currency.values.length; i++) {
        const x =
          padding.left + (chartWidth * i) / (currency.values.length - 1);
        const y =
          padding.top +
          chartHeight -
          (chartHeight * (currency.values[i] - minValue)) /
            (maxValue - minValue);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      // Reset shadow
      ctx.shadowBlur = 0;
    });

    // Draw legend
    const legendX = padding.left;
    const legendY = padding.top - 10;
    const legendItemWidth = 80;

    data.currencies.forEach((currency, index) => {
      const x = legendX + index * legendItemWidth;

      // Draw color box
      ctx.fillStyle = REGION_COLORS[currency.region] || "#A0AEC0";
      ctx.fillRect(x, legendY, 10, 10);

      // Draw currency symbol
      ctx.fillStyle = "#4A5568";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(currency.symbol, x + 15, legendY + 5);
    });
  }, [data]);

  // Calculate what $1 would be worth now if invested in each currency
  const dollarPerformance = data.currencies.map((currency) => {
    const initialValue = 1;
    const currentValue = initialValue * (1 + currency.percentChange / 100);

    return {
      symbol: currency.symbol,
      name: currency.name,
      region: currency.region,
      initialValue,
      currentValue,
      percentChange: currency.percentChange,
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <span className="text-xs text-gray-700 font-medium ml-2 bg-gray-100 px-2 py-0.5 rounded">
            Alpha Vantage
          </span>
        </div>
        <div>
          {data.source === "api" && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
              Live Data
            </span>
          )}
          {data.source === "cache" && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
              Cached Data
            </span>
          )}
        </div>
      </div>

      {data.dates.length > 0 && data.currencies.length > 0 ? (
        <div className="flex flex-col">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full h-auto mb-4"
          />

          <div className="mt-4">
            <div className="grid grid-cols-2 gap-2">
              {dollarPerformance.map((item) => (
                <div
                  key={item.symbol}
                  className="border rounded p-2 bg-gray-50"
                  style={{
                    borderColor: REGION_COLORS[item.region] || "#CBD5E0",
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center">
                      <div
                        className="size-4 rounded-full mr-1 flex items-center justify-center"
                        style={{
                          backgroundColor:
                            REGION_COLORS[item.region] || "#CBD5E0",
                        }}
                      >
                        <span className="text-white text-xs font-bold">
                          {item.symbol.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.symbol}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        item.percentChange >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {item.percentChange >= 0 ? "+" : ""}
                      {item.percentChange.toFixed(2)}%
                    </span>
                  </div>
                  <div className="mt-1">
                    <div className="text-xs font-medium text-gray-700">
                      $1.00 → ${item.currentValue.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-gray-500">
          <div className="text-center">
            <p className="mb-2">No currency performance data available</p>
            <p className="text-xs text-gray-400">
              Data provided by Alpha Vantage
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

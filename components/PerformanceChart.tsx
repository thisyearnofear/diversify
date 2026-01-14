import React, { useEffect, useRef } from "react";
import type { Region } from "@/hooks/use-user-region";

// Region colors for visualization
const REGION_COLORS: Record<Region, string> = {
  USA: "#4299E1", // blue
  Europe: "#48BB78", // green
  LatAm: "#F6AD55", // orange
  Africa: "#F56565", // red
  Asia: "#9F7AEA", // purple
};

interface PerformanceChartProps {
  data: {
    dates: string[];
    values: number[];
    regions: Record<Region, number[]>;
    percentChange: number;
    volatility: number;
  };
  title?: string;
}

export default function PerformanceChart({
  data,
  title = "Portfolio Performance",
}: PerformanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.dates.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up chart dimensions
    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    // Find min and max values
    const maxValue = Math.max(...data.values) * 1.1; // Add 10% padding
    const minValue = Math.min(...data.values) * 0.9; // Subtract 10% padding

    // Draw axes
    ctx.beginPath();
    ctx.strokeStyle = "#CBD5E0";
    ctx.lineWidth = 1;

    // X-axis
    ctx.moveTo(padding.left, canvas.height - padding.bottom);
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);

    // Y-axis
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, canvas.height - padding.bottom);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.font = "10px Arial";
    ctx.fillStyle = "#4A5568";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yLabelCount = 5;
    for (let i = 0; i <= yLabelCount; i++) {
      const y = padding.top + (chartHeight * (yLabelCount - i)) / yLabelCount;
      const value = minValue + ((maxValue - minValue) * i) / yLabelCount;

      ctx.fillText(`$${value.toFixed(0)}`, padding.left - 5, y);

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

    // Only show a subset of dates to avoid overcrowding
    const dateStep = Math.ceil(data.dates.length / 5);
    for (let i = 0; i < data.dates.length; i += dateStep) {
      const x = padding.left + (chartWidth * i) / (data.dates.length - 1);
      const date = new Date(data.dates[i]);
      const formattedDate = `${date.getMonth() + 1}/${date.getDate()}`;

      ctx.fillText(formattedDate, x, canvas.height - padding.bottom + 5);
    }

    // Draw line chart
    ctx.beginPath();
    ctx.strokeStyle = "#3B82F6";
    ctx.lineWidth = 2;

    for (let i = 0; i < data.values.length; i++) {
      const x = padding.left + (chartWidth * i) / (data.values.length - 1);
      const y =
        padding.top +
        chartHeight -
        (chartHeight * (data.values[i] - minValue)) / (maxValue - minValue);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Add gradient fill under the line
    const gradient = ctx.createLinearGradient(
      0,
      padding.top,
      0,
      canvas.height - padding.bottom
    );
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
    gradient.addColorStop(1, "rgba(59, 130, 246, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Start from bottom left
    ctx.moveTo(padding.left, canvas.height - padding.bottom);

    // Draw line to match the chart line
    for (let i = 0; i < data.values.length; i++) {
      const x = padding.left + (chartWidth * i) / (data.values.length - 1);
      const y =
        padding.top +
        chartHeight -
        (chartHeight * (data.values[i] - minValue)) / (maxValue - minValue);
      ctx.lineTo(x, y);
    }

    // Complete the path to bottom right
    ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw data points
    for (
      let i = 0;
      i < data.values.length;
      i += Math.ceil(data.values.length / 10)
    ) {
      const x = padding.left + (chartWidth * i) / (data.values.length - 1);
      const y =
        padding.top +
        chartHeight -
        (chartHeight * (data.values[i] - minValue)) / (maxValue - minValue);

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fillStyle = "#3B82F6";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [data]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <div className="flex items-center">
            <span className="text-xs text-gray-700 font-medium ml-2 bg-gray-100 px-2 py-0.5 rounded">
              World Bank, Alpha Vantage
            </span>
            <div className="relative ml-2 group">
              <span className="cursor-help text-blue-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-white p-2 rounded-md shadow-lg border border-gray-200 text-xs text-gray-700 hidden group-hover:block z-10">
                <p className="font-medium text-gray-900 mb-1">Simulated Data</p>
                <p>
                  This chart shows a simulation based on your current portfolio
                  allocation. It is not actual historical performance data.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex space-x-4">
          <div
            className={`text-sm font-medium ${
              data.percentChange >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {data.percentChange >= 0 ? "+" : ""}
            {data.percentChange.toFixed(2)}%
            <span className="text-gray-700 text-xs font-medium ml-1 bg-gray-100 px-1 rounded">
              30d
            </span>
          </div>
          <div className="text-sm font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
            Vol: {data.volatility.toFixed(2)}%
          </div>
        </div>
      </div>

      {data.dates.length > 0 ? (
        <div className="flex flex-col items-center">
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full h-auto mb-4"
          />

          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="col-span-2 text-sm font-medium text-gray-900 mb-2 bg-gray-50 p-2 rounded-md">
              Regional Allocation (Current)
            </div>
            {Object.entries(REGION_COLORS).map(([region, color]) => {
              const regionData = data.regions[region as Region];
              if (!regionData || regionData.length === 0) return null;

              const latestValue = regionData[regionData.length - 1];
              const totalValue = data.values[data.values.length - 1];
              const percentage = (latestValue / totalValue) * 100;

              return (
                <div
                  key={region}
                  className="flex items-center p-1 rounded hover:bg-gray-50"
                >
                  <div
                    className="size-4 rounded-full mr-2 flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <span className="text-white text-xs font-bold">
                      {region.charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-800">
                    {region}: {percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="mb-2 text-gray-800 font-medium">
              No performance data available
            </p>
            <p className="text-xs text-gray-700">
              Connect your wallet to view portfolio performance
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

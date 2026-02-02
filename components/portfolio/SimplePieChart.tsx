import React, { useEffect, useRef } from "react";

interface PieChartData {
  region: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieChartData[];
  title?: string;
  minimal?: boolean;
}

export default function SimplePieChart({
  data,
  title = "Portfolio Distribution",
  minimal = false,
}: SimplePieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return;

    // Calculate center and radius
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - (minimal ? 2 : 10);

    // Draw pie chart
    let startAngle = 0;
    data.forEach((item) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      if (minimal) {
        // Doughnut style for minimal
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.arc(centerX, centerY, radius * 0.7, startAngle + sliceAngle, startAngle, true);
      } else {
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      }
      ctx.closePath();

      // Fill slice
      ctx.fillStyle = item.color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = minimal ? "rgba(0,0,0,0.05)" : "#ffffff";
      ctx.lineWidth = minimal ? 1 : 2;
      ctx.stroke();

      if (!minimal) {
        // Calculate label position
        const labelAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.7;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;

        // Only draw label if slice is big enough
        if (sliceAngle > 0.2) {
          // Draw label
          ctx.font = "bold 12px Arial";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(item.region, labelX, labelY);
        }
      }

      startAngle += sliceAngle;
    });
  }, [data, minimal]);

  if (minimal) {
    return (
      <div className="w-full h-full flex items-center justify-center p-1">
        <canvas ref={canvasRef} width={240} height={240} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 mb-3 border border-gray-200 dark:border-gray-700">
      {title && <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>}

      {data.length > 0 ? (
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} width={200} height={200} className="mb-1" />

          <div className="grid grid-cols-1 gap-1 w-full text-xs">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <div
                    className="w-3 h-3 rounded-full mr-1.5 border border-gray-200"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {item.region}
                  </span>
                </div>
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  {(
                    (item.value / data.reduce((sum, d) => sum + d.value, 0)) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 text-sm">
          No portfolio data available
        </div>
      )}
    </div>
  );
}

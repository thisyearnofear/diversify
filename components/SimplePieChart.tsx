import React, { useEffect, useRef } from "react";

interface PieChartData {
  region: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieChartData[];
  title?: string;
}

export default function SimplePieChart({
  data,
  title = "Portfolio Distribution",
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
    const radius = Math.min(centerX, centerY) - 10;

    // Draw pie chart
    let startAngle = 0;
    data.forEach((item) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();

      // Fill slice
      ctx.fillStyle = item.color;
      ctx.fill();

      // Draw border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

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

      startAngle += sliceAngle;
    });
  }, [data]);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>

      {data.length > 0 ? (
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} width={200} height={200} className="mb-4" />

          <div className="grid grid-cols-2 gap-2 w-full">
            {data.map((item, index) => (
              <div key={index} className="flex items-center">
                <div
                  className="size-4 rounded-full mr-2 border border-gray-200"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium text-gray-900">
                  {item.region}:{" "}
                  <span className="font-bold">
                    {(
                      (item.value / data.reduce((sum, d) => sum + d.value, 0)) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500">
          No portfolio data available
        </div>
      )}
    </div>
  );
}

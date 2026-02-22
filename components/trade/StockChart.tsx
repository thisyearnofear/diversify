import React, { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";

interface StockChartProps {
  symbol: string;
  height?: number;
  currentPrice?: string | null;
}

/**
 * StockChart Component
 *
 * A specialized line chart for the Robinhood-style trading experience.
 * Generates deterministic but realistic-looking mock price action based on the symbol.
 */
export default function StockChart({
  symbol,
  height = 200,
  currentPrice,
}: StockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generate mock price data based on the symbol to keep it consistent for each stock
  const data = useMemo(() => {
    const points = 60;
    const values: number[] = [];

    // Seeded random based on symbol characters
    let seed = symbol
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Use currentPrice as the "anchor" for the simulation if available
    const finalPrice = currentPrice
      ? parseFloat(currentPrice.replace(/,/g, ""))
      : 100 + rng() * 50;
    let price = finalPrice * (0.95 + rng() * 0.1);

    for (let i = 0; i < points - 1; i++) {
      const drift = (finalPrice - price) / (points - i);
      const volatility = finalPrice * 0.005;
      price += drift + (rng() - 0.5) * volatility;
      values.push(price);
    }
    values.push(finalPrice);
    return values;
  }, [symbol, currentPrice]);

  const isUp = data[data.length - 1] >= data[0];
  const chartColor = isUp ? "#22c55e" : "#ef4444"; // Green-500 or Red-500

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Padding
    const padding = { top: 20, bottom: 20, left: 5, right: 5 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Scale values
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    const getX = (i: number) =>
      padding.left + (i / (data.length - 1)) * chartWidth;
    const getY = (val: number) =>
      padding.top + chartHeight - ((val - min) / range) * chartHeight;

    // Draw grid lines (minimalist)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(156, 163, 175, 0.1)"; // gray-400 with low opacity
    ctx.lineWidth = 1;

    // Horizontal lines
    [0.25, 0.5, 0.75].forEach((p) => {
      const y = padding.top + chartHeight * p;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
    });
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw the main line
    ctx.beginPath();
    ctx.strokeStyle = chartColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    data.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
    if (isUp) {
      gradient.addColorStop(0, "rgba(34, 197, 94, 0.15)");
      gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
    } else {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.15)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    }

    ctx.fillStyle = gradient;
    ctx.lineTo(getX(data.length - 1), height);
    ctx.lineTo(getX(0), height);
    ctx.closePath();
    ctx.fill();

    // Draw price indicators (optional, keeping it clean)
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
    ctx.fillText("LIVE AMM PRICE FEED", padding.left, padding.top - 8);
  }, [data, chartColor, isUp]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ touchAction: "none" }}
      />

      {/* Price Overlay */}
      <div className="absolute top-0 right-0 text-right">
        <div
          className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
            isUp
              ? "bg-green-500/5 text-green-500 border-green-500/20"
              : "bg-red-500/5 text-red-500 border-red-500/20"
          }`}
        >
          {isUp ? "↑" : "↓"}{" "}
          {((data[data.length - 1] / data[0] - 1) * 100).toFixed(2)}%
        </div>
      </div>

      {/* Live Pulse Point */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: "5px",
          bottom:
            data.length > 0
              ? `${((data[data.length - 1] - Math.min(...data)) / Math.max(0.00001, Math.max(...data) - Math.min(...data))) * 70 + 15}%`
              : "50%",
          transform: "translate(50%, 50%)",
        }}
      >
        <motion.div
          animate={{ scale: [1, 2.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-5 h-5 rounded-full"
          style={{ backgroundColor: chartColor }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-white shadow-sm"
          style={{ backgroundColor: chartColor }}
        />
      </div>

      {/* Crosshair/Hover state would go here for a more advanced version */}
    </motion.div>
  );
}

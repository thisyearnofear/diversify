import React, { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";

interface StockChartProps {
  symbol: string;
  height?: number;
  currentPrice?: string | null;
  volatility?: number; // Annualized volatility percentage (e.g. 0.45 for 45%)
  forecastPercentiles?: {
    p10: number;
    p50: number;
    p90: number;
  } | null;
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
  volatility = 0.3, // Default to 30% if not provided
  forecastPercentiles = null,
}: StockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [jitter, setJitter] = React.useState(0);

  // Live Jitter effect to make the chart feel "active"
  useEffect(() => {
    const interval = setInterval(() => {
      setJitter((Math.random() - 0.5) * (volatility * 2));
    }, 150);
    return () => clearInterval(interval);
  }, [volatility]);

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
      const stepVolatility = finalPrice * (volatility / 50); // Scale volatility to chart steps
      price += drift + (rng() - 0.5) * stepVolatility;
      values.push(price);
    }
    values.push(finalPrice);
    return values;
  }, [symbol, currentPrice, volatility]);

  // Apply real-time jitter to the last point
  const displayData = useMemo(() => {
    const newData = [...data];
    if (newData.length > 0) {
      const lastVal = newData[newData.length - 1];
      newData[newData.length - 1] = lastVal + (lastVal * (jitter / 500));
    }
    return newData;
  }, [data, jitter]);

  const isUp = displayData[displayData.length - 1] >= displayData[0];
  const chartColor = isUp ? "#2563eb" : "#ef4444"; // Blue-600 or Red-500

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
    const min = Math.min(...displayData);
    const max = Math.max(...displayData);
    const range = Math.max(0.0001, max - min);

    const getX = (i: number) =>
      padding.left + (i / (displayData.length - 1)) * chartWidth;
    const getY = (val: number) =>
      padding.top + chartHeight - ((val - min) / range) * chartHeight;

    // Draw Forecast Zone (Synth SN50)
    if (forecastPercentiles) {
      const lastX = getX(displayData.length - 1);
      const forecastWidth = 40; // Pixels to extend the forecast zone
      const p10Y = getY(forecastPercentiles.p10);
      const p50Y = getY(forecastPercentiles.p50);
      const p90Y = getY(forecastPercentiles.p90);

      // Draw shaded area between p10 and p90
      ctx.beginPath();
      ctx.fillStyle = isUp ? "rgba(37, 99, 235, 0.05)" : "rgba(239, 68, 68, 0.05)";
      ctx.moveTo(lastX, getY(displayData[displayData.length - 1]));
      ctx.lineTo(lastX + forecastWidth, p10Y);
      ctx.lineTo(lastX + forecastWidth, p90Y);
      ctx.closePath();
      ctx.fill();

      // Draw dashed forecast lines
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = isUp ? "rgba(37, 99, 235, 0.3)" : "rgba(239, 68, 68, 0.3)";
      ctx.lineWidth = 1;

      // P90 Line
      ctx.moveTo(lastX, getY(displayData[displayData.length - 1]));
      ctx.lineTo(lastX + forecastWidth, p90Y);
      ctx.stroke();

      // P10 Line
      ctx.beginPath();
      ctx.moveTo(lastX, getY(displayData[displayData.length - 1]));
      ctx.lineTo(lastX + forecastWidth, p10Y);
      ctx.stroke();

      // P50 Line (Expected)
      ctx.beginPath();
      ctx.setLineDash([4, 2]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isUp ? "rgba(37, 99, 235, 0.5)" : "rgba(239, 68, 68, 0.5)";
      ctx.moveTo(lastX, getY(displayData[displayData.length - 1]));
      ctx.lineTo(lastX + forecastWidth, p50Y);
      ctx.stroke();

      ctx.setLineDash([]);
      
      // Label the forecast
      ctx.font = "black 7px Inter, system-ui, sans-serif";
      ctx.fillStyle = isUp ? "rgba(37, 99, 235, 0.8)" : "rgba(239, 68, 68, 0.8)";
      ctx.fillText("SN50 FORECAST", lastX + 5, p50Y - 5);
    }

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

    displayData.forEach((val, i) => {
      const x = getX(i);
      const y = getY(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height);
    if (isUp) {
      gradient.addColorStop(0, "rgba(37, 99, 235, 0.1)");
      gradient.addColorStop(1, "rgba(37, 99, 235, 0)");
    } else {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.1)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    }

    ctx.fillStyle = gradient;
    ctx.lineTo(getX(displayData.length - 1), height);
    ctx.lineTo(getX(0), height);
    ctx.closePath();
    ctx.fill();

    // Draw price indicators (optional, keeping it clean)
    ctx.font = "bold 10px Inter, system-ui, sans-serif";
    ctx.fillStyle = "rgba(156, 163, 175, 0.5)";
    ctx.fillText("LIVE AMM PRICE FEED", padding.left, padding.top - 8);
  }, [displayData, chartColor, isUp]);

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
          className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${
            isUp
              ? "bg-blue-600/5 text-blue-600 border-blue-600/20"
              : "bg-red-500/5 text-red-500 border-red-500/20"
          }`}
        >
          {isUp ? "↑" : "↓"}{" "}
          {((displayData[displayData.length - 1] / displayData[0] - 1) * 100).toFixed(2)}%
        </div>
      </div>

      {/* Live Pulse Point */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: "5px",
          top:
            displayData.length > 0
              ? `calc(20px + ${height - 40}px - ((${displayData[displayData.length - 1]} - ${Math.min(...(displayData.length > 0 ? displayData : [0]))}) / ${Math.max(0.00001, Math.max(...(displayData.length > 0 ? displayData : [0])) - Math.min(...(displayData.length > 0 ? displayData : [0])))}) * ${height - 40}px)`
              : "50%",
          transform: "translate(50%, -50%)",
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

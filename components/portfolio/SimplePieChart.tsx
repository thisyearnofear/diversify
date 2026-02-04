import React, { useEffect, useRef, useState, useCallback } from "react";

interface PieChartData {
  region: string;
  value: number;
  color: string;
}

interface SimplePieChartProps {
  data: PieChartData[];
  title?: string;
  minimal?: boolean;
  /** Duration for the initial animation in ms */
  animationDuration?: number;
  /** Currently highlighted region index (for external control) */
  highlightedIndex?: number | null;
  /** Callback when a segment is hovered */
  onSegmentHover?: (index: number | null) => void;
  /** Enable interactive hover effects */
  interactive?: boolean;
}

export default function SimplePieChart({
  data,
  title = "Portfolio Distribution",
  minimal = false,
  animationDuration = 800,
  highlightedIndex = null,
  onSegmentHover,
  interactive = false,
}: SimplePieChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const animationRef = useRef<number>();

  // Combine external and internal hover state
  const activeIndex = highlightedIndex !== null ? highlightedIndex : hoveredIndex;

  // Animate entry on mount
  useEffect(() => {
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Easing function: easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimationProgress(eased);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animationDuration, data]);

  // Draw the chart
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

    // Draw pie chart with staggered animation
    let startAngle = -Math.PI / 2; // Start from top
    
    data.forEach((item, index) => {
      const sliceAngle = (item.value / total) * 2 * Math.PI;
      
      // Stagger animation by index (each slice starts 100ms after previous)
      const sliceDelay = index * 0.1;
      const sliceProgress = Math.max(0, Math.min((animationProgress - sliceDelay) / 0.7, 1));
      
      if (sliceProgress <= 0) {
        startAngle += sliceAngle;
        return;
      }

      const animatedSliceAngle = sliceAngle * sliceProgress;
      const isActive = activeIndex === index;
      const isDimmed = activeIndex !== null && activeIndex !== index;

      // Draw slice
      ctx.beginPath();
      if (minimal) {
        // Doughnut style for minimal
        const outerRadius = isActive ? radius * 1.05 : radius;
        ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + animatedSliceAngle);
        ctx.arc(centerX, centerY, radius * 0.7, startAngle + animatedSliceAngle, startAngle, true);
      } else {
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + animatedSliceAngle);
      }
      ctx.closePath();

      // Fill slice with dimming effect
      if (isDimmed) {
        ctx.fillStyle = adjustColorOpacity(item.color, 0.3);
      } else {
        ctx.fillStyle = item.color;
      }
      ctx.fill();

      // Draw border
      ctx.strokeStyle = minimal ? "rgba(0,0,0,0.05)" : "#ffffff";
      ctx.lineWidth = minimal ? 1 : 2;
      ctx.stroke();

      // Highlight border for active segment
      if (isActive && interactive) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      if (!minimal) {
        // Calculate label position
        const labelAngle = startAngle + animatedSliceAngle / 2;
        const labelRadius = radius * 0.7;
        const labelX = centerX + Math.cos(labelAngle) * labelRadius;
        const labelY = centerY + Math.sin(labelAngle) * labelRadius;

        // Only draw label if slice is big enough and animation is complete
        if (sliceAngle > 0.2 && sliceProgress > 0.8) {
          ctx.font = "bold 12px Arial";
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(item.region, labelX, labelY);
        }
      }

      startAngle += sliceAngle;
    });
  }, [data, minimal, animationProgress, activeIndex, interactive]);

  // Handle mouse/touch interactions
  const handleInteraction = useCallback((event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!interactive || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get coordinates
    let clientX, clientY;
    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = (event as React.MouseEvent).clientX;
      clientY = (event as React.MouseEvent).clientY;
    }
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // Calculate angle and distance from center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx);
    
    // Normalize angle to match our drawing (start from -PI/2)
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    
    // Check if within donut radius
    const radius = Math.min(centerX, centerY) - (minimal ? 2 : 10);
    const innerRadius = minimal ? radius * 0.7 : 0;
    
    if (distance < innerRadius || distance > radius * 1.05) {
      setHoveredIndex(null);
      onSegmentHover?.(null);
      return;
    }
    
    // Find which segment
    const total = data.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = 0;
    let foundIndex = -1;
    
    for (let i = 0; i < data.length; i++) {
      const sliceAngle = (data[i].value / total) * 2 * Math.PI;
      if (angle >= currentAngle && angle < currentAngle + sliceAngle) {
        foundIndex = i;
        break;
      }
      currentAngle += sliceAngle;
    }
    
    setHoveredIndex(foundIndex >= 0 ? foundIndex : null);
    onSegmentHover?.(foundIndex >= 0 ? foundIndex : null);
  }, [data, interactive, minimal, onSegmentHover]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    onSegmentHover?.(null);
  }, [onSegmentHover]);

  // Helper to adjust color opacity
  function adjustColorOpacity(color: string, opacity: number): string {
    // Handle hex colors
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Handle rgb/rgba
    if (color.startsWith('rgb')) {
      return color.replace(/rgba?\(([^)]+)\)/, (_, values) => {
        const nums = values.split(',').map((n: string) => parseFloat(n.trim()));
        return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${opacity})`;
      });
    }
    return color;
  }

  if (minimal) {
    return (
      <div className="w-full h-full flex items-center justify-center p-1">
        <canvas 
          ref={canvasRef} 
          width={240} 
          height={240} 
          className="w-full h-full"
          onMouseMove={handleInteraction}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleInteraction}
          onTouchMove={handleInteraction}
          onTouchEnd={handleMouseLeave}
          style={{ cursor: interactive ? 'pointer' : 'default' }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 mb-3 border border-gray-200 dark:border-gray-700">
      {title && <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h3>}

      {data.length > 0 ? (
        <div className="flex flex-col items-center">
          <canvas 
            ref={canvasRef} 
            width={200} 
            height={200} 
            className="mb-1"
            onMouseMove={handleInteraction}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleInteraction}
            onTouchMove={handleInteraction}
            onTouchEnd={handleMouseLeave}
            style={{ cursor: interactive ? 'pointer' : 'default' }}
          />

          <div className="grid grid-cols-1 gap-1 w-full text-xs">
            {data.map((item, index) => (
              <div 
                key={index} 
                className={`flex items-center justify-between transition-opacity duration-200 ${
                  activeIndex !== null && activeIndex !== index ? 'opacity-40' : 'opacity-100'
                }`}
              >
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

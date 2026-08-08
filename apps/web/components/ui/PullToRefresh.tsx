import React, { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  /** Pixels of pull needed to trigger refresh (default 72) */
  threshold?: number;
}

export default function PullToRefresh({ onRefresh, children, threshold = 72 }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const startY = useRef<number | null>(null);
  const pullY = useMotionValue(0);
  const spinnerOpacity = useTransform(pullY, [0, threshold], [0, 1]);
  const spinnerScale = useTransform(pullY, [0, threshold], [0.5, 1]);
  const contentY = useTransform(pullY, [0, threshold], [0, threshold]);
  const arrowRotate = useTransform(pullY, [0, threshold], [0, 180]);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only activate pull-to-refresh when page is scrolled to top
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || isRefreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      pullY.set(0);
      setTriggered(false);
      return;
    }
    // Rubber-band: dampen pull beyond threshold
    const damped = delta < threshold ? delta : threshold + (delta - threshold) * 0.2;
    pullY.set(Math.min(damped, threshold * 1.5));
    setTriggered(delta >= threshold);
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (triggered && !isRefreshing) {
      setIsRefreshing(true);
      pullY.set(threshold * 0.6); // hold spinner visible while refreshing
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        pullY.set(0);
        setTriggered(false);
      }
    } else {
      pullY.set(0);
      setTriggered(false);
    }
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <motion.div
        style={{ opacity: spinnerOpacity, scale: spinnerScale }}
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-10"
        aria-hidden="true"
      >
        <div className={`mt-2 w-9 h-9 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center border border-gray-200 dark:border-gray-700`}>
          {isRefreshing ? (
            <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10h-2a8 8 0 01-8-8z" />
            </svg>
          ) : (
            <motion.svg
              className="w-5 h-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{ rotate: arrowRotate }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          )}
        </div>
      </motion.div>

      {/* Content shifts down while pulling */}
      <motion.div style={{ y: contentY }}>
        {children}
      </motion.div>
    </div>
  );
}

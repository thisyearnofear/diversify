import React from "react";
import { motion, Variants, AnimatePresence } from "framer-motion";

interface RobinMascotProps {
  className?: string;
  action?: "idle" | "happy" | "thinking" | "buying" | "selling";
}

/**
 * RobinMascot Component
 *
 * A fun "Robin in a Hoodie" mascot for the Robinhood Chain integration.
 * Implements a clean, minimalist SVG design that aligns with DiversiFi's
 * aesthetic while giving a nod to the Robinhood brand.
 */
export const RobinMascot: React.FC<RobinMascotProps> = ({
  className = "",
  action = "idle",
}) => {
  // Animation variants for different states
  const bodyVariants: Variants = {
    idle: {
      y: [0, -4, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
    happy: {
      scale: [1, 1.05, 1],
      transition: { duration: 0.5, repeat: Infinity },
    },
    thinking: {
      rotate: [-2, 2, -2],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
    },
  };

  const wingVariants: Variants = {
    idle: {
      rotate: [0, -5, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
    },
    happy: {
      rotate: [-20, 20, -20],
      transition: { duration: 0.3, repeat: Infinity },
    },
  };

  const hoodieColor =
    action === "buying"
      ? "#22c55e"
      : action === "selling"
        ? "#ef4444"
        : "#3b82f6";

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <motion.svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={
          action === "happy"
            ? "happy"
            : action === "thinking"
              ? "thinking"
              : "idle"
        }
        variants={bodyVariants}
      >
        {/* Shadow */}
        <ellipse
          cx="60"
          cy="110"
          rx="30"
          ry="5"
          fill="black"
          fillOpacity="0.05"
        />

        {/* Hoodie Body */}
        <rect x="35" y="50" width="50" height="45" rx="15" fill={hoodieColor} />

        {/* Robin Face / Chest (Red/Orange breast) */}
        <circle cx="60" cy="65" r="22" fill="#FF5733" />
        <circle cx="60" cy="60" r="20" fill="white" fillOpacity="0.1" />

        {/* Eyes */}
        <motion.g
          animate={action === "happy" ? { scaleY: [1, 0.2, 1] } : {}}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <circle cx="52" cy="60" r="2.5" fill="#1F2937" />
          <circle cx="68" cy="60" r="2.5" fill="#1F2937" />
        </motion.g>

        {/* Beak */}
        <path d="M57 65L60 70L63 65H57Z" fill="#FBBF24" />

        {/* Hoodie Hood */}
        <path
          d="M35 60C35 40 45 30 60 30C75 30 85 40 85 60"
          stroke={hoodieColor}
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Hoodie Drawstrings */}
        <line
          x1="55"
          y1="85"
          x2="55"
          y2="95"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="65"
          y1="85"
          x2="65"
          y2="95"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="55" cy="97" r="2" fill="white" />
        <circle cx="65" cy="97" r="2" fill="white" />

        {/* Wings (Sleeves) */}
        <motion.path
          d="M35 70L25 80"
          stroke={hoodieColor}
          strokeWidth="10"
          strokeLinecap="round"
          variants={wingVariants}
        />
        <motion.path
          d="M85 70L95 80"
          stroke={hoodieColor}
          strokeWidth="10"
          strokeLinecap="round"
          variants={wingVariants}
        />
      </motion.svg>

      {/* Bubble Speech for interaction feedback */}
      <AnimatePresence>
        {action !== "idle" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-4 -right-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-2xl px-3 py-1.5 z-10"
          >
            <span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-tighter">
              {action === "buying" && "To the moon! 🚀"}
              {action === "selling" && "Taking gains! 💎"}
              {action === "happy" && "Great trade! ✨"}
              {action === "thinking" && "Analyzing... 📊"}
            </span>
            <div className="absolute -bottom-1 left-4 w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-100 dark:border-gray-700 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RobinMascot;

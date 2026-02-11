import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TooltipProps {
    children: React.ReactNode;
    content: string;
    side?: "top" | "bottom" | "left" | "right";
    className?: string;
}

/**
 * Accessible tooltip component for explaining crypto jargon
 * Works on hover (desktop) and tap (mobile)
 */
export function Tooltip({ children, content, side = "top", className = "" }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        setIsMobile("ontouchstart" in window);
    }, []);

    const showTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(true);
    };

    const hideTooltip = () => {
        if (isMobile) {
            timeoutRef.current = setTimeout(() => setIsVisible(false), 2000);
        } else {
            setIsVisible(false);
        }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (isMobile) {
            e.preventDefault();
            setIsVisible(!isVisible);
        }
    };

    const sideStyles = {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
    };

    return (
        <span
            className={`relative inline-flex items-center ${className}`}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onClick={handleClick}
        >
            <span className="border-b border-dashed border-gray-400 dark:border-gray-500 cursor-help">
                {children}
            </span>

            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute z-50 ${sideStyles[side]} pointer-events-none`}
                        role="tooltip"
                        aria-live="polite"
                    >
                        <div className="bg-gray-900 dark:bg-gray-800 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-xl border border-gray-700 max-w-[200px] whitespace-normal">
                            {content}
                            <div
                                className={`absolute size-2 bg-gray-900 dark:bg-gray-800 border-gray-700 rotate-45 ${side === "top"
                                        ? "bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r"
                                        : side === "bottom"
                                            ? "top-[-4px] left-1/2 -translate-x-1/2 border-t border-l"
                                            : side === "left"
                                                ? "right-[-4px] top-1/2 -translate-y-1/2 border-t border-r"
                                                : "left-[-4px] top-1/2 -translate-y-1/2 border-b border-l"
                                    }`}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </span>
    );
}

// Common crypto term tooltips
export const TOOLTIPS = {
    stablecoin: "A cryptocurrency designed to maintain a stable value, usually pegged to a currency like USD",
    rwa: "Real World Assets - Physical assets like gold or bonds that are tokenized on blockchain",
    slippage: "The difference between expected and actual price due to market movement during your transaction",
    apy: "Annual Percentage Yield - The yearly return on your investment including compound interest",
    chain: "A blockchain network like Celo or Arbitrum where transactions are processed",
    swap: "Exchange one cryptocurrency for another instantly",
    liquidity: "How easily an asset can be bought or sold without affecting its price",
    yield: "The earnings generated from holding or staking an asset",
    diversification: "Spreading investments across different assets to reduce risk",
    inflation: "The rate at which the purchasing power of money decreases over time",
} as const;

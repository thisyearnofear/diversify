import { useState, useEffect, useRef } from "react";
import { motion, useInView, Variants } from "framer-motion";
import type { ReactNode } from "react";

// ============================================================================
// ANIMATION UTILITIES
// Following Core Principles: DRY, MODULAR, PERFORMANT
// Single source of truth for all shared animation logic
// ============================================================================

interface UseAnimatedNumberOptions {
  duration?: number; // Animation duration in seconds
  decimals?: number; // Number of decimal places
  startOnMount?: boolean; // Whether to start animation immediately
}

/**
 * useAnimatedNumber - Reusable hook for count-up animations
 * 
 * @example
 * const displayValue = useAnimatedNumber(actualValue, { duration: 0.8 });
 */
export function useAnimatedNumber(
  targetValue: number,
  options: UseAnimatedNumberOptions = {}
): number {
  const { duration = 0.8, decimals = 0, startOnMount = true } = options;
  const [displayValue, setDisplayValue] = useState(startOnMount ? 0 : targetValue);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    if (!startOnMount) return;

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // easeOutCubic easing
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValueRef.current + (targetValue - startValueRef.current) * eased;
      
      setDisplayValue(Number(currentValue.toFixed(decimals)));

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
  }, [targetValue, duration, decimals, startOnMount]);

  return displayValue;
}

/**
 * useAnimatedString - For formatted currency values with prefixes/suffixes
 * 
 * @example
 * const displayValue = useAnimatedString(totalValue, "$", { decimals: 0 });
 * // Returns: "$1,234" as the number animates
 */
export function useAnimatedString(
  targetValue: number,
  prefix: string = "",
  suffix: string = "",
  options: UseAnimatedNumberOptions = {}
): string {
  const animatedValue = useAnimatedNumber(targetValue, options);
  return `${prefix}${animatedValue.toLocaleString()}${suffix}`;
}

// ============================================================================
// SCROLL-TRIGGERED ANIMATION COMPONENTS
// ============================================================================

interface AnimateOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  duration?: number;
  once?: boolean;
  threshold?: number;
}

/**
 * AnimateOnScroll - Wrapper component for scroll-triggered fade/slide animations
 * 
 * @example
 * <AnimateOnScroll direction="up" delay={0.2}>
 *   <Card>Content</Card>
 * </AnimateOnScroll>
 */
export function AnimateOnScroll({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance = 20,
  duration = 0.5,
  once = true,
  threshold = 0.1,
}: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const directionMap = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    none: { x: 0, y: 0 },
  };

  const offset = directionMap[direction];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      x: offset.x,
      y: offset.y,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: {
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1], // cubic-bezier ease-out
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer - Animates children with staggered delays
 * 
 * @example
 * <StaggerContainer staggerDelay={0.1}>
 *   {items.map(item => <Card key={item.id}>{item.content}</Card>)}
 * </StaggerContainer>
 */
interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  once?: boolean;
  threshold?: number;
}

export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.08,
  once = true,
  threshold = 0.1,
}: StaggerContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={containerVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1],
    },
  },
};

// ============================================================================
// INTERACTIVE FEEDBACK UTILITIES
// ============================================================================

/**
 * pressableMotion - Reusable press animation props for buttons/cards
 * 
 * @example
 * <motion.button {...pressableMotion} className="...">
 *   Click me
 * </motion.button>
 */
export const pressableMotion = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.02 },
  transition: { type: "spring", stiffness: 400, damping: 17 },
};

/**
 * liftableMotion - For cards that lift on hover
 * 
 * @example
 * <motion.div {...liftableMotion} className="...">
 *   Card content
 * </motion.div>
 */
export const liftableMotion = {
  whileHover: { 
    y: -4, 
    boxShadow: "0 12px 24px rgba(0,0,0,0.1)",
    transition: { type: "spring", stiffness: 300, damping: 20 }
  },
  whileTap: { scale: 0.98 },
};

// ============================================================================
// LOADING/PULSE ANIMATIONS
// ============================================================================

/**
 * shimmerAnimation - CSS-in-JSX shimmer for loading states
 * Can be applied to buttons or cards during loading
 */
export const shimmerStyle = {
  background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s infinite",
} as const;

// Keyframes to add to global CSS or style tag:
// @keyframes shimmer {
//   0% { background-position: -200% 0; }
//   100% { background-position: 200% 0; }
// }

// ============================================================================
// TAB PULSE INDICATOR
// ============================================================================

interface TabPulseOptions {
  hasAction?: boolean;
  urgency?: "low" | "medium" | "high";
}

/**
 * useTabPulse - Returns animation props for tab icons with pending actions
 * 
 * @example
 * const pulseProps = useTabPulse({ hasAction: canClaim, urgency: "high" });
 * <motion.div {...pulseProps}><TabIcon /></motion.div>
 */
export function useTabPulse({ hasAction = false, urgency = "medium" }: TabPulseOptions = {}) {
  if (!hasAction) return {};

  const pulseConfigs = {
    low: { scale: [1, 1.03, 1], duration: 3 },
    medium: { scale: [1, 1.05, 1], duration: 2 },
    high: { scale: [1, 1.1, 1], duration: 1.5 },
  };

  const config = pulseConfigs[urgency];

  return {
    animate: { scale: config.scale },
    transition: {
      repeat: Infinity,
      duration: config.duration,
      ease: "easeInOut",
    },
  };
}

// ============================================================================
// NUMBER FORMATTING UTILITIES
// ============================================================================

/**
 * formatCurrency - Consistent currency formatting across the app
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * formatPercentage - Consistent percentage formatting
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

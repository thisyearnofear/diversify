/**
 * AnimatedNumber — count-up number animation for visceral data display.
 *
 * Wraps the existing useAnimatedNumber hook in a render-friendly
 * component. Numbers count from 0 to their target value on mount,
 * making depreciation percentages and counterfactual values feel
 * like a punch rather than a static fact.
 *
 * Inspired by transitions.dev "number pop-in" pattern.
 */

import React from 'react';
import { useAnimatedNumber } from '@/hooks/use-animation';

interface AnimatedNumberProps {
  value: number;
  /** Decimal places (default: 0) */
  decimals?: number;
  /** Prefix (e.g., "$", "-") */
  prefix?: string;
  /** Suffix (e.g., "%") */
  suffix?: string;
  /** Animation duration in seconds (default: 1.2) */
  duration?: number;
  /** Font size class for the number */
  className?: string;
  /** Delay before animation starts (ms) */
  delay?: number;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1.2,
  className = '',
  delay = 0,
}: AnimatedNumberProps) {
  const displayValue = useAnimatedNumber(value, { duration, decimals, startOnMount: true });

  // Apply delay by starting at 0 and switching after the delay
  const [showValue, setShowValue] = React.useState(delay > 0 ? 0 : displayValue);

  React.useEffect(() => {
    if (delay <= 0) {
      setShowValue(displayValue);
      return;
    }
    const timer = setTimeout(() => setShowValue(displayValue), delay);
    return () => clearTimeout(timer);
  }, [delay, displayValue]);

  const formatted = showValue.toFixed(decimals);
  const sign = value < 0 && !prefix ? '-' : '';

  return (
    <span className={className}>
      {prefix}{sign}{Math.abs(parseFloat(formatted)).toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}

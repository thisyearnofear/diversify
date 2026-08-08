import { useState, useEffect, useRef } from 'react';

interface UseAnimatedCounterOptions {
  /** Target value to animate to */
  target: number;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Delay before animation starts */
  delay?: number;
  /** Easing function: 'linear' | 'easeOut' | 'easeInOut' */
  easing?: 'linear' | 'easeOut' | 'easeInOut';
  /** Number of decimal places */
  decimals?: number;
  /** Whether to start animation immediately */
  autoStart?: boolean;
}

interface UseAnimatedCounterReturn {
  /** Current animated value */
  value: number;
  /** Formatted value as string */
  formattedValue: string;
  /** Whether animation is complete */
  isComplete: boolean;
  /** Restart the animation */
  restart: () => void;
}

/**
 * Hook for animating a number from 0 to target value
 * 
 * @example
 * const { formattedValue, isComplete } = useAnimatedCounter({ 
 *   target: 100, 
 *   duration: 800,
 *   easing: 'easeOut'
 * });
 */
export function useAnimatedCounter({
  target,
  duration = 1000,
  delay = 0,
  easing = 'easeOut',
  decimals = 0,
  autoStart = true,
}: UseAnimatedCounterOptions): UseAnimatedCounterReturn {
  const [value, setValue] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [key, setKey] = useState(0); // Used to trigger restart
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!autoStart) return;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      
      // Handle delay
      if (elapsed < delay) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min((elapsed - delay) / duration, 1);
      
      // Apply easing
      let easedProgress: number;
      switch (easing) {
        case 'easeOut':
          easedProgress = 1 - Math.pow(1 - progress, 3);
          break;
        case 'easeInOut':
          easedProgress = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          break;
        case 'linear':
        default:
          easedProgress = progress;
      }

      const currentValue = easedProgress * target;
      setValue(currentValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
        setIsComplete(true);
      }
    };

    // Reset state
    setValue(0);
    setIsComplete(false);
    startTimeRef.current = null;
    
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, delay, easing, key, autoStart]);

  const formattedValue = value.toFixed(decimals);

  const restart = () => {
    setKey(prev => prev + 1);
  };

  return {
    value,
    formattedValue,
    isComplete,
    restart,
  };
}

export default useAnimatedCounter;

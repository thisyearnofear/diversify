import React, { useState, useEffect, useRef, useCallback } from 'react';

interface UseInViewOptions {
  /** Root margin for intersection observer (default: '200px' for early loading) */
  rootMargin?: string;
  /** Threshold for intersection (default: 0.1) */
  threshold?: number;
  /** Whether to stop observing once visible (default: true for performance) */
  triggerOnce?: boolean;
}

/**
 * Hook to detect if an element is visible in the viewport.
 * Uses Intersection Observer for performance-efficient lazy loading.
 * 
 * @example
 * const { ref, inView } = useInView();
 * 
 * return (
 *   <div ref={ref}>
 *     {inView && <HeavyComponent />}
 *   </div>
 * );
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: UseInViewOptions = {}
) {
  const { rootMargin = '200px', threshold = 0.1, triggerOnce = true } = options;
  const [inView, setInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Skip if already triggered once
    if (triggerOnce && hasBeenInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        setInView(isVisible);
        
        if (isVisible && triggerOnce) {
          setHasBeenInView(true);
          observer.unobserve(element);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [rootMargin, threshold, triggerOnce, hasBeenInView]);

  // If triggerOnce and has been in view, always return true
  const isInView = triggerOnce && hasBeenInView ? true : inView;

  return { ref, inView: isInView, hasBeenInView };
}

/**
 * Wrapper component for lazy loading heavy components.
 * Renders a placeholder until the component is visible.
 * 
 * @example
 * <LazyLoad placeholder={<Skeleton className="h-64" />}>
 *   <HeavyChart />
 * </LazyLoad>
 */
interface LazyLoadProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  className?: string;
  rootMargin?: string;
}

export function LazyLoad({ 
  children, 
  placeholder = null, 
  className = '',
  rootMargin = '200px'
}: LazyLoadProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin, triggerOnce: true });

  return (
    <div ref={ref} className={className}>
      {inView ? children : placeholder}
    </div>
  );
}

export default useInView;

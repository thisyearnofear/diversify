/**
 * useAnalytics — Lightweight event tracking for user flow insights.
 *
 * CLEAN: Single place for all analytics events.
 * DRY: One hook used across components.
 * PERFORMANT: No-op in production unless ANALYTICS_ENABLED is set.
 *
 * Usage:
 *   const { track } = useAnalytics();
 *   track('tab_change', { from: 'overview', to: 'exchange' });
 */

interface AnalyticsEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
  timestamp: number;
}

const QUEUE: AnalyticsEvent[] = [];
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_QUEUE_SIZE = 50;

// PERFORMANT: Batch events and flush periodically
let flushTimer: ReturnType<typeof setInterval> | null = null;

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    if (QUEUE.length === 0) return;
    const batch = QUEUE.splice(0, MAX_QUEUE_SIZE);
    // In production, this would POST to an analytics endpoint
    // For now, we log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Analytics]', batch);
    }
    // Future: fetch('/api/analytics', { method: 'POST', body: JSON.stringify(batch) })
  }, FLUSH_INTERVAL);
}

export function useAnalytics() {
  const track = (event: string, properties?: Record<string, string | number | boolean>) => {
    const entry: AnalyticsEvent = {
      event,
      properties: {
        ...properties,
        // DRY: Always include session context
        url: typeof window !== 'undefined' ? window.location.pathname : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) : '',
      },
      timestamp: Date.now(),
    };

    QUEUE.push(entry);
    ensureFlushTimer();

    // Immediate console log in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${event}`, properties || '');
    }
  };

  // Convenience methods for common events
  const trackTabChange = (from: string, to: string) => {
    track('tab_change', { from, to });
  };

  const trackOnboardingStep = (step: string, action: 'view' | 'complete' | 'skip') => {
    track('onboarding_step', { step, action });
  };

  const trackSwapInitiated = (fromToken: string, toToken: string, amount: string) => {
    track('swap_initiated', { fromToken, toToken, amount });
  };

  const trackDeepLink = (params: Record<string, string>) => {
    track('deep_link_used', params);
  };

  // UX interaction events for the new clarity features (added 2026-06)
  const trackChainPillSwitch = (fromChain: string, toChain: string) => {
    track('chainpill_switch', { fromChain, toChain });
  };

  const trackTooltipView = (label: string) => {
    track('tooltip_view', { label });
  };

  const trackAssetDetailsToggle = (open: boolean) => {
    track('asset_details_toggle', { open: open ? 'true' : 'false' });
  };

  const trackRegimeTip = (regime: string, stableRatio: number) => {
    track('regime_tip', { regime, stableRatio: stableRatio.toFixed(3) });
  };

  const trackHeroTap = (label: string) => {
    track('hero_tap', { label });
  };

  return {
    track,
    trackTabChange,
    trackOnboardingStep,
    trackSwapInitiated,
    trackDeepLink,
    trackChainPillSwitch,
    trackTooltipView,
    trackAssetDetailsToggle,
    trackRegimeTip,
    trackHeroTap,
  };
}
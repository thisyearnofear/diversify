/**
 * useShareLanding — attribution for the shared cards (pair / moment / plan).
 *
 * Deep links carry `src=pair_card|moment_card|plan_card`. Mounted once in
 * TabContentRouter beside the ?tab= effect: when the router is ready and
 * `src` is an allowed value, fire `share_landed` once per session per
 * source and stash the landing's subject ({source, subject}) under
 * `diversifi.share.landing` so a later settle can claim it. Only `src` is
 * stripped from the URL (shallow) — the other params stay so each tab's
 * own one-shot query effects still see them. Demo views never fire.
 */
import { useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { DemoModeContext } from '@/context/app/DemoModeContext';
import { trackFunnelEvent } from '@/lib/analytics';

export const SHARE_SOURCES = ['pair_card', 'moment_card', 'plan_card'] as const;
export type ShareSource = (typeof SHARE_SOURCES)[number];

const STORAGE_KEY = 'diversifi.share.landing';
const LANDED_KEY = 'diversifi.share.landed';

interface ShareLanding {
  source: ShareSource;
  subject: string | null;
}

function isShareSource(v: string): v is ShareSource {
  return (SHARE_SOURCES as readonly string[]).includes(v);
}

function readLanded(): ShareSource[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(LANDED_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isShareSource) : [];
  } catch {
    return [];
  }
}

function storeLanding(landing: ShareLanding): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(landing));
  } catch {
    // private mode — attribution just doesn't persist
  }
}

function subjectFor(source: ShareSource, query: Record<string, unknown>): string | null {
  if (source === 'pair_card') {
    const { from, to } = query;
    return typeof from === 'string' && typeof to === 'string'
      ? `${from}/${to}`
      : null;
  }
  if (source === 'moment_card') {
    const c = query.currency;
    return typeof c === 'string' ? c.toUpperCase() : null;
  }
  const p = query.plan;
  return typeof p === 'string' ? p : null;
}

/** The stored share landing's subject for a source, or null — read by the
 *  settle paths (pair receipt / plan commit) to fire share_settled. */
export function shareLandingFor(source: ShareSource): string | null {
  try {
    const parsed = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as ShareLanding | null;
    return parsed?.source === source ? parsed.subject : null;
  } catch {
    return null;
  }
}

export function useShareLanding(): void {
  const router = useRouter();
  // Soft read — no provider means no demo state, so nothing is gated.
  const demoMode = useContext(DemoModeContext)?.demoMode;

  useEffect(() => {
    if (!router.isReady || demoMode?.isActive) return;
    const src = router.query.src;
    if (typeof src !== 'string' || !isShareSource(src)) return;

    storeLanding({ source: src, subject: subjectFor(src, router.query) });
    const landed = readLanded();
    if (!landed.includes(src)) {
      try {
        sessionStorage.setItem(LANDED_KEY, JSON.stringify([...landed, src]));
      } catch {
        // non-persistent — still fires once this page life
      }
      trackFunnelEvent('share_landed', { source: src });
    }

    // Strip only src — the tab params (from/to/currency/plan) are each
    // tab's own one-shot contract and must survive.
    const { src: _strip, ...rest } = router.query;
    void router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
    });
    // One-shot URL consumption — like the ?tab= effect beside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, demoMode?.isActive]);
}

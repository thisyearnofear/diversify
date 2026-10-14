/**
 * SignInPrimer — "What happens when I sign in?", one quiet link beside the
 * sign-in button. The button stays one tap; this is the grounding for the
 * visitor who wants to know first. Every line traces to the trust model
 * (docs/guardian.md): non-custodial, user-approved moves, opt-in memory,
 * and a plan that lives on this device.
 */
import React from 'react';
import { InspectorSheet } from '../../shared/InspectorSheet';
import { WALLET_FEATURES } from '../../../config/features';

export function SignInPrimer() {
  const [open, setOpen] = React.useState(false);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  // The sheet opens below the link, usually under the dock on a phone —
  // bring it into the viewport so the tap visibly answers.
  React.useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sheetRef.current?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }, [open]);
  const emailAvailable = Boolean(WALLET_FEATURES.PRIVY_ENABLED && WALLET_FEATURES.PRIVY_APP_ID);
  const points: Array<{ title: string; body: string }> = [
    {
      title: 'Your wallet, not ours',
      body: emailAvailable
        ? 'Sign in with email or a social account and a wallet is created for you, or connect one you already have. Your savings stay in that wallet. DiversiFi holds nothing.'
        : 'Connect a wallet you already have. Your savings stay in that wallet. DiversiFi holds nothing.',
    },
    {
      title: 'Nothing moves without you',
      body: 'Guardian proposes. You approve each move yourself before anything happens.',
    },
    {
      title: 'What you chose here comes with you',
      body: 'Your plan and country choices are stored on this device and are waiting when you sign in.',
    },
    {
      title: 'Memory is opt-in',
      body: 'Guardian remembers only what you ask it to remember.',
    },
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="link-quiet mx-auto mt-2 block min-h-tap"
      >
        What happens when I sign in?
      </button>
      <div ref={sheetRef}>
      <InspectorSheet
        selectedId={open ? 'sign-in' : null}
        onClose={() => setOpen(false)}
        title="Signing in"
      >
        <ul className="space-y-3 text-left" data-testid="sign-in-primer">
          {points.map((p) => (
            <li key={p.title}>
              <p className="text-sm font-semibold text-ink">{p.title}</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </InspectorSheet>
      </div>
    </>
  );
}

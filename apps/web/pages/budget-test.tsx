// Dev-only runtime check for the Guardian budget channel — not shipped.
// Exercises the foundry read (machined metal in a ghost channel), hallmark
// positions, the over-limit clamp, and the masked state.
//
// Theme and masking are page-level, because both are root-scoped: `dark`
// lives on <html> and the money tokens resolve from it, so a nested .dark
// div paints a white card with white ink. Toggle and re-shoot.
import React, { useEffect, useState } from 'react';
import { GuardianBudgetBar } from '../components/agent/GuardianBudgetBar';
import { GuardianBoundsSheet } from '../components/agent/GuardianBoundsSheet';
import { GuardianPermissionModal } from '../components/agent/GuardianPermissionModal';
import InspectorSheet from '../components/shared/InspectorSheet';
import { useBalanceVisibility } from '../context/app/BalanceVisibilityContext';
import type { GuardianSessionInfo } from '../hooks/use-session-key';

const executions = (amounts: number[]): GuardianSessionInfo['recentExecutions'] =>
  amounts.map((amountUSD, index) => ({
    txHash: `0xfixture${index}`,
    action: 'rebalance',
    tokenIn: 'USDC',
    tokenOut: 'NGNm',
    amountUSD,
    timestamp: Date.now() - (amounts.length - index) * 3_600_000,
    status: 'confirmed',
  }));

const STATES = [
  { label: 'Fresh day — nothing spent', spent: 0, limit: 500, amounts: [] as number[] },
  { label: 'Two moves landed', spent: 175, limit: 500, amounts: [75, 100] },
  { label: 'Four moves, nearly out of room', spent: 460, limit: 500, amounts: [120, 90, 150, 100] },
  { label: 'Over the cap (clamped)', spent: 640, limit: 500, amounts: [300, 340] },
  { label: 'Unattributable spend — no hallmarks', spent: 250, limit: 500, amounts: [90] },
];

function Controls() {
  const { hidden, toggle } = useBalanceVisibility();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setDark((d) => !d)}
        className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
      >
        {dark ? 'Light' : 'Dark'}
      </button>
      <button
        type="button"
        onClick={toggle}
        className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
      >
        {hidden ? 'Show figures' : 'Hide figures'}
      </button>
    </div>
  );
}

// The bar in the room it actually lives in — the real Limits inspector, so
// the composition (not just the component) can be judged at both widths.
function SheetBoard() {
  const [open, setOpen] = useState(true);
  const amounts = [120, 90, 150];
  const spent = amounts.reduce((total, amount) => total + amount, 0);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
      >
        {open ? 'Close limits' : 'Open limits'}
      </button>
      <InspectorSheet
        selectedId={open ? 'limits' : null}
        onClose={() => setOpen(false)}
        title="Limits & controls"
      >
        <GuardianBoundsSheet
          hasValidPermission
          dailyLimit={500}
          sessionInfo={
            {
              active: true,
              dailyLimitUSD: 500,
              spentTodayUSD: spent,
              remainingTodayUSD: 500 - spent,
              executionCount: amounts.length,
              recentExecutions: executions(amounts),
            } as unknown as GuardianSessionInfo
          }
          permissionExpiry="10/4/2026"
          isRunningLoop={false}
          onRunNow={() => {}}
          loopResult={null}
          sessionKeyError={null}
          isRevoking={false}
          onRevoke={() => {}}
          onSetLimit={() => {}}
          vault={{ vault: { strategy: 'africapitalism' } } as never}
          onEditPlanInShield={() => {}}
          walletStableBalanceUSD={400}
          isOnGrantEligibleChain
          grantAvailable
          grantStatus="idle"
          grantError={null}
          onOpenGrantModal={() => {}}
          onSwitchToGrantChain={() => {}}
          onOpenSettings={() => {}}
        />
      </InspectorSheet>
    </div>
  );
}

// The permission modal is the other half of this sheet's story: it is where
// the single action hue has to read as "the one thing to press". Prop-driven,
// so it mounts here without a wallet.
function PermissionBoard() {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(300);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
      >
        Open permission modal
      </button>
      {open ? (
        <GuardianPermissionModal
          pendingDailyLimit={limit}
          setPendingDailyLimit={setLimit}
          DAILY_LIMIT_PRESETS={[50, 100, 300, 500, 1000]}
          isChainSupported
          isLowOnFunds={false}
          hasNonStableButNoStable={false}
          nonStableBalanceOnChain={0}
          currentChainName="Celo"
          stableBalanceTotal={1240}
          portfolioLoading={false}
          switchToChain={() => {}}
          onCancel={() => setOpen(false)}
          onApprove={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function BudgetTest() {
  return (
    <main className="mx-auto max-w-md p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-lg font-black text-ink">Guardian budget channel</h1>
        <Controls />
      </header>

      <LiveBoard />

      <SheetBoard />

      <PermissionBoard />

      <div className="rounded-2xl border border-line bg-surface-raised p-6 space-y-7">
        {STATES.map((state) => (
          <div key={state.label} className="space-y-1.5">
            <p className="text-3xs text-ink-subtle">{state.label}</p>
            <GuardianBudgetBar
              spentTodayUSD={state.spent}
              dailyLimitUSD={state.limit}
              remainingTodayUSD={Math.max(0, state.limit - state.spent)}
              executions={executions(state.amounts)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}

// The static boards above are mounted already-old, so they never strike.
// This one is watched live: press it and the metal settles, then the hallmark
// is punched in front of you.
function LiveBoard() {
  const [amounts, setAmounts] = useState<number[]>([120]);
  const limit = 500;
  const spent = amounts.reduce((total, amount) => total + amount, 0);

  return (
    <div className="rounded-2xl border border-line bg-surface-raised p-6 space-y-3">
      <p className="text-3xs text-ink-subtle">Live — press to land a move</p>
      <GuardianBudgetBar
        spentTodayUSD={spent}
        dailyLimitUSD={limit}
        remainingTodayUSD={Math.max(0, limit - spent)}
        executions={executions(amounts)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAmounts((a) => [...a, 90])}
          className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
        >
          Move 90
        </button>
        <button
          type="button"
          onClick={() => setAmounts([120])}
          className="min-h-tap rounded-xl border border-line px-3 text-2xs font-bold text-ink"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

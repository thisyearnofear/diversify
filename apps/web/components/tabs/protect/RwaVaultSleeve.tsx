/**
 * RwaVaultSleeve — inspector body for Shield's tokenized-asset lens.
 *
 * Two tiers, in order of what the user can actually do:
 *   1. Hold in your wallet — USDY, syrupUSDC, PAXG on Arbitrum. Each row
 *      carries its plan/held share and a live figure (APY or price, sourced
 *      and timed — absent when the provider is down, never a default).
 *      Tapping a row unfolds the curated provenance (backing, keys, source).
 *   2. Licensed vaults, off-app — the IXS catalog as an advisory allocation
 *      for a dollar reserve. The SERV "deeper allocation" rail lives here.
 *      Deposits and KYC happen on IXS; nothing executes from this section.
 *
 * One CTA: review a move into the plan's tokenized leg (or connect).
 */
import React from 'react';
import { IXS_VAULT_BY_ID } from '@diversifi/shared/src/services/serv/ixs-vault-catalog';
import type { ServReceipt, VaultAllocation } from '@diversifi/shared/src/services/serv/rwa-allocator';
import type { RwaMarket, RwaMarketFigure } from '@diversifi/shared/src/services/rwa-market-service';
import { provenanceFor } from '@diversifi/shared/src/constants/token-provenance';
import { TokenIcon } from '../../shared/TokenIcon';
import { useBalanceVisibility } from '@/context/app/BalanceVisibilityContext';
import { RWA_ASSETS, excludedByLens, type RwaAsset } from './rwa-assets';
import { isSwapRoutable } from '@/constants/unroutable-swap-tokens';

interface Props {
  allocations: VaultAllocation[];
  summary: string;
  source: 'heuristic' | 'serv';
  loading: boolean;
  degradedReason?: string;
  receipt?: ServReceipt;
  servOn: boolean;
  onToggleServ: (on: boolean) => void;
  /** IXS vault in focus, or null. */
  focusedVaultId: string | null;
  onSelectVault: (id: string | null) => void;
  /** Plan target % by canonical symbol (plan legs). */
  planPctBySymbol?: Record<string, number>;
  /** Held % of wallet by canonical symbol. */
  heldPctBySymbol?: Record<string, number>;
  totalValue?: number;
  /** Active values lens — 'islamic' flags interest-bearing assets. */
  philosophy?: string | null;
  market?: RwaMarket;
  /** Connected: open the swap ticket for this asset. */
  onReviewMove?: (symbol: string) => void;
  /** Walletless: the connect button, rendered as the one CTA. */
  walletCta?: React.ReactNode;
}

function lookup(map: Record<string, number> | undefined, symbol: string): number {
  if (!map) return 0;
  const key = Object.keys(map).find((k) => k.toUpperCase() === symbol.toUpperCase());
  return key ? map[key] : 0;
}

function formatFigure(f: RwaMarketFigure): string {
  return f.kind === 'apy'
    ? `${f.value.toFixed(2)}% APY`
    : `$${Math.round(f.value).toLocaleString()} / oz`;
}

function formatAge(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function HoldableRow({
  asset,
  planPct,
  heldPct,
  totalValue,
  excluded,
  routable,
  figure,
  open,
  onToggle,
}: {
  asset: RwaAsset;
  planPct: number;
  heldPct: number;
  totalValue: number;
  excluded: boolean;
  routable: boolean;
  figure: RwaMarketFigure | null;
  open: boolean;
  onToggle: () => void;
}) {
  const provenance = provenanceFor(asset.symbol);
  // Held $ derives from the user's balance — honours the privacy mask.
  // (The market figure in formatFigure stays unmasked: price, not balance.)
  const { formatMoney } = useBalanceVisibility();
  const share =
    heldPct > 0
      ? `${Math.round(heldPct)}% held${totalValue > 0 ? ` · ${formatMoney((heldPct / 100) * totalValue)}` : ''}`
      : planPct > 0
        ? `${planPct}% of your plan`
        : 'not in your plan';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      data-testid={`rwa-row-${asset.symbol}`}
      className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
        open
          ? 'bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
      } ${excluded ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <TokenIcon symbol={asset.symbol} size={24} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {asset.symbol}
            <span className="ml-1.5 text-2xs font-normal text-gray-500 dark:text-gray-400">
              {provenance?.phrase ?? asset.kind}
            </span>
          </p>
          <p className="text-2xs text-gray-500 dark:text-gray-400">
            {excluded
              ? 'Interest-bearing — outside this lens'
              : routable
                ? share
                : `${share} · no swap route right now`}
          </p>
        </div>
        {figure && (
          <p
            data-testid={`rwa-figure-${asset.symbol}`}
            className="text-xs font-bold text-gray-900 dark:text-white tabular-nums shrink-0"
          >
            {formatFigure(figure)}
          </p>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-1 pl-[34px]">
          {provenance && (
            <>
              <p className="text-2xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {provenance.backing}.
              </p>
              <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {provenance.keys}.
              </p>
            </>
          )}
          <p className="text-3xs text-gray-400 dark:text-gray-500">
            {asset.kind} · {asset.chain}
            {figure && ` · ${figure.source}, ${formatAge(figure.capturedAt)}`}
            {provenance && ` · issuer facts checked ${provenance.asOf}`}
          </p>
        </div>
      )}
    </button>
  );
}

function VaultRow({
  allocation,
  focused,
  onSelect,
}: {
  allocation: VaultAllocation;
  focused: boolean;
  onSelect: () => void;
}) {
  const vault = IXS_VAULT_BY_ID[allocation.vaultId];
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`vault-row-${allocation.vaultId}`}
      aria-pressed={focused}
      className={`w-full rounded-lg px-2.5 py-1.5 text-left transition-colors ${
        focused
          ? 'bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
          {vault?.name ?? allocation.vaultId}
        </p>
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0 tabular-nums">
          {allocation.weightPct}%
        </p>
      </div>
      <div className="mt-1 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gray-400/70 dark:bg-gray-500/70"
          style={{ width: `${allocation.weightPct}%` }}
        />
      </div>
      {focused && (
        <div className="mt-1.5 space-y-1">
          <p className="text-2xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {allocation.why}
          </p>
          {vault && (
            <p className="text-2xs text-gray-400 dark:text-gray-500">
              {vault.indicativeApyLow}–{vault.indicativeApyHigh}% indicative · {vault.liquidity} ·
              KYC at IXS
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export function RwaVaultSleeve({
  allocations,
  summary,
  source,
  loading,
  degradedReason,
  receipt,
  servOn,
  onToggleServ,
  focusedVaultId,
  onSelectVault,
  planPctBySymbol,
  heldPctBySymbol,
  totalValue = 0,
  philosophy = null,
  market,
  onReviewMove,
  walletCta,
}: Props) {
  const [openSymbol, setOpenSymbol] = React.useState<string | null>(null);

  // In-plan and held assets lead; lens-excluded ones sink to the bottom.
  const rows = React.useMemo(
    () =>
      RWA_ASSETS.map((asset, i) => {
        const planPct = lookup(planPctBySymbol, asset.symbol);
        const heldPct = lookup(heldPctBySymbol, asset.symbol);
        const excluded = excludedByLens(asset, philosophy);
        const routable = isSwapRoutable(asset.symbol, asset.chainId);
        return { asset, planPct, heldPct, excluded, routable, i };
      }).sort(
        (a, b) =>
          Number(a.excluded) - Number(b.excluded) ||
          Math.max(b.planPct, b.heldPct) - Math.max(a.planPct, a.heldPct) ||
          a.i - b.i,
      ),
    [planPctBySymbol, heldPctBySymbol, philosophy],
  );

  // The CTA's target: the in-plan leg furthest from its target, else the
  // first asset this lens allows — never one the app can't route to.
  const target = React.useMemo(() => {
    const allowed = rows.filter((r) => !r.excluded && r.routable);
    const gaps = allowed
      .filter((r) => r.planPct > 0)
      .sort((a, b) => b.planPct - b.heldPct - (a.planPct - a.heldPct));
    return (gaps[0] ?? allowed[0])?.asset.symbol ?? null;
  }, [rows]);

  const planRwaPct = rows.reduce((sum, r) => sum + r.planPct, 0);

  return (
    <div className="space-y-4" data-testid="rwa-vault-sleeve">
      <section className="space-y-2" aria-labelledby="rwa-holdable-heading">
        <div className="flex items-baseline justify-between gap-2">
          <h4
            id="rwa-holdable-heading"
            className="text-xs font-semibold text-gray-900 dark:text-white"
          >
            Hold in your wallet
          </h4>
          <p className="text-2xs text-gray-500 dark:text-gray-400">
            {planRwaPct > 0 ? `${planRwaPct}% of your plan` : 'none in your plan yet'} · Arbitrum
          </p>
        </div>
        <div className="space-y-1">
          {rows.map((r) => (
            <HoldableRow
              key={r.asset.symbol}
              asset={r.asset}
              planPct={r.planPct}
              heldPct={r.heldPct}
              totalValue={totalValue}
              excluded={r.excluded}
              routable={r.routable}
              figure={market?.[r.asset.symbol] ?? null}
              open={openSymbol === r.asset.symbol}
              onToggle={() =>
                setOpenSymbol((s) => (s === r.asset.symbol ? null : r.asset.symbol))
              }
            />
          ))}
        </div>
        {onReviewMove && target ? (
          <button
            type="button"
            data-testid="rwa-review-move"
            onClick={() => onReviewMove(target)}
            className="min-h-tap w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
          >
            Review move to {target}
          </button>
        ) : (
          walletCta
        )}
      </section>

      <section
        className="space-y-2 border-t border-gray-100 dark:border-white/[0.06] pt-3"
        aria-labelledby="rwa-offapp-heading"
        data-testid="rwa-offapp"
      >
        <div>
          <h4
            id="rwa-offapp-heading"
            className="text-xs font-semibold text-gray-700 dark:text-gray-300"
          >
            Licensed vaults, off-app
          </h4>
          <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Where a dollar reserve could earn through IXS — money-market, bond and credit
            vaults on Ethereum. KYC and deposits happen on IXS, not here.
            {philosophy === 'islamic' && ' None is Sharia-certified; all pay conventional interest.'}
          </p>
        </div>

        {source === 'serv' && (
          <p className="text-2xs text-gray-600 dark:text-gray-300 leading-relaxed">{summary}</p>
        )}

        <div className="space-y-0.5">
          {allocations.map((a) => (
            <VaultRow
              key={a.vaultId}
              allocation={a}
              focused={a.vaultId === focusedVaultId}
              onSelect={() => onSelectVault(a.vaultId === focusedVaultId ? null : a.vaultId)}
            />
          ))}
        </div>

        {/* Enhancement rail — instant estimate by default; the deeper
            allocation is one tap and always reversible. */}
        <p data-testid="serv-rail" className="text-2xs text-gray-500 dark:text-gray-400">
          {loading ? (
            'Weighing a deeper allocation…'
          ) : source === 'serv' ? (
            <>
              Deeper allocation · reasoned by SERV
              {receipt && ` · ${receipt.model} · ${(receipt.latencyMs / 1000).toFixed(1)}s`}
              {' · '}
              <button
                type="button"
                onClick={() => onToggleServ(false)}
                className="font-semibold text-blue-600 dark:text-blue-400"
              >
                ← instant estimate
              </button>
            </>
          ) : servOn && degradedReason ? (
            <>
              {degradedReason === 'serv_timeout' ? 'Reasoning timed out' : 'Deeper allocation unavailable'}
              {' — instant estimate shown · '}
              <button
                type="button"
                onClick={() => onToggleServ(false)}
                className="font-semibold text-blue-600 dark:text-blue-400"
              >
                dismiss
              </button>
            </>
          ) : (
            <>
              Instant estimate ·{' '}
              <button
                type="button"
                data-testid="serv-enhance"
                onClick={() => onToggleServ(true)}
                className="font-semibold text-blue-600 dark:text-blue-400"
              >
                Get a deeper allocation →
              </button>
            </>
          )}
        </p>

        <p className="text-2xs text-gray-400 dark:text-gray-500">
          Indicative APY ranges, not quotes · advisory ·{' '}
          <a
            href="https://ixs.finance"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-gray-500 dark:text-gray-400 underline decoration-gray-300 dark:decoration-gray-600"
          >
            Review on IXS ↗
          </a>
        </p>
      </section>
    </div>
  );
}

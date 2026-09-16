/**
 * RwaVaultSleeve — inspector body for the Shield ring's RWA sleeve fan.
 *
 * Rows, not cards: each IXS vault is a quiet row carrying its weight bar,
 * one-line rationale, and indicative APY. The rail is the status/transition
 * line — the instant local estimate by default, a deeper SERV-reasoned
 * allocation as the opt-in upgrade (the membership-tier seam). The
 * affordance speaks user language; SERV stays in the provenance. One CTA:
 * review the deposit on IXS — advisory only, nothing executes here.
 */
import React from 'react';
import { IXS_VAULT_BY_ID } from '@diversifi/shared/src/services/serv/ixs-vault-catalog';
import type { ServReceipt, VaultAllocation } from '@diversifi/shared/src/services/serv/rwa-allocator';

interface Props {
  allocations: VaultAllocation[];
  summary: string;
  source: 'heuristic' | 'serv';
  loading: boolean;
  degradedReason?: string;
  receipt?: ServReceipt;
  servOn: boolean;
  onToggleServ: (on: boolean) => void;
  /** Vault wedge in focus, or null for the whole-sleeve view. */
  focusedVaultId: string | null;
  onSelectVault: (id: string | null) => void;
  /** What the sleeve attaches to — e.g. 'PAXG leg' or 'preview'. */
  sleeveContext: string;
}

function meta(vaultId: string) {
  return IXS_VAULT_BY_ID[vaultId];
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
  const vault = meta(allocation.vaultId);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`vault-row-${allocation.vaultId}`}
      aria-pressed={focused}
      className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
        focused
          ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
          {vault?.name ?? allocation.vaultId}
        </p>
        <p className="text-xs font-bold text-gray-900 dark:text-white shrink-0">
          {allocation.weightPct}%
        </p>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-500/70"
          style={{ width: `${allocation.weightPct}%` }}
        />
      </div>
      {focused && (
        <div className="mt-1.5 space-y-1">
          <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
            {allocation.why}
          </p>
          {vault && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
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
  sleeveContext,
}: Props) {
  const focused = focusedVaultId ? allocations.find((a) => a.vaultId === focusedVaultId) ?? null : null;
  const rest = focused ? allocations.filter((a) => a.vaultId !== focusedVaultId) : allocations;

  return (
    <div className="space-y-3" data-testid="rwa-vault-sleeve">
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        {summary}
      </p>

      {focused && (
        <button
          type="button"
          onClick={() => onSelectVault(null)}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400"
        >
          ← Whole sleeve
        </button>
      )}

      <div className="space-y-1">
        {(focused ? [focused, ...rest] : rest).map((a) => (
          <VaultRow
            key={a.vaultId}
            allocation={a}
            focused={a.vaultId === focusedVaultId}
            onSelect={() =>
              onSelectVault(a.vaultId === focusedVaultId ? null : a.vaultId)
            }
          />
        ))}
      </div>

      {/* Enhancement rail — the status/transition line. The local estimate
          is instant and free; a deeper allocation is one tap and always
          reversible. SERV lives in the provenance, not the vocabulary. */}
      <p data-testid="serv-rail" className="text-[11px] text-gray-500 dark:text-gray-400">
        {loading ? (
          'Weighing a deeper allocation…'
        ) : source === 'serv' ? (
          <>
            Deeper allocation · reasoned by SERV
            {receipt &&
              ` · ${receipt.model} · ${(receipt.latencyMs / 1000).toFixed(1)}s`}
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
            {degradedReason === 'serv_timeout'
              ? 'Reasoning timed out'
              : 'Deeper allocation unavailable'}
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

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {sleeveContext === 'preview'
          ? 'Preview — not in your plan. '
          : `Sub-allocation of your ${sleeveContext}. `}
        Indicative APY · KYC at IXS · advisory — deposits happen on IXS, not here.
      </p>

      <a
        href="https://ixs.finance"
        target="_blank"
        rel="noreferrer"
        className="block min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors text-center leading-[44px]"
      >
        Review vault deposit on IXS →
      </a>
    </div>
  );
}

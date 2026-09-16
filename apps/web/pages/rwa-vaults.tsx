/**
 * /rwa-vaults — doorway into the Shield instrument's RWA vault sleeve.
 *
 * The integrated rail is the product surface: this page's job is to land
 * you inside it — Shield opens with the sleeve inspector unfolded and the
 * ?serv=1 flag carried through to the SERV Reasoning rail. The heuristic
 * floor renders instantly underneath, so the doorway can never regress.
 *
 * ?sandbox=1 keeps the standalone free-form allocator (philosophy × risk ×
 * amount) — the judges' playground and the no-app-shell fallback.
 */

import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { IXS_VAULT_BY_ID } from '@diversifi/shared/src/services/serv/ixs-vault-catalog';
import type { RwaAllocationResult } from '@diversifi/shared/src/services/serv/rwa-allocator';

const PHILOSOPHIES: { id: string; label: string }[] = [
  { id: 'global', label: 'Global' },
  { id: 'africapitalism', label: 'Africapitalism' },
  { id: 'buen_vivir', label: 'Buen Vivir' },
  { id: 'pan_caribbean', label: 'Pan-Caribbean' },
  { id: 'confucian', label: 'Confucian' },
  { id: 'gotong_royong', label: 'Gotong Royong' },
  { id: 'islamic', label: 'Islamic Finance' },
  { id: 'inflation_protection', label: 'Inflation Protection' },
  { id: 'rwa_access', label: 'RWA Access' },
];

const RISK_OPTIONS = ['Conservative', 'Balanced', 'Aggressive'] as const;

export default function RwaVaultsPage() {
  const router = useRouter();
  const sandbox =
    router.isReady &&
    (router.query.sandbox === '1' || router.query.sandbox === 'true');
  const [philosophy, setPhilosophy] = useState('global');
  const [risk, setRisk] = useState<(typeof RISK_OPTIONS)[number]>('Balanced');
  const [amount, setAmount] = useState('1000');
  const [servOn, setServOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RwaAllocationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Doorway: unless the caller asked for the standalone sandbox, land
  // inside Shield with the vault sleeve open — ?serv=1 carries through
  // to the instrument's SERV Reasoning rail.
  useEffect(() => {
    if (!router.isReady || sandbox) return;
    const serv = router.query.serv === '1' || router.query.serv === 'true';
    void router.replace(`/?tab=protect&sleeve=rwa${serv ? '&serv=1' : ''}`);
  }, [router.isReady, sandbox, router]);

  // ?serv=1 opts in from the URL — same flag the demo video uses.
  useEffect(() => {
    if (router.isReady && (router.query.serv === '1' || router.query.serv === 'true')) {
      setServOn(true);
    }
  }, [router.isReady, router.query.serv]);

  const run = useCallback(async (servRequested: boolean, p = philosophy, r = risk, a = amount) => {
    setLoading(true);
    setError(null);
    try {
      const parsed = parseFloat(a.replace(/,/g, ''));
      const res = await fetch(`/api/agent/rwa-allocation${servRequested ? '?serv=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          philosophy: p,
          riskTolerance: r,
          amountUsd: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
          serv: servRequested,
        }),
      });
      if (!res.ok) throw new Error(`http_${res.status}`);
      setResult(await res.json());
    } catch {
      setError('Could not load the allocation — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [philosophy, risk, amount]);

  // First paint runs the free path immediately — no keys, no wallet.
  // Sandbox only: the doorway redirects before a fetch is needed.
  useEffect(() => {
    if (router.isReady && sandbox) run(router.query.serv === '1' || router.query.serv === 'true');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, sandbox]);

  const toggleServ = useCallback(() => {
    const next = !servOn;
    setServOn(next);
    run(next);
  }, [servOn, run]);

  if (!sandbox) {
    return (
      <>
        <Head>
          <title>RWA Vault Allocation — DiversiFi × IXS</title>
          <meta
            name="description"
            content="Values-aware allocation across IXS licensed RWA yield vaults. Free heuristic by default; SERV Reasoning as an opt-in enhancement."
          />
        </Head>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
              Opening the RWA vault sleeve inside DiversiFi…
            </p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              The allocation rail lives inside the Shield instrument now —
              free heuristic first, SERV Reasoning one toggle away.
            </p>
            <Link
              href="/rwa-vaults?sandbox=1"
              className="mt-4 inline-block text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Prefer the standalone sandbox? Stay here →
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>RWA Vault Allocation — DiversiFi × IXS</title>
        <meta
          name="description"
          content="Values-aware allocation across IXS licensed RWA yield vaults. Free heuristic by default; SERV Reasoning as an opt-in enhancement."
        />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mb-2">
            WHERE YOUR PROTECTION EARNS
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A free allocation across licensed real-world-asset vaults — no wallet, no sign-up.
          </p>
        </div>

        {/* Controls */}
        <div className="w-full max-w-lg mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Your values lens
              </p>
              <div className="flex flex-wrap gap-2">
                {PHILOSOPHIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPhilosophy(p.id); run(servOn, p.id); }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                      philosophy === p.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Risk tolerance
              </p>
              <div className="grid grid-cols-3 gap-2">
                {RISK_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRisk(r); run(servOn, philosophy, r); }}
                    className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                      risk === r
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Amount to protect (USD)
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-gray-400">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  onBlur={() => run(servOn)}
                  className="w-full pl-9 pr-4 py-3 text-xl font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="1000"
                />
              </div>
            </div>

            {/* SERV toggle — opt-in enhancement, never required */}
            <button
              onClick={toggleServ}
              className={`w-full py-3 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                servOn
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-violet-300'
              }`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${servOn ? 'bg-white' : 'bg-gray-300 dark:bg-gray-600'}`} />
              {loading ? 'Allocating…' : servOn ? 'SERV Reasoning: ON' : 'Enhance with SERV Reasoning'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="w-full max-w-lg mx-auto mt-6 space-y-5">
            {/* Provenance banner */}
            <div
              className={`rounded-2xl border p-4 ${
                result.source === 'serv'
                  ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <p className={`text-sm font-bold ${
                result.source === 'serv'
                  ? 'text-violet-800 dark:text-violet-300'
                  : 'text-blue-800 dark:text-blue-300'
              }`}>
                {result.source === 'serv' ? '⚡ SERV-enhanced allocation' : '🧭 Free heuristic allocation'}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{result.summary}</p>
              {result.degradedReason && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  SERV was requested but unavailable ({result.degradedReason.replace(/_/g, ' ')}) — showing the free allocation instead.
                </p>
              )}
            </div>

            {/* Allocation rows */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">IXS licensed RWA vaults</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.allocations.map((a) => {
                  const vault = IXS_VAULT_BY_ID[a.vaultId];
                  if (!vault) return null;
                  return (
                    <div key={a.vaultId} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{vault.name}</p>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">{a.weightPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-2">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${a.weightPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{a.why}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        Indicative {vault.indicativeApyLow}–{vault.indicativeApyHigh}% APY · {vault.riskTier} risk · {vault.liquidity} · KYC via IXS
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Receipt */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Receipt
              </p>
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 font-mono">
                <p>source: {result.source}</p>
                <p>serv requested: {String(result.servRequested)} · available: {String(result.servAvailable)}</p>
                {result.receipt && (
                  <>
                    <p>model: {result.receipt.model} (effort: {result.receipt.effort})</p>
                    <p>latency: {result.receipt.latencyMs}ms · at: {result.receipt.at}</p>
                    {result.receipt.usage?.totalTokens != null && (
                      <p>tokens: {result.receipt.usage.totalTokens}</p>
                    )}
                  </>
                )}
                {result.degradedReason && <p>fallback: {result.degradedReason}</p>}
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="w-full max-w-lg mx-auto mt-6 text-center text-sm font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Honesty footnotes */}
        <div className="w-full max-w-lg mx-auto mt-8 space-y-2 text-center">
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Advisory only — nothing here executes a deposit. IXS vaults are licensed under the Bahamas
            DARE Act and settle in USDC/USDT through IXS&rsquo;s own KYC perimeter; eligibility varies by
            jurisdiction. Indicative APY ranges are published estimates, not guarantees.
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Free tier: deterministic heuristic, $0, no keys. SERV tier: Reasoning-enhanced weighting +
            explanation — the freemium line for premium allocation advice.
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open DiversiFi →
          </button>
        </div>
      </div>
    </>
  );
}

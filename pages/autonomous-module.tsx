import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useWalletContext } from '@/components/wallet/WalletProvider';
import { useMultichainBalances } from '@/hooks/use-multichain-balances';
import { useProtectionProfile } from '@/hooks/use-protection-profile';
import { useAgentAnalysis } from '@/hooks/use-agent-analysis';
import { useAgentStatus } from '@/hooks/use-agent-status';
import { useAgentActivities } from '@/hooks/use-agent-activities';
import { useAgentConfig } from '@/hooks/use-agent-config';
import type { MultichainPortfolio } from '@/hooks/use-multichain-balances';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface ModuleStatusResponse {
  module: {
    name: string;
    focus: string;
    entrypoints: {
      analysis: string;
      payments: string;
      ledger: string;
    };
  };
  capabilities: Record<string, { available: boolean; mode: 'live' | 'demo' | 'unavailable'; detail: string }>;
  proofs: {
    agentAddress: string | null;
    agentUSDCBalance: string | number | null;
    ledgerContractAddress: string | null;
  };
  recommendedDemoFlow: string[];
}

const capabilityLabels: Record<string, string> = {
  autonomousExecution: 'Autonomous execution',
  payments: 'Arc x402 payments',
  storage: '0G storage evidence',
  serving: 'AI inference routing',
  ledger: '0G recommendation ledger',
};

export default function AutonomousModulePage() {
  const { address, connect } = useWalletContext();
  const { config } = useAgentConfig();
  const { capabilities, autonomousStatus } = useAgentStatus();
  const { addActivity } = useAgentActivities();
  const { config: profileConfig } = useProtectionProfile();
  const portfolio = useMultichainBalances(address, profileConfig.userGoal || undefined);
  const { runAutonomousAnalysis, advice, isAnalyzing, thinkingStep } = useAgentAnalysis({
    apiBase: API_BASE,
    capabilities,
    config,
    addMessage: () => {},
    addActivity,
    autonomousStatus,
    autonomousEnabled: true,
  });

  const [moduleStatus, setModuleStatus] = useState<ModuleStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const sampleReady = useMemo(() => {
    return Boolean(portfolio?.totalValue || portfolio?.chains?.length || portfolio?.allTokens?.length);
  }, [portfolio]);

  const fetchStatus = async () => {
    setStatusError(null);
    try {
      const response = await fetch('/api/agent/module-status');
      const data = await response.json();
      setModuleStatus(data);
    } catch (error: any) {
      setStatusError(error.message || 'Failed to load module status');
    }
  };

  const handleRun = async () => {
    if (!address) {
      await connect();
      return;
    }

    await runAutonomousAnalysis(
      {},
      portfolio as MultichainPortfolio,
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Head>
        <title>Autonomous AI Module | DiversiFi</title>
        <meta
          name="description"
          content="Bounty-facing autonomous AI module demo for DiversiFi, exposing autonomous analysis, x402 payments, and 0G verification surfaces."
        />
      </Head>

      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">Logos bounty surface</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">DiversiFi Autonomous AI Module</h1>
              <p className="mt-3 text-sm text-slate-300 sm:text-base">
                A focused module view over DiversiFi&apos;s existing agent stack: autonomous portfolio analysis,
                x402-paid research acquisition, and 0G-backed verifiable traces.
              </p>
            </div>

            <div className="grid min-w-[220px] gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-200">Primary analysis API</p>
                <p className="mt-1 font-mono text-cyan-50">/api/agent/deep-analyze</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-200">Proof surfaces</p>
                <p className="mt-1 font-mono text-cyan-50">/api/agent/x402-metrics</p>
                <p className="font-mono text-cyan-50">/api/agent/zero-g-ledger</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
            <h2 className="text-lg font-black">Run the module</h2>
            <p className="mt-2 text-sm text-slate-300">
              This triggers the same autonomous analysis path already used by the app, but presented as a standalone module demo.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Wallet" value={address ? 'Connected' : 'Required'} />
              <MetricCard label="Portfolio snapshot" value={sampleReady ? 'Ready' : 'Waiting'} />
              <MetricCard label="Agent mode" value={autonomousStatus?.enabled ? 'Autonomous' : 'Config dependent'} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleRun}
                disabled={isAnalyzing}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
              >
                {address ? (isAnalyzing ? 'Running analysis...' : 'Run autonomous analysis') : 'Connect wallet to run'}
              </button>
              <button
                onClick={fetchStatus}
                className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/5"
              >
                Load module status
              </button>
              <a
                href="/api/agent/x402-metrics"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-amber-400/30 px-4 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-400/10"
              >
                Open payment proof
              </a>
              <a
                href="/api/agent/zero-g-ledger"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-violet-400/30 px-4 py-3 text-sm font-bold text-violet-200 transition hover:bg-violet-400/10"
              >
                Open ledger proof
              </a>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Latest result</p>
              {advice ? (
                <div className="mt-3 space-y-2 text-sm text-slate-200">
                  <div><span className="font-bold text-white">Action:</span> {advice.action || 'N/A'}</div>
                  <div><span className="font-bold text-white">Confidence:</span> {typeof advice.confidence === 'number' ? advice.confidence : 'N/A'}</div>
                  <div><span className="font-bold text-white">Reasoning:</span> {advice.reasoning || 'No reasoning returned.'}</div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  {isAnalyzing ? thinkingStep || 'Autonomous analysis in progress...' : 'No run yet. Start an analysis to generate a bounty-demo output.'}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h2 className="text-lg font-black">Why this qualifies</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-300">
                <li>Uses the existing autonomous agent path instead of a mocked demo surface.</li>
                <li>Bundles wallet-aware execution, paid research, and verifiable recommendation traces.</li>
                <li>Exposes judge-friendly proof endpoints without requiring the full consumer navigation flow.</li>
              </ul>
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h2 className="text-lg font-black">Capability status</h2>
              {moduleStatus ? (
                <div className="mt-4 space-y-3">
                  {Object.entries(moduleStatus.capabilities).map(([key, capability]) => (
                    <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white">{capabilityLabels[key] || key}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${badgeClassName(capability.mode)}`}>
                          {capability.mode}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">{capability.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Load module status to inspect live/demo readiness across agent, Arc, and 0G surfaces.</p>
              )}
              {statusError && <p className="mt-3 text-sm text-rose-300">{statusError}</p>}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
              <h2 className="text-lg font-black">Suggested demo flow</h2>
              <ol className="mt-4 space-y-2 text-sm text-slate-300">
                {(moduleStatus?.recommendedDemoFlow || [
                  'Run an autonomous analysis.',
                  'Open Arc settlement metrics.',
                  'Open the 0G recommendation ledger.',
                ]).map((step) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 text-cyan-300">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function badgeClassName(mode: 'live' | 'demo' | 'unavailable') {
  if (mode === 'live') return 'bg-emerald-400/20 text-emerald-200';
  if (mode === 'demo') return 'bg-amber-400/20 text-amber-200';
  return 'bg-rose-400/20 text-rose-200';
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { agentEventBus } from './agent-event-bus';
import { marketPulseService } from '@diversifi/shared';
import { useStreakRewards } from './use-streak-rewards';
import { useAgentConfig } from './use-agent-config';
import { useAdvisor } from './use-advisor';
import { useWalletContext } from '../components/wallet/WalletProvider';

type YieldOpportunity = {
  protocol: string;
  chain: string;
  symbol: string;
  apy: number;
  tvl: number;
  pool: string;
  executableTargetToken?: string | null;
  isExecutable?: boolean;
};

const EXECUTABLE_YIELD_TOKENS = new Set(['USDY', 'PAXG', 'SYRUPUSDC', 'CUSD', 'CEUR', 'USDC', 'USDT']);
/** Must match the server-side cooldown in `pages/api/vault/guardian-state.ts`. */
const YIELD_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function getExecutableTargetToken(symbol: string): string | null {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || normalized.includes('-') || normalized.includes('/')) {
    return null;
  }
  return EXECUTABLE_YIELD_TOKENS.has(normalized) ? normalized : null;
}

/**
 * useAlertCooldown
 *
 * Per-user alert cooldowns backed by `GuardianState.alertCooldowns` on the
 * server. Replaces the old per-browser `localStorage` map. Returns a
 * `shouldSend(alertId, cooldownMs?)` check and a `markSent(alertId)` writer.
 *
 * Behaviour:
 *  - On mount (and on address change) the current cooldown map is fetched
 *    once via GET /api/vault/guardian-state.
 *  - `markSent` POSTs `{ recordAlert: { alertId, firedAt } }` and updates
 *    local state optimistically so the rest of the loop doesn't have to
 *    wait for the round-trip.
 *  - `shouldSend` accepts an optional `cooldownMs` per call so different
 *    alert types can use different windows (yield is 6h, UBI is 24h, etc.)
 *    without changing the hook signature. The default is 6h to match the
 *    historical behaviour.
 *  - When no wallet is connected, both helpers are no-ops. This matches
 *    the previous behaviour (the loop was guarded by `if (targetToken && address)`).
 */
function useAlertCooldown(userAddress: string | null | undefined): {
    shouldSend: (alertId: string, cooldownMs?: number) => boolean;
    markSent: (alertId: string) => void;
} {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!userAddress) {
            setCooldowns({});
            return;
        }

        let cancelled = false;
        fetch(`${API_BASE}/api/vault/guardian-state?userAddress=${encodeURIComponent(userAddress)}`)
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                if (cancelled || !data?.state?.alertCooldowns) return;
                setCooldowns(data.state.alertCooldowns);
            })
            .catch(() => {
                // Best-effort only — missing cooldown state should not block alerts.
            });

        return () => {
            cancelled = true;
        };
    }, [API_BASE, userAddress]);

    const shouldSend = useCallback(
        (alertId: string, cooldownMs: number = YIELD_ALERT_COOLDOWN_MS) => {
            if (!userAddress) return true;
            const lastSentAt = cooldowns[alertId];
            if (!lastSentAt) return true;
            return Date.now() - lastSentAt > cooldownMs;
        },
        [cooldowns, userAddress],
    );

    const markSent = useCallback(
        (alertId: string) => {
            if (!userAddress) return;
            const firedAt = Date.now();
            setCooldowns((prev) => ({ ...prev, [alertId]: firedAt }));
            fetch(`${API_BASE}/api/vault/guardian-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress,
                    recordAlert: { alertId, firedAt },
                }),
            }).catch(() => {
                // Best-effort only.
            });
        },
        [API_BASE, userAddress],
    );

    return { shouldSend, markSent };
}

/**
 * useProactiveAgent
 *
 * CORE PRINCIPLES:
 * - PROACTIVE: Monitors REAL on-chain and market data in the background.
 * - MODULAR: Decoupled from the Chat UI. It emits events or pushes to existing context.
 * - HONEST: No fabricated data. Alerts only when real thresholds are crossed.
 *
 * Monitoring Loop:
 * 1. GoodDollar UBI claim status (via useStreakRewards)
 * 2. Market volatility (via marketPulseService)
 * 3. DeFi yield spikes (via /api/agent/yield-monitor — DeFiLlama data)
 */
export function useProactiveAgent() {
  const { config } = useAgentConfig();
  const { publishAdvisorUpdate } = useAdvisor();
  const { address } = useWalletContext();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  // Per-user alert cooldowns. Server-backed, so the 6h guarantee survives
  // device switches, not just session reloads.
  const { shouldSend: shouldSendAlert, markSent: markAlertSent } = useAlertCooldown(address);

  // GoodDollar Integration
  const { canClaim, estimatedReward, alreadyClaimedOnChain } = useStreakRewards();

  // Configurable thresholds (Phase 4C)
  const volatilityThreshold = (config as any).volatilityAlertThreshold ?? 80;
  const yieldThreshold = (config as any).yieldAlertThreshold ?? 10;

  // Prevent duplicate triggers within a session
  const yieldAlerted = useRef(false);
  const volatilityAlerted = useRef(false);

  // Monitor GoodDollar Claim Status
  useEffect(() => {
    if (canClaim && !alreadyClaimedOnChain) {
        // Per-day cooldown, so a page reload within the same 24h claim
        // window does not re-prompt, but a fresh day does. The 24h
        // window is the natural granularity of a daily UBI claim; using
        // a shorter window (the default 6h yield cooldown) would let
        // the same insight re-fire after lunch, which is annoying.
        const today = new Date().toISOString().slice(0, 10);
        const ubiAlertId = `ubi-claim:${today}`;
        const UBI_COOLDOWN_MS = 24 * 60 * 60 * 1000;

        if (!shouldSendAlert(ubiAlertId, UBI_COOLDOWN_MS)) {
            return;
        }

        const ubiInsight = `✨ Good news! I've been monitoring your on-chain status, and your daily Universal Basic Income of ${estimatedReward} is ready to claim on Celo.`;

        const triggerUbiAlert = () => {
             publishAdvisorUpdate({
               content: ubiInsight,
               type: 'recommendation',
               openDrawer: true,
               action: {
                 type: 'claim_ubi',
                 delay: 3500,
               }
             }).catch(() => {});
             markAlertSent(ubiAlertId);
        };

        setTimeout(triggerUbiAlert, 4000);
    }
  }, [canClaim, alreadyClaimedOnChain, estimatedReward, publishAdvisorUpdate, shouldSendAlert, markAlertSent]);

  // Real Market & Yield Monitoring Loop
  useEffect(() => {
    const monitoringInterval = setInterval(async () => {
      try {
        // 1. Market Volatility Check (real data from marketPulseService)
        const pulse = await marketPulseService.getMarketPulse('1h');

        if (pulse.impliedVolatility && pulse.impliedVolatility > volatilityThreshold && !volatilityAlerted.current) {
          volatilityAlerted.current = true;

          const volMessage = `⚠️ Market volatility has spiked to ${Math.round(pulse.impliedVolatility)}% (your threshold: ${volatilityThreshold}%). Sentiment: ${pulse.sentiment}. Would you like me to bridge your crypto to stable assets on Celo?`;

          agentEventBus.emit('proactive:insight', {
            title: 'High Volatility Detected',
            message: volMessage,
            type: 'alert'
          });

          publishAdvisorUpdate({
            content: volMessage,
            type: 'recommendation',
            openDrawer: false,
          }).catch(() => {});

          // Reset alert after 30 minutes so it can fire again
          setTimeout(() => { volatilityAlerted.current = false; }, 30 * 60 * 1000);
        }

        // 2. DeFi Yield Spike Check (real DeFiLlama data via yield-monitor endpoint)
        if (!yieldAlerted.current) {
          try {
            const yieldRes = await fetch(`${API_BASE}/api/agent/yield-monitor`);
            if (yieldRes.ok) {
              const yieldData = await yieldRes.json();
              if (yieldData._stale) {
                return;
              }

              const spikes = yieldData.opportunities?.filter(
                (o: YieldOpportunity) => o.apy > yieldThreshold && o.chain?.toLowerCase().includes('celo')
              ) || [];

              if (spikes.length > 0) {
                const sortedSpikes = [...spikes].sort((a: YieldOpportunity, b: YieldOpportunity) => {
                  const aExecutable = a.isExecutable ? 1 : 0;
                  const bExecutable = b.isExecutable ? 1 : 0;

                  if (aExecutable !== bExecutable) return bExecutable - aExecutable;
                  if (a.tvl !== b.tvl) return b.tvl - a.tvl;
                  return b.apy - a.apy;
                });

                const best = sortedSpikes[0] as YieldOpportunity;
                const targetToken = best.executableTargetToken ?? getExecutableTargetToken(best.symbol);
                const alertId = `yield:${best.pool}:${Math.round(best.apy)}`;

                if (!shouldSendAlert(alertId)) {
                  return;
                }

                yieldAlerted.current = true;
                const formattedTvl = best.tvl >= 1_000_000
                  ? `$${(best.tvl / 1e6).toFixed(1)}M`
                  : `$${(best.tvl / 1e3).toFixed(0)}k`;

                if (targetToken && address) {
                  fetch(`${API_BASE}/api/vault/guardian-state`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userAddress: address,
                      latestRecommendation: {
                        capturedAt: new Date().toISOString(),
                        source: 'proactive-yield',
                        action: 'REBALANCE',
                        targetToken,
                        oneLiner: `Review moving idle stablecoins toward ${targetToken} yield.`,
                        reasoning: `${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} with TVL ${formattedTvl}.`,
                        confidence: best.tvl >= 1_000_000 ? 0.72 : 0.55,
                        riskLevel: best.tvl >= 1_000_000 ? 'MEDIUM' : 'HIGH',
                        protocol: best.protocol,
                        chain: best.chain,
                        marketSymbol: best.symbol,
                        apy: best.apy,
                        tvl: best.tvl,
                        expectedSavings: Math.max(25, Math.round(best.apy)),
                      },
                    }),
                  }).catch(() => {});

                  const yieldMessage = `📈 On-chain data shows ${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} (TVL: ${formattedTvl}). This exceeds your ${yieldThreshold}% alert threshold. Should I have Guardian review a dry-run rebalance for this opportunity?`;

                  publishAdvisorUpdate({
                    content: yieldMessage,
                    type: 'recommendation',
                    openDrawer: false,
                    action: {
                      type: 'guardian_review',
                    },
                  }).catch(() => {});
                  markAlertSent(alertId);
                } else {
                  const yieldMessage = `📈 On-chain data shows ${best.protocol} on ${best.chain} is offering ${best.apy.toFixed(1)}% APY on ${best.symbol} (TVL: ${formattedTvl}). This exceeds your ${yieldThreshold}% alert threshold, but it is not currently supported as an automatic protection action. Treat this as a research alert, not an executable action.`;

                  publishAdvisorUpdate({
                    content: yieldMessage,
                    type: 'recommendation',
                    openDrawer: false,
                  }).catch(() => {});
                  markAlertSent(alertId);
                }

                // Reset after 1 hour
                setTimeout(() => { yieldAlerted.current = false; }, 60 * 60 * 1000);
              }
            }
          } catch (yieldErr) {
            // Silently skip — yield monitoring is best-effort
            console.warn('[ProactiveAgent] Yield monitor fetch failed:', yieldErr);
          }
        }
      } catch (err) {
        console.warn('[ProactiveAgent] Monitoring loop error:', err);
      }
    }, 300000); // Check every 5 minutes (was 60s — too noisy)

    return () => {
      clearInterval(monitoringInterval);
    };
  }, [API_BASE, address, publishAdvisorUpdate, shouldSendAlert, markAlertSent, volatilityThreshold, yieldThreshold]);
}

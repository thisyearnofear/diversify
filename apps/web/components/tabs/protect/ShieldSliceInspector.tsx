/**
 * ShieldSliceInspector — the Shield tab's InspectorSheet. Pure
 * presentation extracted from ProtectionTab: every branch of the slice
 * inspector (philosophy/compare, RWA sleeve, focused token incl. F1
 * attribution, fillability, CTAs, PaymentCycleReport).
 */
import React from "react";
import type { Region } from "@/hooks/use-user-region";
import type { GuardianVisibility } from "@/lib/guardian-visibility";
import type { GuardianSessionInfo } from "@/hooks/use-session-key";
import type { GuardianTierState } from "@diversifi/shared/src/services/vault/guardian-tier-state";
import type { PortfolioFreshness } from "@/lib/wallet-portfolio-view";
import type { PlanLeg } from "@/components/protection-cards/plan-preview";
import type { useAdvisor } from "@/hooks/use-advisor";
import type { useNavigation } from "@/context/app/NavigationContext";
import type { useRwaAllocation } from "@/hooks/use-rwa-allocation";
import type { scorePlanAlignment } from "@/lib/plan-alignment";
import type { seriesFor } from "@/lib/learn/protection-calculator";
import { motion } from "framer-motion";
import { springPop } from "@/lib/motion-tokens";
import { InspectorSheet } from "../../shared/InspectorSheet";
import { TokenIcon } from "../../shared/TokenIcon";
import StatusBadge from "../../shared/StatusBadge";
import WalletButton from "../../wallet/WalletButton";
import { ProtectionCalculator } from "../../inflation/ProtectionCalculator";
import { PaymentCycleReport } from "./PaymentCycleReport";
import { RwaVaultSleeve } from "./RwaVaultSleeve";
import { SLEEVE_ID, VAULT_SLICE_PREFIX, isSleeveSelection } from "./ProtectionPlanRing";
import { STRATEGIES } from "@/hooks/useFinancialStrategies";
import { describePlanDelta } from "@/components/protection-cards/plan-preview";
import { isLegFillable } from "@/lib/plan-legs";
import { rwaLegFor } from "./rwa-assets";
import { IXS_VAULT_BY_ID } from "@diversifi/shared/src/services/serv/ixs-vault-catalog";
import { findTokenAttribution, newestExecutionAnchor } from "@/lib/agent/decision-attribution";
import { formatDuration, timeAgo } from "@/lib/format-duration";
import type { GuardianDecisionRef } from "@/context/app/NavigationContext";
import { canSafelyExecute } from "@/lib/wallet-portfolio-view";
import type { useToast } from "@/components/ui/Toast";
import type { ShieldShape } from "./shield-shape";

export interface ShieldSliceInspectorProps {
  /** Resolved selection id — ProtectionTab computes it (the shell's
   *  layout needs it too). */
  inspectorSel: string | null;
  isPreviewing: boolean;
  comparing: boolean;
  focusedPhilosophy: string | null;
  focusedToken: string | null;
  shape: ShieldShape;
  strategyKey: string | null;
  setFocusedToken: (v: string | null) => void;
  setFocusedPhilosophy: React.Dispatch<React.SetStateAction<import("@/context/app/types").FinancialStrategy | null>>;
  sleeveOpen: boolean;
  rwa: ReturnType<typeof useRwaAllocation>;
  rwaServOn: boolean;
  setRwaServOn: (v: boolean) => void;
  sleeveHostSymbol: string | null;
  allocations: PlanLeg[];
  previewAllocations: PlanLeg[];
  alignmentLegs: ReturnType<typeof scorePlanAlignment>["legs"];
  chainId: number | null | undefined;
  address: string | null;
  learnAmount: number;
  setLearnAmountOverride: (v: number | null) => void;
  learnSeries: ReturnType<typeof seriesFor>;
  learnYear: number;
  setLearnYear: (v: number) => void;
  learnMixLabel: string;
  currencyCode: string;
  commitFocusedPlan: () => void;
  askAdvisor: ReturnType<typeof useAdvisor>["askAdvisor"];
  totalValue: number;
  fmt: (n: number) => string;
  selectedHeld: number;
  selectedAlloc: PlanLeg | null;
  gapPct: number;
  riskData: { code: string } | null;
  visibility: GuardianVisibility;
  sessionInfo: GuardianSessionInfo | null;
  navigateToGuardian: ReturnType<typeof useNavigation>["navigateToGuardian"];
  reducedMotion: boolean | null;
  walletFreshness: PortfolioFreshness;
  refreshBalances: (() => Promise<void>) | undefined;
  openProtectionFlow: (token: string) => void;
  planName: string;
  userRegion: Region;
  isPaymentCycle: boolean;
  guardianState: GuardianTierState;
  setShowMobileWizard: (v: boolean) => void;
  showToast: ReturnType<typeof useToast>["showToast"];
}

export function ShieldSliceInspector(props: ShieldSliceInspectorProps) {
  const {
    inspectorSel,
    isPreviewing,
    comparing,
    focusedPhilosophy,
    focusedToken,
    shape,
    strategyKey,
    setFocusedToken,
    setFocusedPhilosophy,
    sleeveOpen,
    rwa,
    rwaServOn,
    setRwaServOn,
    sleeveHostSymbol,
    allocations,
    previewAllocations,
    alignmentLegs,
    chainId,
    address,
    learnAmount,
    setLearnAmountOverride,
    learnSeries,
    learnYear,
    setLearnYear,
    learnMixLabel,
    currencyCode,
    commitFocusedPlan,
    askAdvisor,
    totalValue,
    fmt,
    selectedHeld,
    selectedAlloc,
    gapPct,
    riskData,
    visibility,
    sessionInfo,
    navigateToGuardian,
    reducedMotion,
    walletFreshness,
    refreshBalances,
    openProtectionFlow,
    planName,
    userRegion,
    isPaymentCycle,
    guardianState,
    setShowMobileWizard,
    showToast,
  } = props;

  return (
    <InspectorSheet
      selectedId={inspectorSel}
      onClose={() => {
        setFocusedToken(null);
        setFocusedPhilosophy(null);
      }}
      title={
        !comparing && isSleeveSelection(focusedToken)
          ? focusedToken === SLEEVE_ID
            ? "RWA vault sleeve"
            : (IXS_VAULT_BY_ID[focusedToken!.slice(VAULT_SLICE_PREFIX.length)]?.name ??
              "RWA vault")
          : shape === "picker" || comparing
            ? (STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? "Plan")
            : (focusedToken ?? "Slice")
      }
    >
      {sleeveOpen && (
        <RwaVaultSleeve
          allocations={rwa.allocations}
          summary={rwa.summary}
          source={rwa.source}
          loading={rwa.loading}
          degradedReason={rwa.degradedReason}
          receipt={rwa.receipt}
          servOn={rwaServOn}
          onToggleServ={setRwaServOn}
          focusedVaultId={
            focusedToken?.startsWith(VAULT_SLICE_PREFIX)
              ? focusedToken.slice(VAULT_SLICE_PREFIX.length)
              : null
          }
          onSelectVault={(id) =>
            setFocusedToken(id ? `${VAULT_SLICE_PREFIX}${id}` : SLEEVE_ID)
          }
          sleeveContext={sleeveHostSymbol ? `${sleeveHostSymbol} leg` : "preview"}
        />
      )}
      {(shape === "picker" || comparing) && focusedPhilosophy && (
        <div className="space-y-3">
          {comparing && (
            <p
              data-testid="plan-delta"
              className="text-xs text-gray-600 dark:text-gray-300"
            >
              {focusedPhilosophy !== strategyKey
                ? describePlanDelta(allocations, previewAllocations)
                : "Your current plan"}
            </p>
          )}
          {(() => {
            const values =
              STRATEGIES.find((s) => s.id === focusedPhilosophy)?.values ?? [];
            if (values.length === 0) return null;
            return (
              <div data-testid="plan-values" className="flex flex-wrap gap-1.5">
                {values.slice(0, 3).map((v) => (
                  <span
                    key={v}
                    className="text-[11px] rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-gray-500"
                  >
                    {v}
                  </span>
                ))}
              </div>
            );
          })()}
          {(() => {
            if (!comparing || !focusedToken) return null;
            const leg = previewAllocations.find((l) => l.token === focusedToken);
            if (!leg) return null;
            return (
              <div>
                <div
                  data-testid="compare-leg"
                  className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <TokenIcon symbol={leg.token} size={20} />
                  <span>
                    {leg.token} · {leg.percent}% — {leg.why}
                  </span>
                </div>
                {!isLegFillable(leg.token, chainId) && (
                  <p
                    data-testid="leg-unfillable"
                    className="mt-1 text-[11px] text-amber-600 dark:text-amber-400"
                  >
                    Not on this network — needs a bridge
                  </p>
                )}
              </div>
            );
          })()}
          <ProtectionCalculator
            amount={learnAmount}
            onAmountChange={setLearnAmountOverride}
            amountLabel={totalValue > 0 ? "Wallet value (editable)" : "Your savings amount"}
            currencyCode={currencyCode}
            series={learnSeries}
            selectedYear={learnYear}
            years={5}
            mixLabel={learnMixLabel}
            onSelectYear={setLearnYear}
            onProtect={commitFocusedPlan}
            ctaLabel="Use this plan"
          />
          <button
            type="button"
            onClick={() =>
              askAdvisor(
                `I'm considering the ${STRATEGIES.find((s) => s.id === focusedPhilosophy)?.name ?? focusedPhilosophy} protection plan. How does this mix protect ${currencyCode} savings over ${learnYear} years?`,
              )
            }
            className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
          >
            Ask Guardian about this plan
          </button>
        </div>
      )}
      {shape !== "picker" && !comparing && focusedToken && !isSleeveSelection(focusedToken) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TokenIcon symbol={focusedToken} size={22} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{focusedToken} position</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={`${selectedHeld.toFixed(0)}% held${totalValue > 0 ? ` · ${fmt((selectedHeld / 100) * totalValue)}` : ""}`}
                  tone="info"
                  compact
                />
                {selectedAlloc ? (
                  <StatusBadge
                    label={`${selectedAlloc.percent}% target${totalValue > 0 ? ` · ${fmt((selectedAlloc.percent / 100) * totalValue)}` : ""}`}
                    tone={gapPct > 2 ? "warning" : "ready"}
                    compact
                  />
                ) : (
                  <StatusBadge label="Not in plan" tone="neutral" compact />
                )}
              </div>
            </div>
          </div>
          {/* One sentence carries gap + plan vs held — numbers do the explaining (§6), badges stay quiet */}
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            {selectedAlloc
              ? gapPct > 2
                ? `You're ${gapPct.toFixed(0)} points light${totalValue > 0 ? ` (≈ ${fmt((gapPct / 100) * totalValue)})` : ""} — plan ${selectedAlloc.percent}%, you hold ${selectedHeld.toFixed(0)}%${riskData ? ` · ${riskData.code} is the risk this offsets` : ""}.`
                : `On target — you hold ${selectedHeld.toFixed(0)}% vs ${selectedAlloc.percent}% plan${totalValue > 0 ? ` (≈ ${fmt((selectedHeld / 100) * totalValue)})` : ""}.`
              : `Outside the plan — you hold ${selectedHeld.toFixed(0)}%${totalValue > 0 ? ` (≈ ${fmt((selectedHeld / 100) * totalValue)})` : ""} in a token the plan doesn't use.`}
          </p>
          {(() => {
            const leg = alignmentLegs.find((l) => l.token === focusedToken);
            if (!leg?.why || rwaLegFor(focusedToken)) return null;
            return (
              <p data-testid="leg-why" className="text-xs text-gray-500 dark:text-gray-400">
                {leg.why}
              </p>
            );
          })()}
          {/* F1 attribution — informed mode surfaces the Guardian's own
              user-scoped record for this slice (decline / proposal), or its
              last execution. Quiet mode and pre-instrumentation sessions
              render nothing; unmeasured durations are omitted, never 0. */}
          {visibility === "informed" && (() => {
            const attr = findTokenAttribution(sessionInfo, focusedToken);
            const anchor = newestExecutionAnchor(sessionInfo);
            if (!attr && !anchor) return null;
            const ms = formatDuration(attr?.durationMs ?? anchor?.durationMs);
            const line = attr
              ? `Guardian ${attr.kind === "decline" ? `stood down on ${focusedToken}` : `proposed a move for ${focusedToken}`} · ${timeAgo(attr.capturedAt)}${ms ? ` · decided in ${ms}` : ""}`
              : `Guardian's last execution · ${timeAgo(anchor!.capturedAt)}${ms ? ` · took ${ms}` : ""}`;
            const prompt = attr
              ? `Guardian, you ${attr.kind === "decline" ? "stood down" : "made a proposal"} on my ${focusedToken} position (${attr.status}${attr.reason ? ` — ${attr.reason}` : ""}). Explain what you saw and what would change your mind.`
              : `Guardian, walk me through your most recent execution for me (${anchor!.status}). What moved and why?`;
            const decisionRef: GuardianDecisionRef = attr
              ? {
                  capturedAt: attr.capturedAt,
                  kind: attr.kind === "decline" ? "decision" : "proposal",
                  source: attr.source,
                  status: attr.status,
                  reason: attr.reason,
                  targetToken: attr.targetToken,
                  durationMs: attr.durationMs,
                }
              : {
                  capturedAt: anchor!.capturedAt,
                  kind: "execution",
                  status: anchor!.status,
                  txHash: anchor!.txHash,
                  durationMs: anchor!.durationMs,
                };
            return (
              <motion.div
                key={focusedToken}
                initial={reducedMotion ? false : { scale: 0.86, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springPop}
                className="space-y-1"
              >
                <button
                  type="button"
                  data-testid="guardian-attribution"
                  onClick={() => navigateToGuardian({ summary: line, prompt, decisionRef })}
                  className="min-h-[36px] text-left text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  {line} →
                </button>
                {anchor?.explorerUrl && (
                  <a
                    data-testid="guardian-attribution-receipt"
                    href={anchor.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] text-gray-500 dark:text-gray-400 underline decoration-gray-300 dark:decoration-gray-600"
                  >
                    On-chain receipt ({anchor.status})
                  </a>
                )}
              </motion.div>
            );
          })()}
          {!isLegFillable(focusedToken, chainId) && (
            <p
              data-testid="leg-unfillable"
              className="text-[11px] text-amber-600 dark:text-amber-400"
            >
              Not on this network — needs a bridge
            </p>
          )}
          {(() => {
            const rwa = rwaLegFor(focusedToken);
            if (!rwa) return null;
            return (
              <>
                <p data-testid="rwa-leg" className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {rwa.label} — {rwa.description}
                </p>
                <button
                  type="button"
                  data-testid="rwa-sleeve-rail"
                  onClick={() => setFocusedToken(SLEEVE_ID)}
                  className="min-h-[44px] text-xs font-semibold text-blue-600 dark:text-blue-400"
                >
                  See this sleeve as licensed RWA vaults →
                </button>
              </>
            );
          })()}
          {/* One forward CTA per selection — the inspector is never a dead
              end (design-language §5: selection → gap inspector → one CTA).
              Which action shows depends on wallet state, not on whether the
              user "earned" a forward path. */}
          {!address && (
            <WalletButton variant="primary" className="w-full" />
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue > 0 && canSafelyExecute(walletFreshness) && (
            <button
              type="button"
              onClick={() => openProtectionFlow(selectedAlloc.token)}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Review move to {selectedAlloc.token} (~
              {fmt((gapPct / 100) * totalValue)})
            </button>
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue > 0 && !canSafelyExecute(walletFreshness) && (
            <div className="space-y-2">
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Refresh wallet data before reviewing an executable protection move.
              </p>
              {refreshBalances && (
                <button
                  type="button"
                  onClick={() => void refreshBalances()}
                  className="min-h-[44px] w-full rounded-xl border border-blue-600 text-blue-600 dark:text-blue-400 text-sm font-bold px-4 transition-colors"
                >
                  Refresh wallet data
                </button>
              )}
            </div>
          )}
          {address && selectedAlloc && gapPct > 2 && totalValue <= 0 && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address);
                  showToast("Address copied — fund this wallet to start the plan", "success");
                } catch {
                  showToast("Could not copy address", "error");
                }
              }}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Fund this plan — copy deposit address
            </button>
          )}
          {address && selectedAlloc && gapPct <= 2 && (
            <button
              type="button"
              onClick={() => {
                if (guardianState === "monitoring") {
                  navigateToGuardian({
                    summary: `${focusedToken} — on target (${selectedHeld.toFixed(0)}% held vs ${selectedAlloc.percent}% plan)`,
                    prompt: `Guardian, keep monitoring my ${focusedToken} holding — it's on target at ${selectedHeld.toFixed(0)}% vs the ${selectedAlloc.percent}% plan for my ${planName} strategy. Flag me if it drifts.`,
                  });
                } else {
                  setShowMobileWizard(true);
                }
              }}
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              {guardianState === "monitoring"
                ? "See Guardian activity"
                : "Have Guardian keep this aligned"}
            </button>
          )}
          {address && !selectedAlloc && (
            <button
              type="button"
              onClick={() =>
                askAdvisor(
                  `My ${focusedToken} holding (${selectedHeld.toFixed(0)}% of my wallet) is outside my ${planName} plan. What are my options — hold, swap into a plan token, or something else in ${userRegion}?`,
                )
              }
              className="min-h-[44px] w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 transition-colors"
            >
              Ask Guardian what to do with {focusedToken}
            </button>
          )}
          {(selectedAlloc || !address) && (
            <button
              type="button"
              onClick={() =>
                askAdvisor(
                  `I'm focused on my ${focusedToken} wallet holding (${selectedHeld.toFixed(0)}% held${selectedAlloc ? ` vs ${selectedAlloc.percent}% target` : ''}). How should I correct this for my ${planName} plan in ${userRegion}?`,
                )
              }
              className="min-h-[44px] text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
            >
              Ask Guardian about this slice
            </button>
          )}
          {isPaymentCycle && selectedAlloc && (
            <div className="pt-3 mt-3 border-t border-purple-100 dark:border-purple-900/30">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Payment cycle</span>
              </div>
              <PaymentCycleReport
                defaultLocalCurrency={riskData?.code}
                onAskGuardian={(prompt) => askAdvisor(prompt)}
              />
            </div>
          )}
        </div>
      )}
    </InspectorSheet>
  );
}

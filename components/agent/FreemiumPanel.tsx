import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCredits } from "../../hooks/use-credits";
import { useResearchAccount } from "../../hooks/use-research-account";
import { REWARD_ACTIONS } from "../../constants/credits";
import type { RewardActionKey } from "../../constants/credits";

interface FreemiumPanelProps {
  onGoodDollarClaim: () => void;
}

export default function FreemiumPanel({ onGoodDollarClaim }: FreemiumPanelProps) {
  const { status: creditsStatus, claimReward, shareApp } = useCredits();
  const researchAccount = useResearchAccount();
  const [showFreemium, setShowFreemium] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [shareStep, setShareStep] = useState<"idle" | "shared" | "claimed">("idle");

  if (!creditsStatus) return null;
  const arcBalance = researchAccount.arcWalletBalance;
  const spentToday = researchAccount.spentToday;
  const lastResearchPayment = researchAccount.lastResearchPayment;
  const { paymentSettings, updatePaymentSettings } = researchAccount;

  const handleShare = async () => {
    setShareStep("shared");
    const url = "https://diversifiapp.vercel.app";
    const text = "Protecting my savings from inflation with DiversiFi 🌍 — AI-powered portfolio diversification for emerging markets. Try it free:";
    if (navigator.share) {
      await navigator.share({ title: "DiversiFi", text, url });
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
    }
  };

  const handleShareConfirm = async () => {
    await claimReward("share_app");
    setShareStep("claimed");
  };

  return (
    <div className="px-4 pt-1 pb-2">
      <button
        onClick={() => setShowFreemium(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/60 dark:border-emerald-700/40 text-xs"
      >
        <span className="flex items-center gap-2">
          {arcBalance !== null ? (
            <span className="font-bold text-purple-700 dark:text-purple-300">
              Research Balance: ${parseFloat(arcBalance).toFixed(3)} USDC
              {spentToday > 0 && (
                <span className="ml-1 text-purple-500 dark:text-purple-400">
                  · ${spentToday.toFixed(3)} spent today
                </span>
              )}
            </span>
          ) : creditsStatus.trial.active ? (
            <span className="font-bold text-emerald-700 dark:text-emerald-300">Research Trial — {creditsStatus.trial.daysRemaining}d left</span>
          ) : (
            <span className="font-bold text-teal-700 dark:text-teal-300">Research Credits: ${creditsStatus.credits.bonus.toFixed(3)} USDC</span>
          )}
          {creditsStatus.referral.availableActions.length > 0 && (
            <span className="bg-amber-400 text-amber-900 font-bold px-1.5 py-0.5 rounded-full text-xs">
              +{creditsStatus.referral.availableActions.length} ways to earn
            </span>
          )}
        </span>
        <span className="text-gray-400">{showFreemium ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {showFreemium && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-emerald-200/60 dark:border-emerald-700/40 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
              {/* Research balance + cost controls */}
              {arcBalance !== null && (
                <div className="px-3 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-t-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300">Research Balance</span>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">${parseFloat(arcBalance).toFixed(4)} USDC</span>
                  </div>
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-2">
                    Used only for paid evidence in AI chat. Quotes show before payment, and bundles typically cost $0.004–$0.015 USDC.
                    {!researchAccount.isOnArc && " Wallet payments switch to Arc automatically when supported."}
                  </div>
                  <div className="mb-2 rounded-lg bg-white/70 dark:bg-black/20 border border-purple-100 dark:border-purple-800/30 px-2 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
                          Auto-pay paid research
                        </p>
                        <p className="text-[10px] text-purple-600 dark:text-purple-400">
                          {paymentSettings.autoPayEnabled
                            ? `On up to $${paymentSettings.autoPayMaxUSDC.toFixed(3)} per query`
                            : "Confirm every paid bundle"}
                        </p>
                      </div>
                      <button
                        onClick={() => updatePaymentSettings({ autoPayEnabled: !paymentSettings.autoPayEnabled })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${paymentSettings.autoPayEnabled ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"}`}
                        aria-pressed={paymentSettings.autoPayEnabled}
                        aria-label="Toggle research auto-pay"
                      >
                        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${paymentSettings.autoPayEnabled ? "translate-x-5" : "translate-x-1"}`} />
                      </button>
                    </div>
                    {paymentSettings.autoPayEnabled && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">Cap</span>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={paymentSettings.autoPayMaxUSDC.toFixed(3)}
                          onChange={(event) => updatePaymentSettings({ autoPayMaxUSDC: Number(event.target.value) })}
                          className="w-20 rounded-md border border-purple-100 dark:border-purple-800 bg-white dark:bg-gray-900 px-2 py-1 text-[10px] font-mono text-purple-800 dark:text-purple-200 outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <span className="text-[10px] text-purple-500 dark:text-purple-400">USDC/query</span>
                      </div>
                    )}
                  </div>
                  {lastResearchPayment && (
                    <div className="mb-2 rounded-lg bg-white/70 dark:bg-black/20 border border-purple-100 dark:border-purple-800/30 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300">Last research</span>
                        <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300">
                          ${(lastResearchPayment.details?.cost || 0).toFixed(3)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-purple-600 dark:text-purple-400">
                        {lastResearchPayment.description}
                      </p>
                    </div>
                  )}
                  <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-purple-500 underline"
                  >
                    Get testnet USDC from Circle faucet →
                  </a>
                </div>
              )}

              {/* Credits summary — no referral code (referral tracking not built yet) */}
              <div className="px-3 py-2">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                  {creditsStatus.trial.active ? `Research trial — ${creditsStatus.trial.daysRemaining} days remaining` : "Research trial ended"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Bonus research credits: <span className="font-bold text-emerald-600 dark:text-emerald-400">${creditsStatus.credits.bonus.toFixed(3)} USDC</span>
                  {creditsStatus.referral.totalEarned > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">+${creditsStatus.referral.totalEarned.toFixed(2)} earned</span>
                  )}
                </p>
              </div>

              {/* Available actions */}
              {creditsStatus.referral.availableActions.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Earn research credits:</p>
                  <div className="flex flex-col gap-1.5">
                    {creditsStatus.referral.availableActions.map(action => (
                      <div key={action.key} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {action.emoji} {action.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+${action.credits.toFixed(2)}</span>
                          {action.key === "share_app" ? (
                            shareStep === "claimed" ? (
                              <span className="px-2 py-0.5 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">Claimed ✓</span>
                            ) : shareStep === "shared" ? (
                              <button
                                onClick={handleShareConfirm}
                                className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                              >
                                Confirm share
                              </button>
                            ) : (
                              <button
                                onClick={handleShare}
                                className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                              >
                                Share
                              </button>
                            )
                          ) : action.key === "gooddollar_claim" ? (
                            <button
                              onClick={onGoodDollarClaim}
                              className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                            >
                              Claim
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="url"
                                placeholder="Paste URL"
                                value={claimingKey === action.key ? proofInput : ""}
                                onFocus={() => setClaimingKey(action.key)}
                                onChange={e => setProofInput(e.target.value)}
                                className="w-24 px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              />
                              <button
                                onClick={async () => { await claimReward(action.key as RewardActionKey, proofInput); setProofInput(""); setClaimingKey(null); }}
                                disabled={!proofInput}
                                className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                              >
                                Claim
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed actions — claimed history */}
              {creditsStatus.referral.completedActions.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-1.5">Claimed:</p>
                  <div className="flex flex-col gap-1">
                    {creditsStatus.referral.completedActions.map(actionKey => {
                      const reward = REWARD_ACTIONS[actionKey as keyof typeof REWARD_ACTIONS];
                      if (!reward) return null;
                      return (
                        <div key={actionKey} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 dark:text-gray-500">
                            {reward.emoji} {reward.label}
                          </span>
                          <span className="text-emerald-500 font-bold">Claimed ✓</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
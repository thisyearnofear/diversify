import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCredits } from "../../hooks/use-credits";
import { REWARD_ACTIONS } from "../../constants/credits";
import type { RewardActionKey } from "../../constants/credits";

interface FreemiumPanelProps {
  onGoodDollarClaim: () => void;
}

export default function FreemiumPanel({ onGoodDollarClaim }: FreemiumPanelProps) {
  const { status: creditsStatus, claimReward, shareApp } = useCredits();
  const [showFreemium, setShowFreemium] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [shareStep, setShareStep] = useState<"idle" | "shared" | "claimed">("idle");

  if (!creditsStatus) return null;
  const isLow = creditsStatus.credits.bonus < 0.05;

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
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs ${
          isLow
            ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200/60 dark:border-amber-700/40"
            : "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200/60 dark:border-emerald-700/40"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className={`font-bold ${isLow ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
            Research Credits: ${creditsStatus.credits.bonus.toFixed(3)} USDC
          </span>
          {isLow && creditsStatus.credits.bonus > 0 && (
            <span className="bg-amber-400 text-amber-900 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
              Low
            </span>
          )}
          {!isLow && creditsStatus.referral.availableActions.length > 0 && (
            <span className="bg-amber-400 text-amber-900 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
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
              {/* Credits summary */}
              <div className="px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-100">Research Credits</span>
                  <span className={`text-xs font-bold ${isLow ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    ${creditsStatus.credits.bonus.toFixed(3)} USDC
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                  Each research query costs ~$0.015. You have ~{Math.floor(creditsStatus.credits.bonus / 0.015)} queries remaining.
                  {creditsStatus.referral.totalEarned > 0 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">(+${creditsStatus.referral.totalEarned.toFixed(2)} earned)</span>
                  )}
                </p>
                {creditsStatus.credits.bonus <= 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg p-2 mb-2">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Research paused — no credits remaining.
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      Earn credits below or add funds to resume evidence-backed responses.
                    </p>
                  </div>
                )}
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
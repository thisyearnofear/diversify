import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCredits } from "../../hooks/use-credits";

interface FreemiumPanelProps {
  onGoodDollarClaim: () => void;
}

export default function FreemiumPanel({ onGoodDollarClaim }: FreemiumPanelProps) {
  const { status: creditsStatus, claimReward, shareApp } = useCredits();
  const [showFreemium, setShowFreemium] = useState(false);
  const [proofInput, setProofInput] = useState("");
  const [claimingKey, setClaimingKey] = useState<string | null>(null);

  if (!creditsStatus) return null;

  return (
    <div className="px-4 pt-1 pb-2">
      <button
        onClick={() => setShowFreemium(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200/60 dark:border-emerald-700/40 text-xs"
      >
        <span className="flex items-center gap-2">
          {creditsStatus.trial.active ? (
            <span className="font-bold text-emerald-700 dark:text-emerald-300">🎁 Free Trial — {creditsStatus.trial.daysRemaining}d left</span>
          ) : (
            <span className="font-bold text-teal-700 dark:text-teal-300">💳 Credits: ${creditsStatus.credits.bonus.toFixed(3)} USDC</span>
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
              {/* Trial / Credits summary */}
              <div className="px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100">
                    {creditsStatus.trial.active ? `Free trial — ${creditsStatus.trial.daysRemaining} days remaining` : "Trial ended"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bonus credits: <span className="font-bold text-emerald-600 dark:text-emerald-400">${creditsStatus.credits.bonus.toFixed(3)} USDC</span>
                    {creditsStatus.referral.totalEarned > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">+${creditsStatus.referral.totalEarned.toFixed(2)} earned</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Your referral code</p>
                  <p className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">{creditsStatus.referral.code}</p>
                </div>
              </div>

              {/* Earn more actions */}
              {creditsStatus.referral.availableActions.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Earn free credits:</p>
                  <div className="flex flex-col gap-1.5">
                    {creditsStatus.referral.availableActions.map(action => (
                      <div key={action.key} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {action.emoji} {action.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+${action.credits.toFixed(2)}</span>
                          {action.key === "share_app" ? (
                            <button
                              onClick={async () => { setClaimingKey(action.key); await shareApp(); setClaimingKey(null); }}
                              disabled={claimingKey === action.key}
                              className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                            >
                              {claimingKey === action.key ? "…" : "Share"}
                            </button>
                          ) : action.key === "gooddollar_claim" ? (
                            <button
                              onClick={() => { onGoodDollarClaim(); }}
                              className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
                            >
                              Claim
                            </button>
                          ) : ["blog_post", "youtube_video", "twitter_thread"].includes(action.key) ? (
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
                                onClick={async () => { await claimReward(action.key, proofInput); setProofInput(""); setClaimingKey(null); }}
                                disabled={!proofInput}
                                className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                              >
                                Claim
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={async () => { setClaimingKey(action.key); await claimReward(action.key); setClaimingKey(null); }}
                              disabled={claimingKey === action.key}
                              className="px-2 py-0.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg disabled:opacity-50 transition-colors"
                            >
                              {claimingKey === action.key ? "…" : "Claim"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
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

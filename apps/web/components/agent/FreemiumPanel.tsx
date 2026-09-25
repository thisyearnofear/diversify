import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCredits } from "../../hooks/use-credits";
import { useResearchPaymentSettings } from "../../hooks/use-research-account";
import { REWARD_ACTIONS } from "../../constants/credits";
import type { RewardActionKey } from "../../constants/credits";

interface FreemiumPanelProps {
  onGoodDollarClaim: () => void;
}

export default function FreemiumPanel({ onGoodDollarClaim }: FreemiumPanelProps) {
  const { status: creditsStatus, claimReward, shareApp } = useCredits();
  const { settings: paymentSettings, updateSettings: updatePaymentSettings } =
    useResearchPaymentSettings();
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
      {/* Collapsed state: one quiet text line — the balance belongs in
          the footer as a footnote, not a banner. Expanded is unchanged. */}
      <button
        onClick={() => setShowFreemium(v => !v)}
        aria-expanded={showFreemium}
        className={`w-full flex items-center justify-between py-1 text-xs transition-colors ${
          isLow
            ? "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        }`}
      >
        <span>
          ${creditsStatus.credits.bonus.toFixed(2)} protection balance
          {creditsStatus.referral.availableActions.length > 0 &&
            ` · ${creditsStatus.referral.availableActions.length} ways to earn`}
        </span>
        <span aria-hidden="true">{showFreemium ? "▴" : "▾"}</span>
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
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-100">Protection Balance</span>
                  <span className={`text-xs font-bold ${isLow ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    ${creditsStatus.credits.bonus.toFixed(3)} USDC
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                  Reviews draw from this balance only when the Guardian finds something worth a decision — every draw is itemized in your activity feed.
                  {creditsStatus.referral.totalEarned > 0 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">(+${creditsStatus.referral.totalEarned.toFixed(2)} earned)</span>
                  )}
                </p>
                {creditsStatus.credits.bonus <= 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg p-2 mb-2">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Reviews paused — Protection Balance is empty.
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      Earn credits below or add funds to resume evidence-backed reviews.
                    </p>
                  </div>
                )}
              </div>

              {/* Auto-fund bound — reviews under the cap go straight to
                  funding consent; above it you approve first */}
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Auto-fund reviews
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {paymentSettings.autoPayEnabled
                        ? `Reviews under $${paymentSettings.autoPayMaxUSDC.toFixed(2)} go straight to funding — your wallet signature is still the consent.`
                        : "Every funded review asks you first."}
                    </p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={paymentSettings.autoPayEnabled}
                    onClick={() =>
                      updatePaymentSettings({
                        autoPayEnabled: !paymentSettings.autoPayEnabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      paymentSettings.autoPayEnabled
                        ? "bg-emerald-500"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        paymentSettings.autoPayEnabled ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                {paymentSettings.autoPayEnabled && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">Cap per review:</span>
                    {[0.02, 0.05, 0.1, 0.25].map((cap) => (
                      <button
                        key={cap}
                        onClick={() => updatePaymentSettings({ autoPayMaxUSDC: cap })}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                          paymentSettings.autoPayMaxUSDC === cap
                            ? "bg-emerald-500 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        ${cap.toFixed(2)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Available actions */}
              {creditsStatus.referral.availableActions.length > 0 && (
                <div className="px-3 py-2">
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">Earn balance credits:</p>
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
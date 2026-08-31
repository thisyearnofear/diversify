import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { StepCard, QuickSelect } from "../../shared/TabComponents";
import { Coin } from "../../shared/FloatingCoins";
import { USER_GOALS, RISK_LEVELS, TIME_HORIZONS } from "@/hooks/use-protection-profile";
import type { UserGoal, ProfileMode } from "@/hooks/use-protection-profile";

/**
 * CoinFlipSteps — the CoinSteps motif doing work inside the product.
 *
 * Three coins, one per wizard step: the current step's coin is bright and
 * face-up, completed coins have flipped to their settled face, upcoming
 * coins sit dimmed. The flip spring is the same rotateY family as
 * LensCoinSelector's minting animation — the onboarding signature
 * interaction reconnected to the plan wizard (Wave 10 brand continuity).
 * Disabled under prefers-reduced-motion (coins just change state).
 */
function CoinFlipSteps({ current, total }: { current: number; total: number }) {
    const reduceMotion = useReducedMotion();
    return (
        <div
            className="flex items-center justify-center gap-3 mb-3"
            role="img"
            aria-label={`Step ${current + 1} of ${total}`}
        >
            {Array.from({ length: total }, (_, i) => {
                const isComplete = i < current;
                const isCurrent = i === current;
                return (
                    <motion.div
                        key={i}
                        animate={
                            isComplete && !reduceMotion
                                ? { rotateY: 360, scale: 1 }
                                : { rotateY: 0, scale: isCurrent ? 1.1 : 1 }
                        }
                        transition={
                            isComplete && !reduceMotion
                                ? { type: 'spring', stiffness: 260, damping: 18 }
                                : { type: 'spring', stiffness: 320, damping: 24 }
                        }
                        style={{ transformStyle: 'preserve-3d' }}
                        className={isComplete || isCurrent ? '' : 'opacity-40'}
                    >
                        <Coin
                            size={28}
                            symbol={String(i + 1)}
                            variant="progress"
                            shine={isCurrent}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}

interface ProfileWizardProps {
    mode: ProfileMode;
    currentStep: number;
    config: {
        userGoal: UserGoal | null;
        riskTolerance: "Conservative" | "Balanced" | "Aggressive" | null;
        timeHorizon: "1 month" | "3 months" | "1 year" | null;
    };
    currentGoalIcon: string;
    currentGoalLabel: string;
    currentRiskLabel: string;
    currentTimeHorizonLabel: string;
    onSetUserGoal: (goal: UserGoal) => void;
    onSetRiskTolerance: (risk: "Conservative" | "Balanced" | "Aggressive") => void;
    onSetTimeHorizon: (horizon: "1 month" | "3 months" | "1 year") => void;
    onNextStep: () => void;
    onSkipToEnd: () => void;
    onCompleteEditing: () => void;
    onStartEditing: () => void;
    onPrevStep?: () => void;
    onBack?: () => void;
}

export default function ProfileWizard({
    mode,
    currentStep,
    config,
    currentGoalIcon,
    currentGoalLabel,
    currentRiskLabel,
    currentTimeHorizonLabel,
    onSetUserGoal,
    onSetRiskTolerance,
    onSetTimeHorizon,
    onNextStep,
    onSkipToEnd,
    onCompleteEditing,
    onStartEditing,
    onPrevStep,
    onBack,
}: ProfileWizardProps) {
    return (
        <>
            <AnimatePresence mode="wait">
                {mode === "editing" && (
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <CoinFlipSteps current={currentStep} total={3} />
                        {currentStep === 0 && (
                            <StepCard
                                step={1}
                                totalSteps={3}
                                title="What's your primary goal?"
                                onNext={() => {
                                    if (config.userGoal) onNextStep();
                                }}
                                onSkip={onSkipToEnd}
                                canProceed={!!config.userGoal}
                            >
                                <QuickSelect
                                    options={USER_GOALS.map((g) => ({
                                        value: g.value,
                                        label: g.label,
                                        icon: g.icon,
                                        description: g.description,
                                    }))}
                                    value={config.userGoal || "exploring"}
                                    onChange={(v) => onSetUserGoal(v as UserGoal)}
                                />
                            </StepCard>
                        )}

                        {currentStep === 1 && (
                            <StepCard
                                step={2}
                                totalSteps={3}
                                title="What's your risk tolerance?"
                                onNext={onNextStep}
                                onSkip={onSkipToEnd}
                                onBack={onBack || onPrevStep}
                                canProceed={!!config.riskTolerance}
                            >
                                <QuickSelect
                                    options={RISK_LEVELS.map((r) => ({
                                        value: r.value,
                                        label: r.label,
                                        icon: r.icon,
                                    }))}
                                    value={config.riskTolerance || "Balanced"}
                                    onChange={(v) =>
                                        onSetRiskTolerance(
                                            v as "Conservative" | "Balanced" | "Aggressive"
                                        )
                                    }
                                    columns={3}
                                />
                            </StepCard>
                        )}

                        {currentStep === 2 && (
                            <StepCard
                                step={3}
                                totalSteps={3}
                                title="What's your time horizon?"
                                onNext={onCompleteEditing}
                                onSkip={onSkipToEnd}
                                onBack={onPrevStep}
                                isLast
                                canProceed={!!config.timeHorizon}
                            >
                                <QuickSelect
                                    options={TIME_HORIZONS.map((t) => ({
                                        value: t.value,
                                        label: t.label,
                                        description: t.description,
                                    }))}
                                    value={config.timeHorizon || "3 months"}
                                    onChange={(v) =>
                                        onSetTimeHorizon(v as "1 month" | "3 months" | "1 year")
                                    }
                                    columns={3}
                                />
                            </StepCard>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {mode === "complete" && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-lg">{currentGoalIcon}</span>
                        <div>
                            <div className="text-xs font-bold text-gray-900">
                                {currentGoalLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                                {currentRiskLabel} • {currentTimeHorizonLabel}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onStartEditing}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                    >
                        Edit
                    </button>
                </motion.div>
            )}
        </>
    );
}

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StepCard, QuickSelect } from "../../shared/TabComponents";
import { USER_GOALS, RISK_LEVELS, TIME_HORIZONS } from "@/hooks/use-protection-profile";
import type { UserGoal } from "@/hooks/use-protection-profile";

interface ProfileWizardProps {
    mode: "idle" | "editing" | "complete";
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
}: ProfileWizardProps) {
    return (
        <>
            <AnimatePresence mode="wait">
                {mode === "editing" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
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

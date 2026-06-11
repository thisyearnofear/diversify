/**
 * GuidedTour — Consolidated first-run tour with region/goal personalization.
 *
 * Consolidates the previous 4-step product walkthrough + InlineOnboarding's
 * 3-step region/goal wizard into a single 5-step first-run tour.
 *
 * Per the Core Principles:
 *   - ENHANCEMENT FIRST: extends the existing GuidedTour surface rather than
 *     creating a new component.
 *   - CONSOLIDATION: replaces InlineOnboarding's standalone wizard and its
 *     duplicate localStorage key.
 *   - DRY: the region/goal picker UI is rendered here, not duplicated in
 *     InlineOnboarding (which is now deleted).
 *   - MODULAR: typed steps with explicit callbacks.
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTour } from "@/context/app/TourContext";
import { useNavigation } from "@/context/app/NavigationContext";
import { useProtectionProfile } from "@/hooks/use-protection-profile";
import { REGIONS, type Region } from "@/hooks/use-user-region";
import type { TabId } from "@/constants/tabs";

// ─── Tour Steps ────────────────────────────────────────────────────────────

interface TourStep {
    id: string;
    title: string;
    description: string;
    tab: TabId;
    interactive?: boolean; // step contains inline UI (region/goal picker)
    action?: {
        label: string;
        onClick: () => void;
    };
}

const TOUR_STEPS: TourStep[] = [
    {
        id: "welcome",
        title: "See What You're Losing",
        description: "Your money loses value every day. Let's see exactly how much and what you can do about it.",
        tab: "overview",
    },
    {
        id: "swap",
        title: "Take Action in 2 Minutes",
        description: "Convert just $10-20 to a more stable currency. You'll see the difference immediately.",
        tab: "exchange",
    },
    {
        id: "protect",
        title: "Get Your Personal Strategy",
        description: "Tell us your goals and we'll show you the best way to protect your specific situation.",
        tab: "protect",
    },
    {
        id: "personalize",
        title: "Personalize Your Plan",
        description: "Set your region and goal — we'll tailor inflation data and recommendations just for you.",
        tab: "overview",
        interactive: true,
    },
    {
        id: "complete",
        title: "You're Ready!",
        description: "Connect your wallet to start protecting your savings. No sign-up required — takes 30 seconds.",
        tab: "overview",
    },
];

const GOAL_OPTIONS = [
    { id: "inflation_protection", label: "Protect Savings", icon: "🛡️", desc: "Hedge against currency devaluation" },
    { id: "geographic_diversification", label: "Global Diversity", icon: "🌍", desc: "Spread wealth across economies" },
    { id: "rwa_access", label: "Real-World Assets", icon: "🥇", desc: "Access tokenized gold & yields" },
    { id: "exploring", label: "Just Exploring", icon: "🔍", desc: "See what DiversiFi can do" },
];

// ─── Component ─────────────────────────────────────────────────────────────

export default function GuidedTour() {
    const { guidedTour, nextTourStep, dismissTour } = useTour();
    const { setActiveTab } = useNavigation();
    const { config, setMultipleConfig } = useProtectionProfile();

    const [selectedRegion, setSelectedRegion] = useState<string | null>(config.userRegion || null);
    const [selectedGoal, setSelectedGoal] = useState<string | null>(config.userGoal || null);

    // Synchronise selections from persisted config on mount
    useEffect(() => {
        if (config.userRegion) setSelectedRegion(config.userRegion);
        if (config.userGoal) setSelectedGoal(config.userGoal);
    }, [config.userRegion, config.userGoal]);

    useEffect(() => {
        if (!guidedTour) return;

        const currentStep = TOUR_STEPS[guidedTour.currentStep];
        if (currentStep) {
            setActiveTab(currentStep.tab);
        }
    }, [guidedTour, setActiveTab]);

    if (!guidedTour) return null;

    const currentStep = TOUR_STEPS[guidedTour.currentStep];
    const isLastStep = guidedTour.currentStep === TOUR_STEPS.length - 1;
    const isFirstStep = guidedTour.currentStep === 0;
    const isPersonalizeStep = currentStep.interactive;

    const canProceedFromPersonalize = selectedRegion && selectedGoal;

    const handleNext = () => {
        if (isPersonalizeStep) {
            // Save region + goal to protection profile before proceeding
            if (canProceedFromPersonalize) {
                setMultipleConfig({
                    userRegion: selectedRegion as any,
                    userGoal: selectedGoal as any,
                });
            }
            const nextStep = TOUR_STEPS[guidedTour.currentStep + 1];
            nextTourStep(nextStep.tab, nextStep.id);
        } else if (isLastStep) {
            dismissTour(guidedTour.tourId);
        } else {
            const nextStep = TOUR_STEPS[guidedTour.currentStep + 1];
            nextTourStep(nextStep.tab, nextStep.id);
        }
    };

    const handleSkip = () => {
        dismissTour(guidedTour.tourId);
    };

    const getStepStyle = () => {
        if (isFirstStep) return "bg-gradient-to-r from-red-600 to-orange-600";
        if (isLastStep) return "bg-gradient-to-r from-green-600 to-emerald-600";
        return "bg-gradient-to-r from-blue-600 to-indigo-600";
    };

    const getStepIcon = () => {
        if (isFirstStep) return "⚠️";
        if (isLastStep) return "🎉";
        if (isPersonalizeStep) return "🎯";
        return "💪";
    };

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={`mb-4 ${getStepStyle()} text-white px-4 py-4 rounded-xl shadow-lg`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getStepIcon()}</span>
                        <h3 className="text-sm font-black">{currentStep.title}</h3>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed font-medium">
                        {currentStep.description}
                    </p>
                </div>
                <button
                    onClick={handleSkip}
                    className="text-white/60 hover:text-white text-sm font-bold px-2 ml-2"
                    title="Skip tour"
                >
                    ✕
                </button>
            </div>

            {/* ── Interactive region/goal picker for the "personalize" step ── */}
            {isPersonalizeStep && (
                <div className="mb-3 space-y-3 bg-white/10 rounded-xl p-3">
                    {/* Region picker */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                            Your region
                        </p>
                        <div className="flex gap-1.5">
                            {REGIONS.map((region) => (
                                <button
                                    key={region}
                                    onClick={() => setSelectedRegion(region)}
                                    className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                                        selectedRegion === region
                                            ? "bg-white text-gray-900 font-black"
                                            : "bg-white/10 text-white/80 hover:bg-white/20 font-bold"
                                    }`}
                                >
                                    <span className="text-sm block">
                                        {region === "Africa" ? "🌍" : region === "LatAm" ? "🌋" : region === "Asia" ? "⛩️" : region === "Europe" ? "🏰" : "🗽"}
                                    </span>
                                    <span className="text-[10px]">{region}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Goal picker */}
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-white/70 mb-2">
                            Your goal
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {GOAL_OPTIONS.map((goal) => (
                                <button
                                    key={goal.id}
                                    onClick={() => setSelectedGoal(goal.id)}
                                    className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-left transition-all ${
                                        selectedGoal === goal.id
                                            ? "bg-white text-gray-900 font-black"
                                            : "bg-white/10 text-white/80 hover:bg-white/20 font-semibold"
                                    }`}
                                >
                                    <span>{goal.icon}</span>
                                    <div className="text-[10px] leading-tight">
                                        <div>{goal.label}</div>
                                        <div className="opacity-70 font-medium">{goal.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-6 rounded-full transition-all ${
                                i <= guidedTour.currentStep ? "bg-white" : "bg-white/30"
                            }`}
                        />
                    ))}
                </div>
                <div className="flex gap-2">
                    {!isLastStep && (
                        <button
                            onClick={handleSkip}
                            className="text-xs font-bold text-white/80 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            Skip
                        </button>
                    )}
                    <button
                        onClick={handleNext}
                        disabled={isPersonalizeStep && !canProceedFromPersonalize}
                        className={`text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg ${
                            isPersonalizeStep && !canProceedFromPersonalize
                                ? "bg-white/30 text-white/50 cursor-not-allowed"
                                : "bg-white text-gray-900 hover:bg-white/90"
                        }`}
                    >
                        {isPersonalizeStep
                            ? "Continue →"
                            : isLastStep
                                ? "Let's Go!"
                                : isFirstStep
                                    ? "Show Me"
                                    : "Next →"}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

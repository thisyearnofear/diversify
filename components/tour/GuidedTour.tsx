import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useAppState } from "@/context/AppStateContext";

interface TourStep {
    id: string;
    title: string;
    description: string;
    tab: string;
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
        tab: "swap",
    },
    {
        id: "protect",
        title: "Get Your Personal Strategy",
        description: "Tell us your goals and we'll show you the best way to protect your specific situation.",
        tab: "protect",
    },
    {
        id: "complete",
        title: "You're Ready!",
        description: "Connect your wallet to start protecting your savings. It's free and takes 30 seconds.",
        tab: "overview",
    },
];

export default function GuidedTour() {
    const { guidedTour, nextTourStep, dismissTour, setActiveTab } = useAppState();

    useEffect(() => {
        if (!guidedTour) return;

        const currentStep = TOUR_STEPS[guidedTour.currentStep];
        if (currentStep && currentStep.tab !== guidedTour.highlightSection) {
            setActiveTab(currentStep.tab);
        }
    }, [guidedTour, setActiveTab]);

    if (!guidedTour) return null;

    const currentStep = TOUR_STEPS[guidedTour.currentStep];
    const isLastStep = guidedTour.currentStep === TOUR_STEPS.length - 1;
    const isFirstStep = guidedTour.currentStep === 0;

    const handleNext = () => {
        if (isLastStep) {
            dismissTour(guidedTour.tourId);
        } else {
            const nextStep = TOUR_STEPS[guidedTour.currentStep + 1];
            nextTourStep(nextStep.tab, nextStep.id);
        }
    };

    const handleSkip = () => {
        dismissTour(guidedTour.tourId);
    };

    // ENHANCED: Different visual treatment based on step emotion
    const getStepStyle = () => {
        if (isFirstStep) {
            return "bg-gradient-to-r from-red-600 to-orange-600"; // Urgency
        }
        if (isLastStep) {
            return "bg-gradient-to-r from-green-600 to-emerald-600"; // Success
        }
        return "bg-gradient-to-r from-blue-600 to-indigo-600"; // Action
    };

    const getStepIcon = () => {
        if (isFirstStep) return "⚠️";
        if (isLastStep) return "🎉";
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

            <div className="flex items-center justify-between">
                <div className="flex gap-1">
                    {TOUR_STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-8 rounded-full transition-all ${i <= guidedTour.currentStep ? "bg-white" : "bg-white/30"
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
                        className="text-xs font-bold bg-white text-gray-900 px-4 py-2 rounded-lg hover:bg-white/90 transition-colors shadow-lg"
                    >
                        {isLastStep ? "Let's Go!" : isFirstStep ? "Show Me" : "Next"} →
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

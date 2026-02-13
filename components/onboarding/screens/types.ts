export interface OnboardingScreenProps {
    onBack?: () => void;
    onSkip?: () => void;
}

export interface StrategyImplications {
    gradient: string;
    description: string;
    recommendations: string[];
    metrics: string[];
    assets: string[];
}

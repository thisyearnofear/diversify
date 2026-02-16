export interface OnboardingScreenProps {
    onBack?: () => void;
    onSkip?: () => void;
    onConnectWallet?: () => void;
    isWalletConnected?: boolean;
}

export interface StrategyImplications {
    gradient: string;
    description: string;
    recommendations: string[];
    metrics: string[];
    assets: string[];
}

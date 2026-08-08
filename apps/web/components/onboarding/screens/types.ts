export interface OnboardingScreenProps {
    onBack?: () => void;
    onSkip?: () => void;
    onConnectWallet?: () => Promise<void> | void;
    isWalletConnected?: boolean;
}

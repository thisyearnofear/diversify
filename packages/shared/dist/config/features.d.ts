/**
 * Feature Flags Configuration
 *
 * Centralized feature toggles following Core Principles:
 * - DRY: Single source of truth for feature availability
 * - CLEAN: Clear separation between core AI and optional blockchain features
 * - MODULAR: Each feature can be enabled/disabled independently
 *
 * Core AI Features: Always available if API keys present
 * Blockchain Features: Optional, clearly labeled as experimental/beta
 */
export declare const AI_FEATURES: {
    /** Portfolio analysis and recommendations via Venice/Gemini */
    readonly ANALYSIS: boolean;
    /** Voice transcription via OpenAI Whisper or ElevenLabs Scribe */
    readonly VOICE_INPUT: boolean;
    /** Text-to-speech via Venice/ElevenLabs */
    readonly VOICE_OUTPUT: boolean;
    /** AI chat assistant */
    readonly CHAT: boolean;
    /** Web-enriched analysis (Venice only) */
    readonly WEB_SEARCH: boolean;
};
export declare const AUTONOMOUS_FEATURES: {
    /**
     * Autonomous agent mode - AI pays for its own data access
     * Requires: Arc Network wallet or Circle wallet + x402 setup
     * Status: Testnet only, experimental
     */
    readonly AUTONOMOUS_MODE: boolean;
    /**
     * Arc Network integration
     * Status: Testnet only (chainId: 5042002)
     */
    readonly ARC_NETWORK: boolean;
    /**
     * Premium data via x402 payments
     * Status: Requires Arc Network
     */
    readonly PREMIUM_DATA: boolean;
};
export declare const UI_FEATURES: {
    /** Show voice button in header */
    readonly VOICE_UI: boolean;
    /** Show AI assistant panel */
    readonly AI_ASSISTANT: boolean;
    /** Show autonomous mode toggle (only if available) */
    readonly AUTONOMOUS_UI: boolean;
};
export declare const WALLET_FEATURES: {
    /** Enable Privy for social login (email/Google/X/Discord/Apple/SMS/Farcaster) */
    readonly PRIVY_ENABLED: boolean;
    /** Privy App ID */
    readonly PRIVY_APP_ID: string;
};
export declare const FEATURE_DESCRIPTIONS: {
    readonly aiAnalysis: {
        readonly title: "AI Insights";
        readonly description: "Portfolio analysis and recommendations powered by AI";
    };
    readonly voiceInput: {
        readonly title: "Voice Commands";
        readonly description: "Speak naturally to interact with the app";
    };
    readonly voiceOutput: {
        readonly title: "Voice Responses";
        readonly description: "AI responses read aloud";
    };
    readonly autonomousMode: {
        readonly title: "Autonomous Mode (Beta)";
        readonly description: "AI pays for its own premium data access via x402 protocol";
        readonly warning: "Experimental - Testnet only";
    };
};
export declare const hasAIFeatures: () => boolean;
export declare const hasAutonomousFeatures: () => boolean;
//# sourceMappingURL=features.d.ts.map
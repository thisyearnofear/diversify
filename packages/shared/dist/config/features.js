"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasAutonomousFeatures = exports.hasAIFeatures = exports.FEATURE_DESCRIPTIONS = exports.WALLET_FEATURES = exports.UI_FEATURES = exports.AUTONOMOUS_FEATURES = exports.AI_FEATURES = void 0;
// Core AI capabilities (no blockchain required)
exports.AI_FEATURES = {
    /** Portfolio analysis and recommendations via Venice/Gemini */
    ANALYSIS: !!(process.env.VENICE_API_KEY || process.env.GEMINI_API_KEY),
    /** Voice transcription via OpenAI Whisper or ElevenLabs Scribe */
    VOICE_INPUT: !!(process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY),
    /** Text-to-speech via Venice/ElevenLabs */
    VOICE_OUTPUT: !!(process.env.VENICE_API_KEY || process.env.ELEVENLABS_API_KEY),
    /** AI chat assistant */
    CHAT: !!(process.env.VENICE_API_KEY || process.env.GEMINI_API_KEY),
    /** Web-enriched analysis (Venice only) */
    WEB_SEARCH: !!process.env.VENICE_API_KEY,
};
// Autonomous/Blockchain features (optional, experimental)
exports.AUTONOMOUS_FEATURES = {
    /**
     * Autonomous agent mode - AI pays for its own data access
     * Requires: Arc Network wallet or Circle wallet + x402 setup
     * Status: Testnet only, experimental
     */
    AUTONOMOUS_MODE: process.env.ENABLE_AUTONOMOUS_MODE === 'true',
    /**
     * Arc Network integration
     * Status: Testnet only (chainId: 5042002)
     */
    ARC_NETWORK: process.env.NEXT_PUBLIC_ENABLE_ARC === 'true',
    /**
     * Premium data via x402 payments
     * Status: Requires Arc Network
     */
    PREMIUM_DATA: process.env.NEXT_PUBLIC_ENABLE_ARC === 'true' &&
        process.env.ENABLE_AUTONOMOUS_MODE === 'true',
};
// UI/UX features
exports.UI_FEATURES = {
    /** Show voice button in header */
    VOICE_UI: exports.AI_FEATURES.VOICE_INPUT,
    /** Show AI assistant panel */
    AI_ASSISTANT: exports.AI_FEATURES.ANALYSIS || exports.AI_FEATURES.CHAT,
    /** Show autonomous mode toggle (only if available) */
    AUTONOMOUS_UI: exports.AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
};
// Wallet UX features (web onboarding + wallet connection)
exports.WALLET_FEATURES = {
    /** Enable Privy for social login (email/Google/X/Discord/Apple/SMS/Farcaster) */
    PRIVY_ENABLED: process.env.NEXT_PUBLIC_ENABLE_PRIVY !== 'false',
    /** Privy App ID */
    PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
};
// Feature descriptions for user-facing UI
exports.FEATURE_DESCRIPTIONS = {
    aiAnalysis: {
        title: 'AI Insights',
        description: 'Portfolio analysis and recommendations powered by AI',
    },
    voiceInput: {
        title: 'Voice Commands',
        description: 'Speak naturally to interact with the app',
    },
    voiceOutput: {
        title: 'Voice Responses',
        description: 'AI responses read aloud',
    },
    autonomousMode: {
        title: 'Autonomous Mode (Beta)',
        description: 'AI pays for its own premium data access via x402 protocol',
        warning: 'Experimental - Testnet only',
    },
};
// Helper to check if any AI features are available
const hasAIFeatures = () => exports.AI_FEATURES.ANALYSIS ||
    exports.AI_FEATURES.VOICE_INPUT ||
    exports.AI_FEATURES.CHAT;
exports.hasAIFeatures = hasAIFeatures;
// Helper to check if autonomous features are available
const hasAutonomousFeatures = () => exports.AUTONOMOUS_FEATURES.AUTONOMOUS_MODE;
exports.hasAutonomousFeatures = hasAutonomousFeatures;
//# sourceMappingURL=features.js.map
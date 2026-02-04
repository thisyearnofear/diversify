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

// Core AI capabilities (no blockchain required)
export const AI_FEATURES = {
  /** Portfolio analysis and recommendations via Venice/Gemini */
  ANALYSIS: !!(process.env.VENICE_API_KEY || process.env.GEMINI_API_KEY),
  
  /** Voice transcription via OpenAI/Venice */
  VOICE_INPUT: !!process.env.OPENAI_API_KEY,
  
  /** Text-to-speech via Venice/ElevenLabs */
  VOICE_OUTPUT: !!(process.env.VENICE_API_KEY || process.env.ELEVENLABS_API_KEY),
  
  /** AI chat assistant */
  CHAT: !!(process.env.VENICE_API_KEY || process.env.GEMINI_API_KEY),
  
  /** Web-enriched analysis (Venice only) */
  WEB_SEARCH: !!process.env.VENICE_API_KEY,
} as const;

// Autonomous/Blockchain features (optional, experimental)
export const AUTONOMOUS_FEATURES = {
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
} as const;

// UI/UX features
export const UI_FEATURES = {
  /** Show voice button in header */
  VOICE_UI: AI_FEATURES.VOICE_INPUT,
  
  /** Show AI assistant panel */
  AI_ASSISTANT: AI_FEATURES.ANALYSIS || AI_FEATURES.CHAT,
  
  /** Show autonomous mode toggle (only if available) */
  AUTONOMOUS_UI: AUTONOMOUS_FEATURES.AUTONOMOUS_MODE,
} as const;

// Feature descriptions for user-facing UI
export const FEATURE_DESCRIPTIONS = {
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
} as const;

// Helper to check if any AI features are available
export const hasAIFeatures = () => 
  AI_FEATURES.ANALYSIS || 
  AI_FEATURES.VOICE_INPUT || 
  AI_FEATURES.CHAT;

// Helper to check if autonomous features are available
export const hasAutonomousFeatures = () =>
  AUTONOMOUS_FEATURES.AUTONOMOUS_MODE;

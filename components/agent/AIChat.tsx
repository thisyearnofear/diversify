import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIConversation } from "../../context/AIConversationContext";
import { useNavigation } from "../../context/app/NavigationContext";
import { isTabId, LEGACY_TAB_MAP } from "@/constants/tabs";
import { useAgentChat } from "../../hooks/use-agent-chat";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentVoice } from "../../hooks/use-agent-voice";
import { useCredits } from "../../hooks/use-credits";
import { useClaimFlowContext, useOnClaimSuccess } from "../../hooks/claim-flow-context";
// Deep leaf import — NOT the barrel — so this constant doesn't drag the
// shared AI/swap/ethers stack into the chunk.
import { CELO_TOKEN_ADDRESS_BY_SYMBOL } from "@diversifi/shared/src/config/celo-tokens";
import { useWalletContext } from "../wallet/WalletProvider";
import VoiceButton from "../ui/VoiceButton";
import FreemiumPanel from "./FreemiumPanel";
import SoSoIntelligenceCard from "./SoSoIntelligenceCard";
import SoSoActionModal, { type SoSoTradeProposal } from "./SoSoActionModal";
import dynamic from "next/dynamic";
import SimpleMarkdown from "../shared/SimpleMarkdown";
import Scrim from "../shared/Scrim";
import { ResearchCheck } from "./ResearchCheck";
import { ResearchReceipt } from "./ResearchReceipt";
import { TrustFlow } from "./TrustFlow";
import { GuardianMascot } from "../shared/GuardianMascot";
import { GUARDIAN_DRAWER_SUBTITLE } from "@/constants/guardian-copy";
import { GuardianRecommendationCard } from "./GuardianRecommendationCard";

const IntelligenceHistory = dynamic(() => import("./IntelligenceHistory"), {
  ssr: false,
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

// Track user-message count to distinguish "new message added" from "drawer closed"
function useUserMessageCount(messages: { role: string }[]) {
  return messages.filter(m => m.role === "user").length;
}

const RwaActionWidget = ({ action, onComplete }: { action: any, onComplete: (result: any) => void }) => {
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    setStatus('executing');
    setErrorMessage(null);

    try {
      const userAddress = action.userAddress;
      if (!userAddress || userAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Connect your wallet first');
      }

      // Parse target asset (e.g., "cEUR" → swap some base stablecoin to cEUR)
      const assetParts = action.targetAsset?.split('-') || [];
      const tokenIn = assetParts.length > 1 ? assetParts[1] : 'cUSD';
      const tokenOut = assetParts[0] || action.targetAsset || 'cUSD';

      const amountIn = action.amount?.toString() || '500';

      // Route through vault system: permission check → fee calc → smart account execution
      const response = await fetch('/api/vault/rebalance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress,
          recommendations: [{
            action: 'swap',
            urgency: 'high',
            tokenIn,
            tokenInAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[tokenIn] || CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
            tokenOut,
            tokenOutAddress: CELO_TOKEN_ADDRESS_BY_SYMBOL[tokenOut] || CELO_TOKEN_ADDRESS_BY_SYMBOL.cUSD,
            amountIn: (parseFloat(amountIn) * 1e18).toString(),
            reason: action.reason || `AI-recommended rebalance to ${tokenOut}`,
            estimatedAmountUSD: parseFloat(amountIn),
          }],
        }),
      });

      const result = await response.json();

      if (result.success && result.executed > 0) {
        const tx = result.transactions?.[0];
        setTxHash(tx?.txHash || null);
        setExplorerUrl(tx?.explorerUrl || null);
        setStatus('success');
        onComplete({ txHash: tx?.txHash, explorerUrl: tx?.explorerUrl });
      } else if (result.success && result.skipped > 0) {
        throw new Error('Rebalance skipped — check vault permissions or daily limit');
      } else {
        throw new Error(result.error || result.transactions?.[0]?.error || 'Execution failed');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Transaction failed');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage(null);
    setTxHash(null);
    setExplorerUrl(null);
  };

  return (
    <div className="mt-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-inner w-full max-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
           <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs">⛽</span>
           <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Auto-Saver Wallet</span>
        </div>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">
          {action.network}
        </span>
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
           <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Target Asset</p>
           <p className="text-sm font-black text-gray-800 dark:text-gray-100">{action.targetAsset}</p>
        </div>
        <div className="text-right">
           <p className="text-[10px] uppercase text-gray-400 font-bold mb-1">Est. Amount</p>
           <p className="text-sm font-black text-gray-800 dark:text-gray-100">${action.amount}</p>
        </div>
      </div>

      <button
        onClick={status === 'error' ? handleRetry : handleExecute}
        disabled={status === 'executing' || status === 'success'}
        className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors ${
          status === 'success' ? 'bg-green-500 text-white' :
          status === 'executing' ? 'bg-blue-400 text-white cursor-wait' :
          status === 'error' ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20' :
          'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'
        }`}
      >
        {status === 'idle' && 'Execute Rebalance'}
        {status === 'executing' && (
          <span className="flex items-center justify-center gap-2">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
            Signing tx...
          </span>
        )}
        {status === 'success' && '✓ Executed'}
        {status === 'error' && 'Retry'}
      </button>

      {/* Error message */}
      {status === 'error' && errorMessage && (
        <p className="text-[10px] text-center text-red-500 mt-2 font-medium">
          ⚠ {errorMessage}
        </p>
      )}

      {/* Success with tx hash */}
      {status === 'success' && txHash && (
        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-400 font-medium">
            Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:text-blue-600 underline mt-0.5 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      {status === 'idle' && (
        <p className="text-[10px] text-center text-gray-400 mt-2 font-medium">
          Gas covered autonomously via local MPC wallet
        </p>
      )}
    </div>
  );
};

const HoldActionWidget = ({ action }: { action: any }) => {
  return (
    <div className="mt-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border-2 border-green-200 dark:border-green-700 shadow-inner w-full max-w-[280px]">
      <div className="flex items-center gap-3 mb-3">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-xl shadow-lg"
        >
          ✓
        </motion.div>
        <div>
          <p className="text-xs font-black uppercase text-green-700 dark:text-green-300 tracking-wider">
            Portfolio Status
          </p>
          <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">
            Well-Balanced
          </p>
        </div>
      </div>

      <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
          {action.message || 'Your portfolio is well-diversified. No immediate action needed.'}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-[10px] text-green-600 dark:text-green-400 font-bold">
        <span>💎</span>
        <span>HOLD STEADY</span>
        <span>💎</span>
      </div>
    </div>
  );
};

/**
 * AIChat - Global Bottom Sheet Drawer
 *
 * AGGRESSIVE CONSOLIDATION: Replaces standalone chat with a global
 * overlay that persists context across any screen.
 */
// Persisted user API key (client-side only, never sent to our server unintentionally)
const USER_GEMINI_KEY_STORAGE = "diversifi_user_gemini_key";
const STARTER_PROMPTS = [
  {
    label: "Portfolio summary",
    prompt: "Summarize my portfolio protection status and tell me the top 3 actions to take.",
    badge: "Free",
  },
  {
    label: "Currency risk",
    prompt: "Explain my currency exposure and whether I should protect savings before the next payment cycle.",
    badge: "Free",
  },
  {
    label: "Protection plan",
    prompt: "Create a practical protection plan for my savings using stablecoins, yield, and real-world assets.",
    badge: "Free",
  },
  {
    label: "Payment readiness",
    prompt: "Help me model FX drag for an upcoming supplier payment and decide whether to convert now or wait.",
    badge: "Shield",
  },
] as const;

function useUserGeminiKey() {
  const [key, setKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(USER_GEMINI_KEY_STORAGE) || "";
  });
  const save = (k: string) => {
    const trimmed = k.trim();
    if (trimmed) localStorage.setItem(USER_GEMINI_KEY_STORAGE, trimmed);
    else localStorage.removeItem(USER_GEMINI_KEY_STORAGE);
    setKey(trimmed);
  };
  return { key, save };
}

function ProviderBadge({ provider }: { provider?: string }) {
  if (!provider) return null;
  if (provider === "gemini") return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-500 dark:text-blue-400 opacity-70 mt-0.5">
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
      Gemini
    </span>
  );
  if (provider === "venice") return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 opacity-70 mt-0.5">
      ✦ Venice
    </span>
  );
  return null;
}

function ModelSettingsModal({ onClose, userGeminiKey, onSaveKey }: {
  onClose: () => void;
  userGeminiKey: string;
  onSaveKey: (k: string) => void;
}) {
  const [draft, setDraft] = useState(userGeminiKey);
  const [saved, setSaved] = useState(false);
  // Escape-to-close: focus-trap mirrors the pattern in GuardianPermissionModal
  // so keyboard users land on the first input and can dismiss without a mouse.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-settings-title"
        aria-describedby="model-settings-desc"
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 id="model-settings-title" className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">AI Model Settings</h3>
            <p id="model-settings-desc" className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Default: Gemini (shared key). Add your own for higher limits.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Default model info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-4 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-blue-700 dark:text-blue-300">✦ Default: Gemini Flash</span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400">Powered by Google Gemini 3.1 Flash · No setup needed · Shared rate limits apply</p>
        </div>

        {/* User's own Gemini key */}
        <div className="mb-4">
          <label className="block text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
            Your Gemini API Key <span className="text-gray-400 font-normal normal-case">(optional — removes rate limits)</span>
          </label>
          <input
            type="password"
            value={draft}
            onChange={e => { setDraft(e.target.value); setSaved(false); }}
            placeholder="AIza..."
            className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Stored locally only · Never sent to our servers ·{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Get a free key →</a>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { onSaveKey(draft); setSaved(true); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider py-2.5 rounded-xl transition-colors"
          >
            {saved ? "✓ Saved!" : "Save Key"}
          </button>
          {draft && (
            <button
              onClick={() => { setDraft(""); onSaveKey(""); setSaved(false); }}
              className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIChat() {
  const {
    messages,
    isDrawerOpen,
    setDrawerOpen,
    clearMessages,
    addUserMessage,
    activeGuardianReview,
    setActiveGuardianReview,
  } = useAIConversation();
  const { key: userGeminiKey, save: saveGeminiKey } = useUserGeminiKey();
  const { capabilities, autonomousStatus } = useAgentStatus();
  const { generateSpeech } = useAgentVoice({ apiBase: API_BASE, capabilities });
  const { isChatting, thinkingStep, sendChatMessage } = useAgentChat({
    apiBase: API_BASE,
    capabilities,
    useGlobalConversation: true,
    generateSpeech,
  });
  const { claimReward } = useCredits();
  const { setActiveTab } = useNavigation();
  const { address } = useWalletContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const [inputValue, setInputValue] = React.useState("");
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'history'>('chat');
  // Direct-claim flow: shared from app-level context.
  const flow = useClaimFlowContext();
  useOnClaimSuccess(() => {
    claimReward('gooddollar_claim');
  });
  // When the user initiates a claim from inside the drawer, close the drawer
  // immediately so the celebration overlay (z-50) can render above the
  // background instead of being hidden behind the drawer (z-100).
  const handleClaimFromChat = () => {
    setDrawerOpen(false);
    void flow.handleClaim();
  };
  const [showSettings, setShowSettings] = useState(false);
  const [soSoModalOpen, setSoSoModalOpen] = useState(false);
  const [soSoTradeProposal, setSoSoTradeProposal] = useState<SoSoTradeProposal | null>(null);

  const submitPrompt = (prompt: string) => {
    if (!prompt.trim() || isChatting) return;
    addUserMessage(prompt);
    sendChatMessage(prompt);
    setInputValue("");
  };

  const submitResearchConfirmation = () => {
    if (isChatting) return;
    addUserMessage("Confirm");
    sendChatMessage("confirm");
    setInputValue("");
  };

  // The proactive monitoring loop is mounted at the app root
  // (ProactiveAgentRunner in _app.tsx), not here, so it survives the
  // chat surface being closed.

  // Track user-message count via ref so the auto-open effect only fires when
  // a NEW user message is added — not when the user simply closes the drawer.
  const prevUserMsgCountRef = useRef(useUserMessageCount(messages));
  const currentUserMsgCount = useUserMessageCount(messages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPrompt(inputValue.trim());
  };

  // Auto-scroll to bottom on new messages — but only if the user is already
  // near the bottom. If they scrolled up to read, don't yank them down.
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      const el = scrollRef.current;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      // Only auto-scroll if within 120px of the bottom
      if (distanceFromBottom < 120) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [messages, isChatting]);

  // Body scroll lock: prevent the page from scrolling behind the drawer
  useEffect(() => {
    if (!isDrawerOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isDrawerOpen]);

  // visualViewport: handle iOS keyboard occlusion — keep the input visible
  // when the soft keyboard opens by adjusting the drawer height.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      // When the keyboard opens, visualViewport.height shrinks. Use it to
      // constrain the drawer so the input stays above the keyboard.
      // Clamp to 92% of the layout viewport so the drawer can't cover
      // the entire screen when the keyboard is closed.
      const maxH = Math.min(vv.height, window.innerHeight * 0.92);
      document.documentElement.style.setProperty(
        '--chat-drawer-max-h',
        `${maxH}px`,
      );
    };

    vv.addEventListener('resize', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      document.documentElement.style.removeProperty('--chat-drawer-max-h');
    };
  }, [isDrawerOpen]);

  // Only auto-open the drawer when a NEW user message is added.
  // Using a ref to track the previous count prevents re-opening when the user
  // manually closes the drawer (closing doesn't change currentUserMsgCount).
  useEffect(() => {
    if (currentUserMsgCount > prevUserMsgCountRef.current) {
      prevUserMsgCountRef.current = currentUserMsgCount;
      setDrawerOpen(true);
    }
  }, [currentUserMsgCount, setDrawerOpen]);

  // Actions are now user-initiated via buttons below each AI response.
  // No auto-triggers — no tab switches, no claim popups, no navigation.

  if (!isDrawerOpen && flow.claimStatus === 'idle' && flow.verifyStatus === 'idle') return null;

  const handleConfirmClear = () => {
    clearMessages();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
      {/* Backdrop */}
      {isDrawerOpen && (
        <Scrim
          intensity="default"
          onClick={() => {
            setDrawerOpen(false);
            setShowClearConfirm(false);
          }}
          className="pointer-events-auto"
        />
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-auto z-50"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 max-w-[280px] mx-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
              Clear chat?
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="flex-1 px-3 py-2 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Drawer */}
      {isDrawerOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative z-[50] isolate bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl w-full max-w-2xl mx-auto min-h-[60dvh] max-h-[var(--chat-drawer-max-h,92dvh)] flex flex-col pointer-events-auto border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        >
          {/* Drag Handle — pointer-capture drag-to-dismiss */}
          <div
            className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              // Capture the pointer so pointerup always reaches us even if
              // the cursor leaves the handle strip. Without this, a desktop
              // mouse drag that releases outside the element never fires
              // onPointerUp, leaving dragStartYRef stale — subsequent hovers
              // would then translate the sheet.
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStartYRef.current = e.clientY;
            }}
            onPointerMove={(e) => {
              if (dragStartYRef.current === null) return;
              // Belt-and-suspenders: if the button was released without
              // capture delivering a pointerup (edge case), bail out.
              if (e.pointerType === 'mouse' && e.buttons === 0) {
                dragStartYRef.current = null;
                const parent = e.currentTarget.parentElement;
                if (parent) parent.style.transform = '';
                return;
              }
              const deltaY = e.clientY - dragStartYRef.current;
              if (deltaY > 0) {
                const parent = e.currentTarget.parentElement;
                if (parent) parent.style.transform = `translateY(${deltaY}px)`;
              }
            }}
            onPointerUp={(e) => {
              if (dragStartYRef.current === null) return;
              const deltaY = e.clientY - dragStartYRef.current;
              const parent = e.currentTarget.parentElement;
              if (parent) parent.style.transform = '';
              dragStartYRef.current = null;
              if (deltaY > 80) {
                setDrawerOpen(false);
              }
            }}
          >
            <div
              className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"
              onClick={() => setDrawerOpen(false)}
            />
          </div>

        {/* Freemium Status Banner */}
        <FreemiumPanel onGoodDollarClaim={handleClaimFromChat} />

        {/* Header */}
        <div className="px-6 pb-4 flex justify-between items-center border-b border-blue-200/60 dark:border-blue-800/30 bg-gradient-to-r from-blue-50/80 via-sky-50/50 to-blue-50/80 dark:from-blue-900/20 dark:via-sky-900/10 dark:to-blue-900/20">
          <div className="flex items-center gap-3">
            <GuardianMascot
              size={42}
              mood={isChatting ? "thinking" : "neutral"}
              className="shrink-0"
            />
            <div>
              <h3 className="font-black text-blue-950 dark:text-blue-100 uppercase tracking-tight text-sm">
                Guardian
              </h3>
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-blue-500"
                />
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                  {GUARDIAN_DRAWER_SUBTITLE}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="text-[10px] font-black text-gray-400 hover:text-blue-500 uppercase tracking-wider transition-colors"
              title="AI model settings"
            >
              ⚙️
            </button>
            <button
              onClick={() => setCurrentView(currentView === 'chat' ? 'history' : 'chat')}
              className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border transition-colors ${
                currentView === 'history' 
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20' 
                  : 'bg-white/50 dark:bg-gray-800/50 text-blue-700 dark:text-blue-300 border-blue-200/50 dark:border-blue-700/30'
              }`}
            >
              {currentView === 'chat' ? 'History' : 'Chat'}
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-wider"
            >
              Clear
            </button>
            {/* Explicit close button so users can dismiss without confusion */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200/50 dark:border-gray-700/30 transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div 
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
          className="flex-1 overflow-hidden flex flex-col pt-2"
        >
          <AnimatePresence mode="wait">
            {currentView === 'chat' ? (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
                ref={scrollRef}
              >
                {activeGuardianReview && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Guardian review
                    </p>
                    {activeGuardianReview.contract ? (
                      <GuardianRecommendationCard
                        contract={activeGuardianReview.contract}
                        onDismiss={() => setActiveGuardianReview(null)}
                      />
                    ) : (
                      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{activeGuardianReview.summary}</p>
                        {activeGuardianReview.detail && (
                          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{activeGuardianReview.detail}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveGuardianReview(null)}
                          className="min-h-11 px-3 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                        >
                          Close
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {messages.length === 0 && !isChatting && !activeGuardianReview && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-5"
                  >
                    <GuardianMascot size={82} mood="happy" />
                    
                    <div className="space-y-2">
                      <p className="text-base font-bold text-blue-900 dark:text-blue-100">
                        Ask Guardian for a clear next action
                      </p>
                      <p className="max-w-[300px] text-sm text-gray-600 dark:text-gray-300">
                        Start with a portfolio summary, currency risk check, or a payment-readiness plan — with verifiable evidence when it matters.
                      </p>
                    </div>

                    <div className="w-full max-w-[320px] rounded-2xl border border-blue-200/70 dark:border-blue-800/40 bg-blue-50/70 dark:bg-blue-900/10 p-3 text-left">
                      <p className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        Verifiable protection
                      </p>
                      <p className="mt-1 text-xs text-blue-900 dark:text-blue-100">
                        High-impact recommendations are anchored with evidence so you can audit what Guardian used and why.
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2 max-w-[320px]">
                      {STARTER_PROMPTS.map(({ label, prompt, badge }) => (
                        <motion.button
                          key={label}
                          onClick={() => submitPrompt(prompt)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full border border-blue-200 dark:border-blue-700/40 hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                        >
                          <span>{label}</span>
                          <span className="rounded-full bg-white/80 dark:bg-black/20 px-1.5 py-0.5 text-[10px] font-black">
                            {badge}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}
                  >
                    {msg.role === "assistant" && (
                      <GuardianMascot
                        size={32}
                        mood={isChatting && i === messages.length - 1 ? "thinking" : "neutral"}
                        className="mr-2 shrink-0 self-end"
                      />
                    )}
                    
                    <div
                      className={`relative max-w-[80%] px-4 py-3 rounded-2xl text-sm transition-colors duration-300 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-md shadow-lg shadow-blue-500/10"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700 shadow-sm"
                      }`}
                    >
                      {msg.role === "assistant" && msg.portfolioContext && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mb-2 pb-1.5 border-b border-gray-100 dark:border-gray-700">
                          {msg.portfolioContext}
                        </p>
                      )}

                      {msg.type === 'insight' && msg.insights ? (
                        <div className="space-y-3 py-1">
                          <p className="font-bold leading-tight">{msg.insights.summary}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.insights.tags.map(tag => (
                              <span key={tag} className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <SimpleMarkdown className="relative z-10" content={msg.content} />
                      )}

                      {msg.action?.type === 'execute_rwa' && (
                        <RwaActionWidget 
                          action={{ ...msg.action, userAddress: address || '0x0000000000000000000000000000000000000000' }} 
                          onComplete={(result) => {
                            if (result.txHash) {
                              addUserMessage(`✓ Rebalanced $${msg.action?.amount} to ${msg.action?.targetAsset} on ${msg.action?.network}. Tx: ${result.txHash}${result.explorerUrl ? ` — ${result.explorerUrl}` : ''}`);
                            } else {
                              addUserMessage(`✓ Rebalanced $${msg.action?.amount} to ${msg.action?.targetAsset} on ${msg.action?.network}.`);
                            }
                          }} 
                        />
                      )}
                      
                      {/* Research evidence summary — Perplexity-style source citations */}
                      {msg.role === "assistant" && msg.researchSources && msg.researchSources.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                                {msg.researchSources.length} source{msg.researchSources.length > 1 ? 's' : ''} consulted
                              </span>
                              {msg.researchSources.some(s => s.tier === 'paid') && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold">
                                  ${msg.researchSources.reduce((sum, s) => sum + (s.cost || 0), 0).toFixed(3)} USDC
                                </span>
                              )}
                              {msg.billing?.confidence != null && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-bold">
                                  {(msg.billing.confidence * 100).toFixed(0)}% confidence
                                </span>
                              )}
                            </div>
                            {msg.x402Receipt?.explorer && (
                              <a
                                href={msg.x402Receipt.explorer}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-500 hover:text-blue-600 font-bold"
                              >
                                tx ↗
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {msg.researchSources.map((s, j) => {
                              const badge = (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${s.tier === 'paid' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800' : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'} ${s.url ? 'hover:opacity-80 cursor-pointer' : ''}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${s.tier === 'paid' ? 'bg-amber-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                  {s.label}
                                  {s.url && <span className="opacity-60">↗</span>}
                                </span>
                              );
                              return s.url ? (
                                <a key={j} href={s.url} target="_blank" rel="noopener noreferrer">
                                  {badge}
                                </a>
                              ) : (
                                <span key={j}>{badge}</span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {msg.action?.type === 'hold' && (
                        <HoldActionWidget action={msg.action} />
                      )}

                      {/* Visible action buttons for claim / verify / navigate */}
                      {msg.action?.type === 'claim_ubi' && (
                        <button
                          onClick={handleClaimFromChat}
                          className="mt-3 w-full px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                        >
                          🪙 Claim Daily G$ UBI
                        </button>
                      )}
                      {msg.action?.type === 'verify_identity' && (
                        <button
                          onClick={() => setActiveTab("protect")}
                          className="mt-3 w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                        >
                          🛡️ Verify Identity
                        </button>
                      )}
                      {msg.action?.type === 'navigate' && msg.action.tab && (
                        <button
                          onClick={() => { const raw = msg.action?.tab || ''; const resolved = isTabId(raw) ? raw : LEGACY_TAB_MAP[raw]; if (resolved) setActiveTab(resolved); }}
                          className="mt-3 w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                        >
                          → Open {isTabId(msg.action.tab) ? msg.action.tab : LEGACY_TAB_MAP[msg.action.tab] || msg.action.tab}
                        </button>
                      )}
                      {msg.action?.type === 'confirm_research' && (
                        <div className="mt-3 rounded-xl border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-900/10 p-2.5">
                          {msg.action.quoteSources && msg.action.quoteSources.length > 0 && (
                            <div className="mb-2 space-y-1">
                              {msg.action.quoteSources.map((source) => (
                                <div key={source.label} className="flex items-center justify-between gap-3 text-[10px]">
                                  <span className="truncate text-amber-800 dark:text-amber-200">{source.label}</span>
                                  <span className={source.tier === "paid" ? "font-mono font-bold text-amber-700 dark:text-amber-300" : "font-mono text-amber-500"}>
                                    ${source.cost.toFixed(3)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => submitResearchConfirmation()}
                              disabled={isChatting}
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                            >
                              Run ${Number.parseFloat(msg.action.quoteAmount || '0').toFixed(3)}
                            </button>
                            <button
                              onClick={() => submitPrompt("skip")}
                              disabled={isChatting}
                              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        </div>
                      )}

                      {/* SoSoValue Intelligence Card */}
                      {msg.type === 'sosovalue_intelligence' && msg.sosovalueData && (
                        <div className="mt-3">
                          <SoSoIntelligenceCard
                            data={msg.sosovalueData}
                            onProposeTrade={(newsItem) => {
                              const isBullish = newsItem.sentiment >= 55;
                              const proposal: SoSoTradeProposal = {
                                newsItem,
                                suggestedAction: isBullish ? 'BUY' : 'SELL',
                                confidence: Math.round(newsItem.sentiment),
                                reasoning: `Based on ${newsItem.sentiment}/100 sentiment score for "${newsItem.title}"`,
                              };
                              setSoSoTradeProposal(proposal);
                              setSoSoModalOpen(true);
                            }}
                            onAnalyze={(newsItem) => {
                              addUserMessage(`Analyze this market intelligence: "${newsItem.title}" - sentiment ${newsItem.sentiment}/100`);
                            }}
                          />
                        </div>
                      )}
                      
                      <div className={`flex items-center gap-2 mt-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] opacity-40 ${msg.role === "user" ? "text-white" : "text-gray-500"}`}>
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === "assistant" && <ProviderBadge provider={msg.provider} />}
                        {msg.role === "assistant" && msg.x402Receipt && (
                          <ResearchReceipt receipt={msg.x402Receipt} provider={msg.provider} />
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator — only shown before the first token arrives.
                    Once the streaming placeholder has content, the message bubble
                    itself is the visible feedback, so we hide the dots to avoid
                    showing an empty bubble + dots side by side. */}
                {isChatting && (() => {
                  const lastMsg = messages[messages.length - 1];
                  const hasStreamingContent = lastMsg?.role === 'assistant' && lastMsg?.content && lastMsg.content.length > 0;
                  return !hasStreamingContent;
                })() && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm max-w-[90%]">
                      <TrustFlow isActive step={thinkingStep} />
                    </div>
                  </div>
                )}

                {/* Starter prompts: compact row when messages exist (full hero shown when empty above) */}
                {!isChatting && messages.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5 pt-2 pb-1">
                    {STARTER_PROMPTS.map(({ label, prompt }) => (
                      <button
                        key={label}
                        onClick={() => submitPrompt(prompt)}
                        className="px-2.5 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-1 overflow-hidden"
              >
                <IntelligenceHistory />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Input */}
        <div className="p-6 pt-2 pb-10 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <div className="px-1">
              <ResearchCheck
                isActive={isChatting}
                spent={autonomousStatus?.spent ?? 0}
              />
            </div>
            <form
              onSubmit={handleSubmit}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center shadow-inner"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about your portfolio, macro outlook, or strategy..."
                aria-label="Ask your Guardian a question"
                className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-white"
              />
              <VoiceButton
                size="sm"
                variant="embedded"
                onTranscription={(t) => {
                  submitPrompt(t);
                }}
              />
              {inputValue.trim() && (
                <button
                  type="submit"
                  className="ml-2 text-blue-600 font-bold text-sm uppercase"
                >
                  Send
                </button>
              )}
            </form>
          </div>
        </div>
      </motion.div>
      )}
      {showSettings && (
        <ModelSettingsModal
          onClose={() => setShowSettings(false)}
          userGeminiKey={userGeminiKey}
          onSaveKey={(k) => { saveGeminiKey(k); setShowSettings(false); }}
        />
      )}
      {soSoModalOpen && (
        <SoSoActionModal
          isOpen={soSoModalOpen}
          onClose={() => { setSoSoModalOpen(false); setSoSoTradeProposal(null); }}
          proposal={soSoTradeProposal}
          onConfirm={(proposal) => {
            // Don't pretend the trade executed — route through the advisor instead
            setSoSoModalOpen(false);
            setSoSoTradeProposal(null);
            const q = `I'm interested in ${proposal.suggestedAction} based on this news: ${proposal.newsItem.title}. What should I consider?`;
            addUserMessage(q);
            sendChatMessage(q);
          }}
        />
      )}
    </div>
  );
}

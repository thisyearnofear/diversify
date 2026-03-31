import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIConversation } from "../../context/AIConversationContext";
import { useNavigation } from "../../context/app/NavigationContext";
import { isTabId, LEGACY_TAB_MAP } from "@/constants/tabs";
import { useAgentChat } from "../../hooks/use-agent-chat";
import { useAgentStatus } from "../../hooks/use-agent-status";
import { useAgentVoice } from "../../hooks/use-agent-voice";
import { useCredits } from "../../hooks/use-credits";
import { useProactiveAgent } from "../../hooks/use-proactive-agent";
import { useWalletContext } from "../wallet/WalletProvider";
import VoiceButton from "../ui/VoiceButton";
import FreemiumPanel from "./FreemiumPanel";
import dynamic from "next/dynamic";
import SimpleMarkdown from "../shared/SimpleMarkdown";

const GoodDollarClaimFlow = dynamic(() => import("../gooddollar/GoodDollarClaimFlow"), {
  ssr: false,
});

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

      const TOKEN_ADDRESSES: Record<string, string> = {
        cUSD: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
        cEUR: '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73',
        cREAL: '0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787',
        KESm: '0x456a3D042C0DbD3db53D5489e98dFb038553B0d0',
        COPm: '0x8A567e2aE79CA692Bd748aB832081C45de4041eA',
        PHPm: '0x105d4A9306D2E55a71d2Eb95B81553AE1dC20d7B',
      };

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
            tokenInAddress: TOKEN_ADDRESSES[tokenIn] || TOKEN_ADDRESSES.cUSD,
            tokenOut,
            tokenOutAddress: TOKEN_ADDRESSES[tokenOut] || TOKEN_ADDRESSES.cUSD,
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
           <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Agent Fuel</span>
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
        className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
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
        <p className="text-[9px] text-center text-red-500 mt-2 font-medium">
          ⚠ {errorMessage}
        </p>
      )}

      {/* Success with tx hash */}
      {status === 'success' && txHash && (
        <div className="mt-2 text-center">
          <p className="text-[9px] text-gray-400 font-medium">
            Tx: {txHash.slice(0, 10)}...{txHash.slice(-8)}
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-blue-500 hover:text-blue-600 underline mt-0.5 inline-block"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      {status === 'idle' && (
        <p className="text-[9px] text-center text-gray-400 mt-2 font-medium">
          Gas covered autonomously via local MPC wallet
        </p>
      )}
    </div>
  );
};

/**
 * AIChat - Global Bottom Sheet Drawer
 *
 * AGGRESSIVE CONSOLIDATION: Replaces standalone chat with a global
 * overlay that persists context across any screen.
 */
export default function AIChat() {
  const {
    messages,
    isDrawerOpen,
    setDrawerOpen,
    clearMessages,
    addUserMessage,
  } = useAIConversation();
  const { capabilities } = useAgentStatus();
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
  const [inputValue, setInputValue] = React.useState("");
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [showClaimFlow, setShowClaimFlow] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'history'>('chat');

  // Initialize background Celo event monitoring & proactive insights capability
  useProactiveAgent();

  // Track user-message count via ref so the auto-open effect only fires when
  // a NEW user message is added — not when the user simply closes the drawer.
  const prevUserMsgCountRef = useRef(useUserMessageCount(messages));
  const currentUserMsgCount = useUserMessageCount(messages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isChatting) return;
    addUserMessage(inputValue.trim());
    sendChatMessage(inputValue.trim());
    setInputValue("");
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatting]);

  // Only auto-open the drawer when a NEW user message is added.
  // Using a ref to track the previous count prevents re-opening when the user
  // manually closes the drawer (closing doesn't change currentUserMsgCount).
  useEffect(() => {
    if (currentUserMsgCount > prevUserMsgCountRef.current) {
      prevUserMsgCountRef.current = currentUserMsgCount;
      setDrawerOpen(true);
    }
  }, [currentUserMsgCount, setDrawerOpen]);

  // Handle actions from AI responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && lastMessage.action) {
      const { type, delay = 1500 } = lastMessage.action;
      
      if (type === "navigate" && lastMessage.action.tab) {
        const { tab } = lastMessage.action;
        const timer = setTimeout(() => {
          const migrated = LEGACY_TAB_MAP[tab];
          const candidate = migrated || tab;
          if (isTabId(candidate)) {
            setActiveTab(candidate);
          }
          setDrawerOpen(false);
        }, delay);
        return () => clearTimeout(timer);
      } else if (type === "claim_ubi") {
        const timer = setTimeout(() => {
          setShowClaimFlow(true);
          setDrawerOpen(false);
        }, delay);
        return () => clearTimeout(timer);
      } else if (type === "verify_identity") {
        const timer = setTimeout(() => {
          setActiveTab("protect");
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, setActiveTab, setDrawerOpen]);

  if (!isDrawerOpen && !showClaimFlow) return null;

  const handleConfirmClear = () => {
    clearMessages();
    setShowClearConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-none">
      {/* GoodDollar Claim Modal Triggered by AI */}
      {showClaimFlow && (
        <div className="pointer-events-auto">
          <GoodDollarClaimFlow 
            onClose={() => setShowClaimFlow(false)} 
            onClaimSuccess={() => { setShowClaimFlow(false); claimReward('gooddollar_claim'); }} 
          />
        </div>
      )}

      {/* Backdrop */}
      {isDrawerOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            setDrawerOpen(false);
            setShowClearConfirm(false);
          }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
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
              This can't be undone.
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
          className="relative bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl w-full max-w-2xl mx-auto min-h-[60vh] max-h-[92vh] flex flex-col pointer-events-auto border-t border-white/10"
        >
          {/* Drag Handle */}
        <div className="w-full flex justify-center py-3">
          <div
            className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full"
            onClick={() => setDrawerOpen(false)}
          />
        </div>

        {/* Freemium Status Banner */}
        <FreemiumPanel onGoodDollarClaim={() => { setShowClaimFlow(true); }} />

        {/* Header */}
        <div className="px-6 pb-4 flex justify-between items-center border-b border-amber-200/30 dark:border-amber-800/20 bg-gradient-to-r from-amber-50/50 via-yellow-50/30 to-amber-50/50 dark:from-amber-900/10 dark:via-yellow-900/5 dark:to-amber-900/10">
          <div className="flex items-center gap-3">
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20 border-2 border-amber-300"
            >
              🪙
            </motion.div>
            <div>
              <h3 className="font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight text-sm">
                DiversiFi
              </h3>
              <div className="flex items-center gap-1.5">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500" 
                />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase">
                  Get Stable or Die Trying
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView(currentView === 'chat' ? 'history' : 'chat')}
              className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full border transition-all ${
                currentView === 'history' 
                  ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20' 
                  : 'bg-white/50 dark:bg-gray-800/50 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-700/30'
              }`}
            >
              {currentView === 'chat' ? 'Library 📜' : 'Back to Chat 💬'}
            </button>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-wider"
            >
              Reset
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
                {messages.length === 0 && !isChatting && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className="h-full flex flex-col items-center justify-center text-center space-y-5"
                  >
                    {/* Animated gold coin stack */}
                    <div className="relative">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="text-5xl filter drop-shadow-lg"
                      >
                        🪙
                      </motion.div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-base font-bold text-amber-800 dark:text-amber-200">
                        DiversiFi awaits your question
                      </p>
                    </div>
                    
                    {/* Quick action pills */}
                    <div className="flex flex-wrap justify-center gap-2 max-w-[280px]">
                      {["What's my portfolio?", "How do I earn yield?", "Protect my savings"].map((prompt, i) => (
                        <motion.button
                          key={prompt}
                          onClick={() => {
                            setInputValue(prompt);
                            addUserMessage(prompt);
                            sendChatMessage(prompt);
                            setInputValue("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-800/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-700/30 hover:bg-amber-200 dark:hover:bg-amber-700/40 transition-colors"
                        >
                          {prompt}
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
                      <div className="w-8 h-8 mr-2 rounded-full bg-amber-400 flex items-center justify-center text-lg shadow-lg self-end border border-amber-300">
                        🪙
                      </div>
                    )}
                    
                    <div
                      className={`relative max-w-[80%] px-4 py-3 rounded-2xl text-sm transition-all duration-300 ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-md shadow-lg shadow-blue-500/10"
                          : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700 shadow-sm"
                      }`}
                    >
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
                      
                      <div className={`text-[10px] mt-1.5 opacity-40 ${msg.role === "user" ? "text-white" : "text-gray-500"}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </motion.div>
                ))}

                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm max-w-[90%]">
                      <div className="flex items-center gap-3">
                         <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="text-2xl">🪙</motion.div>
                         <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">{thinkingStep || "Analyzing..."}</span>
                      </div>
                    </div>
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
          <form
            onSubmit={handleSubmit}
            className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center shadow-inner"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type or tap microphone..."
              className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-white"
            />
            <VoiceButton
              size="sm"
              variant="embedded"
              onTranscription={(t) => {
                addUserMessage(t);
                sendChatMessage(t);
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
      </motion.div>
      )}
    </div>
  );
}

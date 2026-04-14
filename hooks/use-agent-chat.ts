import { useCallback, useEffect, useState } from "react";
import { useAIConversationOptional } from "../context/AIConversationContext";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { getPersistedStrategy } from "./useFinancialStrategies";
import { useAgentConfig } from "./use-agent-config";
import { useMultichainBalances } from "./use-multichain-balances";
import { IntentDiscoveryService, AgentActionService, type AppIntent } from "@diversifi/shared";
import type {
  AgentChatActions,
  AgentChatDependencies,
  AgentChatState,
  AIMessage,
} from "./agent-types";

type ChatStoreState = {
  isChatting: boolean;
  thinkingStep: string;
};

const defaultChatState: ChatStoreState = {
  isChatting: false,
  thinkingStep: "",
};

let cachedChatState: ChatStoreState = defaultChatState;
const listeners = new Set<(state: ChatStoreState) => void>();

const notify = () => {
  listeners.forEach((listener) => listener(cachedChatState));
};

const updateChatState = (
  updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>),
) => {
  const partial = typeof updater === "function" ? updater(cachedChatState) : updater;
  cachedChatState = { ...cachedChatState, ...partial };
  notify();
};

export function useAgentChat({
  apiBase,
  capabilities,
  useGlobalConversation = true,
  generateSpeech,
}: AgentChatDependencies): AgentChatState & AgentChatActions {
  const globalConversation = useAIConversationOptional();
  const { chainId, address } = useWalletContext();
  const { config } = useAgentConfig();
  const portfolio = useMultichainBalances(address, config.goal);

  const [localMessages, setLocalMessages] = useState<AIMessage[]>([]);
  const [chatState, setChatState] = useState<ChatStoreState>(cachedChatState);

  useEffect(() => {
    const listener = (next: ChatStoreState) => setChatState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const isUsingGlobal = useGlobalConversation && globalConversation !== undefined;
  const messages = isUsingGlobal ? globalConversation!.messages : localMessages;
  const { isChatting, thinkingStep } = chatState;

  const addMessage = useCallback(
    (message: AIMessage) => {
      if (isUsingGlobal) {
        globalConversation!.addMessage(message);
      } else {
        setLocalMessages((prev) => [...prev, message]);
      }
    },
    [globalConversation, isUsingGlobal],
  );

  const clearMessages = useCallback(() => {
    if (isUsingGlobal) {
      globalConversation!.clearMessages();
    } else {
      setLocalMessages([]);
    }
  }, [globalConversation, isUsingGlobal]);

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!capabilities.chat) return;

      const normalizedContent = content.trim().toLowerCase();
      const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|confirm)$/i.test(normalizedContent);

      if (isAffirmative && lastAssistantMessage?.action?.type === "guardian_review") {
        updateChatState({
          isChatting: true,
          thinkingStep: "Reviewing with Guardian...",
        });

        try {
          if (!address) {
            addMessage({
              role: "assistant",
              content: "Connect your wallet first so Guardian can review the latest opportunity against your permissions and portfolio.",
              timestamp: new Date(),
              type: "text",
            });
            return;
          }

          const response = await fetch(`${apiBase}/api/vault/rebalance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: address,
              dryRun: true,
            }),
          });

          const result = await response.json().catch(() => ({}));
          const recommendationCount = result.recommendationCount ?? result.recommendations?.length ?? 0;
          let guardianReply = result.message || "Guardian reviewed the latest Advisor recommendation.";

          if (!response.ok) {
            guardianReply = result.error || "Guardian could not review the latest opportunity right now.";
          } else if (result.status === "ready") {
            guardianReply = `${guardianReply}\n\nGuardian prepared ${recommendationCount} dry-run action${recommendationCount === 1 ? "" : "s"}. Approve Guardian access to execute them.`;
          } else if (result.status === "blocked") {
            guardianReply = `${guardianReply}\n\nSet up or renew Guardian permissions before execution.`;
          } else if (result.status === "noop") {
            guardianReply = `${guardianReply}\n\nThis opportunity is not currently executable through Guardian.`;
          }

          addMessage({
            role: "assistant",
            content: guardianReply,
            timestamp: new Date(),
            type: "text",
          });
        } catch (error) {
          console.error("[useAgentChat] Guardian handoff failed:", error);
          addMessage({
            role: "assistant",
            content: "Guardian could not review that opportunity right now. Please try again in a moment.",
            timestamp: new Date(),
            type: "text",
          });
        } finally {
          updateChatState({
            isChatting: false,
            thinkingStep: "",
          });
        }
        return;
      }

      const intent = IntentDiscoveryService.discover(content);
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      const allowFastPath = wordCount <= 6;
      const effectiveIntent: AppIntent = allowFastPath
        ? intent
        : { type: "QUERY", context: "general" };
      // 1. Fast-path routing for immediate UI feedback (Navigation, Demo, etc.)
      let fastPathResponse: string | undefined;

      switch (effectiveIntent.type) {
        case 'NAVIGATE':
          fastPathResponse = `Taking you to ${effectiveIntent.tab.toUpperCase()}... 🚀`;
          break;
        case 'SWAP_SHORTCUT':
          fastPathResponse = "Preparing your swap hub... 💱";
          break;
        case 'SEND_TO_PHONE':
          fastPathResponse = `Resolving ${effectiveIntent.phoneNumber} via SocialConnect... 📱`;
          break;
        case 'GOODDOLLAR':
          fastPathResponse = effectiveIntent.topic === 'claim' ? "Checking G$ UBI eligibility... 🪙" : "Starting verification... 🛡️";
          break;
        case 'WDK_ACTION':
          if (effectiveIntent.topic === 'switch') {
            fastPathResponse = "Switching your Guardian infrastructure to WDK settlement... 🌌";
          } else if (effectiveIntent.topic === 'status') {
            fastPathResponse = "Checking WDK settlement agent status... 🛰️";
          } else {
            fastPathResponse = "The WDK (Wallet Development Kit) enables self-custodial agentic wallets with native USD₮ and XAU₮ support for multi-chain settlement. 🌌";
          }
          break;
        case 'ONBOARDING':
          if (effectiveIntent.topic === 'demo') {
            fastPathResponse = "Entering Demo Mode... 🎮";
          } else if (effectiveIntent.topic === 'what-is-this') {
            fastPathResponse = "DiversiFi is a wealth protection protocol that helps you hedge against inflation by diversifying your stablecoin savings across multiple regions and real-world assets (RWAs).";
          } else if (effectiveIntent.topic === 'how-to-start') {
            fastPathResponse = "It's simple: 1. Connect your wallet. 2. Choose a protection strategy in the 'Protect' tab. 3. Swap your funds into diversified assets.";
          } else if (effectiveIntent.topic === 'is-safe') {
            fastPathResponse = "DiversiFi is non-custodial. We never store your private keys. All transactions are executed on-chain via secure smart contracts.";
          }
          break;
        case 'YIELD_EARN':
          fastPathResponse = "Scanning for high-yield opportunities... 📈";
          break;
      }

      if (fastPathResponse) {
        updateChatState({ isChatting: true, thinkingStep: "Executing action..." });

        // Execute background side-effects (SocialConnect resolution, etc.) via consolidated service
        await AgentActionService.execute(intent, content, {});

        // Determine the action for the UI component (AIChat) to execute after a delay
        let navAction: AIMessage["action"] | undefined;
        if (intent.type === "NAVIGATE") {
          navAction = { type: "navigate", tab: intent.tab, delay: 1500 };
        } else if (intent.type === "YIELD_EARN") {
          navAction = { type: "navigate", tab: "earn", delay: 1500 };
        } else if (intent.type === "GOODDOLLAR") {
          navAction = { 
            type: intent.topic === 'claim' ? 'claim_ubi' : 'verify_identity', 
            delay: 1500 
          };
        } else if (intent.type === "ONBOARDING" && intent.topic === "demo") {
          navAction = { type: "navigate", tab: "overview", delay: 1500 };
        }

        // Add the message to chat after a brief thinking delay
        setTimeout(async () => {
          const assistantMessage: AIMessage = {
            role: "assistant",
            content: fastPathResponse!,
            timestamp: new Date(),
            type: "text",
            ...(navAction && { action: navAction }),
          };
          addMessage(assistantMessage);

          // Handle auto-speech if enabled
          if (config.voiceResponsesEnabled && capabilities.voiceOutput && generateSpeech) {
            try {
                const speechBlob = await generateSpeech(fastPathResponse!);
              if (speechBlob) {
                const url = URL.createObjectURL(speechBlob);
                const audio = new Audio(url);
                audio.play().catch((playError) => {
                  console.warn("[useAgentChat] Fast-path audio playback failed:", playError);
                });
              }
            } catch (e) {
              console.warn("[useAgentChat] Fast-path speech failed:", e);
            }
          }

          updateChatState({ isChatting: false, thinkingStep: "" });
        }, 600);
        return;
      }

      updateChatState({
        isChatting: true,
        thinkingStep: "Consulting Advisor...",
      });

      const CHAT_THINKING_MESSAGES = [
        "Analyzing query...",
        "Scanning market data...",
        "Checking inflation rates...",
        "Reviewing RWA yields...",
        "Consulting historical data...",
        "Formulating response...",
      ];

      let messageIndex = 0;
      const interval = setInterval(() => {
        updateChatState({ thinkingStep: CHAT_THINKING_MESSAGES[messageIndex] });
        messageIndex = (messageIndex + 1) % CHAT_THINKING_MESSAGES.length;
      }, 3000);

      try {
        const portfolioSnapshot =
          address && (portfolio.totalValue > 0 || portfolio.allTokens.length > 0)
            ? {
                totalValue: portfolio.totalValue,
                chainCount: portfolio.chainCount,
                tokenCount: portfolio.allTokens.length,
                holdings: portfolio.allTokens.slice(0, 8).map((token) => ({
                  symbol: token.symbol,
                  value: token.value,
                  chainName: token.chainName,
                  region: token.region,
                })),
                chains: portfolio.chains.map((chain) => ({
                  chainId: chain.chainId,
                  chainName: chain.chainName,
                  totalValue: chain.totalValue,
                  tokenCount: chain.tokenCount,
                })),
              }
            : undefined;

        const response = await fetch(`${apiBase}/api/agent/advisor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "conversation",
            message: content,
            history: messages,
            chainId,
            address,
            portfolio: portfolioSnapshot,
            financialStrategy: getPersistedStrategy(),
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const assistantMessage: AIMessage = {
            role: "assistant",
            content: result.response,
            timestamp: new Date(),
            type: result.type || "text",
            action: result.action,
          };
          addMessage(assistantMessage);

          if (config.voiceResponsesEnabled && capabilities.voiceOutput && generateSpeech) {
            try {
              const speechBlob = await generateSpeech(result.response);
              if (speechBlob) {
                const url = URL.createObjectURL(speechBlob);
                const audio = new Audio(url);
                audio.play().catch((playError) => {
                  console.warn("[useAgentChat] Audio playback failed:", playError);
                });
              }
            } catch (speechError) {
              console.warn("[useAgentChat] Auto-speech failed:", speechError);
            }
          }
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.error(
            "[useAgentChat] Chat API error:",
            response.status,
            errorData,
          );

          const errorMessage: AIMessage = {
            role: "assistant",
            content: `⚠️ **Analysis Unavailable**\n\n${errorData.error || "The AI service is temporarily unavailable. Please try again in a moment."}`,
            timestamp: new Date(),
            type: "text",
          };
          addMessage(errorMessage);
        }
      } catch (error) {
        console.error("[useAgentChat] Chat failed:", error);

        const errorMessage: AIMessage = {
          role: "assistant",
          content:
            "⚠️ **Connection Error**\n\nUnable to reach the AI service. Please check your connection and try again.",
          timestamp: new Date(),
          type: "text",
        };
        addMessage(errorMessage);
      } finally {
        clearInterval(interval);
        updateChatState({
          isChatting: false,
          thinkingStep: "",
        });
      }
    },
    [
      address,
      apiBase,
      capabilities.chat,
      capabilities.voiceOutput,
      chainId,
      config.voiceResponsesEnabled,
      generateSpeech,
      portfolio.allTokens,
      portfolio.chainCount,
      portfolio.chains,
      portfolio.totalValue,
      messages,
      addMessage,
    ],
  );

  return {
    messages,
    isChatting,
    thinkingStep,
    sendChatMessage,
    addMessage,
    clearMessages,
  };
}

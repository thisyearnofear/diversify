import { useCallback, useEffect, useState } from "react";
import { useAIConversationOptional } from "../context/AIConversationContext";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { getPersistedStrategy } from "./useFinancialStrategies";
import { IntentDiscoveryService } from "@diversifi/shared";
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

      const intent = IntentDiscoveryService.discover(content);
      let fastPathResponse: string | null = null;

      if (intent.type === "ONBOARDING") {
        switch (intent.topic) {
          case "what-is-this":
            fastPathResponse = "DiversiFi is a wealth protection protocol that helps you hedge against inflation by diversifying your stablecoin savings across multiple regions and real-world assets (RWAs). We make it easy to hold a basket of assets like Digital Gold (PAXG), Yield-bearing Treasury Tokens (USDY), and regional stablecoins (like Euro or Celo Real).";
            break;
          case "how-to-start":
            fastPathResponse = "It's simple: 1. Connect your wallet (or create one with email). 2. Choose a protection strategy or build your own portfolio in the 'Protect' tab. 3. Swap your funds into diversified assets. We handle the routing and optimization to ensure you get the best rates across Celo and Arbitrum.";
            break;
          case "is-safe":
            fastPathResponse = "DiversiFi is non-custodial, meaning you always retain full control of your funds. We never store your private keys. All transactions are executed on-chain via secure smart contracts. However, as with all DeFi protocols, there are risks including smart contract bugs and market volatility. Always do your own research.";
            break;
          case "demo":
            fastPathResponse = "Taking you to demo mode... 🎮";
            break;
        }
      } else if (intent.type === "NAVIGATE") {
        switch (intent.tab) {
          case "overview":
            if (address) {
              fastPathResponse = "Taking you to your portfolio... 📊";
            } else {
              fastPathResponse = "To see your portfolio, you'll need to connect your wallet first. Once connected, your holdings will appear in the **Overview** tab!";
            }
            break;
          case "protect":
            fastPathResponse = "Taking you to protection strategies... 🛡️";
            break;
          case "swap":
            fastPathResponse = address
              ? "Taking you to the swap interface... 💱"
              : "To swap tokens, you'll need to connect your wallet first. Click **Connect Wallet** to get started!";
            break;
          case "info":
            fastPathResponse = "Taking you to the Learn section... 📚";
            break;
        }
      } else if (intent.type === "GOODDOLLAR") {
        if (intent.topic === "claim") {
          fastPathResponse = "Launching G$ UBI claim sequence... 🪙";
        } else if (intent.topic === "verify") {
          fastPathResponse = "Starting verification flow... 🛡️";
        }
      } else if (intent.type === "QUERY" && intent.context === "market") {
          fastPathResponse = "Scanning global markets for real-time momentum... 🔍";
      }

      if (fastPathResponse) {
        updateChatState({
          isChatting: true,
          thinkingStep: "Retrieving info...",
        });

        let navAction: AIMessage["action"] | undefined;

        if (intent.type === "NAVIGATE") {
          navAction = { type: "navigate", tab: intent.tab, delay: 1500 };
        } else if (intent.type === "GOODDOLLAR") {
          if (intent.topic === "claim") {
            navAction = { type: "claim_ubi", delay: 1500 };
          } else if (intent.topic === "verify") {
            navAction = { type: "verify_identity", delay: 1500 };
          }
        }
 else if (intent.type === "ONBOARDING" && intent.topic === "demo") {
           // No specific action needed, maybe navigate to overview
           navAction = { type: "navigate", tab: "overview", delay: 1500 };
        }

        setTimeout(async () => {
          const assistantMessage: AIMessage = {
            role: "assistant",
            content: fastPathResponse!,
            timestamp: new Date(),
            type: "text",
            ...(navAction && { action: navAction }),
          };
          addMessage(assistantMessage);
          updateChatState({
            isChatting: false,
            thinkingStep: "",
          });

          if (capabilities.voiceOutput && generateSpeech) {
            try {
              const speechBlob = await generateSpeech(fastPathResponse!);
              if (speechBlob) {
                const url = URL.createObjectURL(speechBlob);
                const audio = new Audio(url);
                audio.play();
              }
            } catch (speechError) {
              console.warn("[useAgentChat] Auto-speech failed:", speechError);
            }
          }
        }, 600);
        return;
      }

      updateChatState({
        isChatting: true,
        thinkingStep: "Consulting Oracle...",
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
        const response = await fetch(`${apiBase}/api/agent/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            history: messages,
            chainId,
            address,
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

          if (capabilities.voiceOutput && generateSpeech) {
            try {
              const speechBlob = await generateSpeech(result.response);
              if (speechBlob) {
                const url = URL.createObjectURL(speechBlob);
                const audio = new Audio(url);
                audio.play();
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
      generateSpeech,
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

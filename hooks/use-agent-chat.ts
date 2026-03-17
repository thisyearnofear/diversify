import { useCallback, useEffect, useState } from "react";
import { useAIConversationOptional } from "../context/AIConversationContext";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { getPersistedStrategy } from "./useFinancialStrategies";
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

      const normalizedContent = content.toLowerCase().trim();
      let fastPathResponse: string | null = null;

      if (
        normalizedContent.includes("what is diversifi") ||
        normalizedContent.includes("what is diversify") ||
        normalizedContent.includes("what's diversifi")
      ) {
        fastPathResponse =
          "DiversiFi is a wealth protection protocol that helps you hedge against inflation by diversifying your stablecoin savings across multiple regions and real-world assets (RWAs). We make it easy to hold a basket of assets like Digital Gold (PAXG), Yield-bearing Treasury Tokens (USDY), and regional stablecoins (like Euro or Celo Real).";
      } else if (
        normalizedContent.includes("how does it work") ||
        normalizedContent.includes("how to start") ||
        normalizedContent.includes("get started")
      ) {
        fastPathResponse =
          "It's simple: 1. Connect your wallet (or create one with email). 2. Choose a protection strategy or build your own portfolio in the 'Protect' tab. 3. Swap your funds into diversified assets. We handle the routing and optimization to ensure you get the best rates across Celo and Arbitrum.";
      } else if (
        normalizedContent.includes("is it safe") ||
        normalizedContent.includes("is diversifi safe") ||
        normalizedContent.includes("security")
      ) {
        fastPathResponse =
          "DiversiFi is non-custodial, meaning you always retain full control of your funds. We never store your private keys. All transactions are executed on-chain via secure smart contracts. However, as with all DeFi protocols, there are risks including smart contract bugs and market volatility. Always do your own research.";
      } else if (
        normalizedContent.includes("portfolio") ||
        normalizedContent.includes("what do i have") ||
        normalizedContent.includes("my balance") ||
        normalizedContent.includes("my holdings") ||
        normalizedContent.includes("what's in my wallet") ||
        normalizedContent.includes("whats in my wallet")
      ) {
        if (address) {
          fastPathResponse = "Taking you to your portfolio... 📊";
        } else {
          fastPathResponse =
            "To see your portfolio, you'll need to connect your wallet first. Click the **Connect Wallet** button and choose your preferred option (email, existing wallet, or 'Buy Crypto'). Once connected, your holdings will appear in the **Overview** tab!";
        }
      } else if (
        normalizedContent.includes("protect") ||
        normalizedContent.includes("how to protect") ||
        normalizedContent.includes("inflation protection") ||
        normalizedContent.includes("hedge against inflation")
      ) {
        fastPathResponse = "Taking you to protection strategies... 🛡️";
      } else if (
        normalizedContent.includes("swap") ||
        normalizedContent.includes("exchange") ||
        normalizedContent.includes("trade") ||
        normalizedContent.includes("convert") ||
        normalizedContent.includes("buy") ||
        normalizedContent.includes("sell")
      ) {
        fastPathResponse = address
          ? "Taking you to the swap interface... 💱"
          : "To swap tokens, you'll need to connect your wallet first. Click **Connect Wallet** to get started!";
      } else if (
        normalizedContent.includes("yield") ||
        normalizedContent.includes("earn") ||
        normalizedContent.includes("apy") ||
        normalizedContent.includes("interest") ||
        normalizedContent.includes("passive income")
      ) {
        fastPathResponse = "Taking you to yield opportunities... 📈";
      } else if (
        normalizedContent.includes("strategy") ||
        normalizedContent.includes("philosophy") ||
        normalizedContent.includes("africapitalism") ||
        normalizedContent.includes("buen vivir") ||
        normalizedContent.includes("islamic finance") ||
        normalizedContent.includes("confucian")
      ) {
        fastPathResponse = "Taking you to strategy selection... 🎯";
      } else if (
        normalizedContent.includes("demo") ||
        normalizedContent.includes("test") ||
        normalizedContent.includes("try without wallet") ||
        normalizedContent.includes("play money")
      ) {
        fastPathResponse = "Taking you to demo mode... 🎮";
      } else if (
        normalizedContent.includes("learn") ||
        normalizedContent.includes("how to use") ||
        normalizedContent.includes("tutorial") ||
        normalizedContent.includes("what is paxg") ||
        normalizedContent.includes("what is usdy")
      ) {
        fastPathResponse = "Taking you to the Learn section... 📚";
      }

      if (fastPathResponse) {
        updateChatState({
          isChatting: true,
          thinkingStep: "Retrieving info...",
        });

        let navAction:
          | { type: "navigate"; tab: string; delay?: number }
          | undefined;

        if (
          address &&
          (normalizedContent.includes("portfolio") ||
            normalizedContent.includes("what do i have") ||
            normalizedContent.includes("my balance") ||
            normalizedContent.includes("my holdings") ||
            normalizedContent.includes("what's in my wallet") ||
            normalizedContent.includes("whats in my wallet"))
        ) {
          navAction = { type: "navigate", tab: "overview", delay: 1500 };
        } else if (
          normalizedContent.includes("protect") ||
          normalizedContent.includes("how to protect") ||
          normalizedContent.includes("inflation protection") ||
          normalizedContent.includes("hedge against inflation")
        ) {
          navAction = { type: "navigate", tab: "protect", delay: 1500 };
        } else if (
          normalizedContent.includes("swap") ||
          normalizedContent.includes("exchange") ||
          normalizedContent.includes("trade") ||
          normalizedContent.includes("convert") ||
          normalizedContent.includes("buy") ||
          normalizedContent.includes("sell")
        ) {
          navAction = { type: "navigate", tab: "swap", delay: 1500 };
        } else if (
          normalizedContent.includes("yield") ||
          normalizedContent.includes("earn") ||
          normalizedContent.includes("apy") ||
          normalizedContent.includes("interest") ||
          normalizedContent.includes("passive income")
        ) {
          navAction = { type: "navigate", tab: "protect", delay: 1500 };
        } else if (
          normalizedContent.includes("strategy") ||
          normalizedContent.includes("philosophy") ||
          normalizedContent.includes("africapitalism") ||
          normalizedContent.includes("buen vivir") ||
          normalizedContent.includes("islamic finance") ||
          normalizedContent.includes("confucian")
        ) {
          navAction = { type: "navigate", tab: "protect", delay: 1500 };
        } else if (
          normalizedContent.includes("learn") ||
          normalizedContent.includes("how to use") ||
          normalizedContent.includes("tutorial") ||
          normalizedContent.includes("what is paxg") ||
          normalizedContent.includes("what is usdy")
        ) {
          navAction = { type: "navigate", tab: "info", delay: 1500 };
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

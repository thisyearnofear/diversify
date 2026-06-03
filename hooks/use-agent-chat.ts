import { useCallback, useEffect, useState } from "react";
import { useAIConversationOptional } from "../context/AIConversationContext";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { getPersistedStrategy } from "./useFinancialStrategies";
import { useAgentConfig } from "./use-agent-config";
import { useMultichainBalances } from "./use-multichain-balances";
import { IntentDiscoveryService, AgentActionService, type AppIntent, type ResponseFormat } from "@diversifi/shared";
import { useX402Payment } from "./use-x402-payment";
import { useAgentActivities } from "./use-agent-activities";
import { useCredits } from "./use-credits";
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

// macro_analysis(0.004) + portfolio_optimization(0.005) + risk_assessment(0.006)
const RESEARCH_BUNDLE_PRICE = 0.015;

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
  const { fetchPaidSource } = useX402Payment();
  const { addActivity } = useAgentActivities();
  const { deductCredits, status: creditsStatus } = useCredits();

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

      let effectiveContent = content;
      const normalizedContent = content.trim().toLowerCase();
      const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|confirm)$/i.test(normalizedContent);

      if (lastAssistantMessage?.action?.type === "confirm_research" && /^(no|nope|cancel|skip)$/i.test(normalizedContent)) {
        addMessage({
          role: "assistant",
          content: "No problem. I can still answer with free context whenever you're ready.",
          timestamp: new Date(),
          type: "text",
          x402Receipt: {
            status: "skipped",
            amount: "0.000",
            currency: "USDC",
            sources: lastAssistantMessage.x402Receipt?.sources || [],
            reason: "User skipped the quoted paid research bundle.",
          },
        });
        return;
      }

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

      const intent = IntentDiscoveryService.discover(effectiveContent);
      const wordCount = effectiveContent.trim().split(/\s+/).filter(Boolean).length;
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
        await AgentActionService.execute(intent, effectiveContent, {});

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

      // Determine response format intent before choosing card vs text vs action
      const lastAssistantMsgType: 'card' | 'text' | 'action' | undefined =
        lastAssistantMessage?.type === 'sosovalue_intelligence' || lastAssistantMessage?.type === 'recommendation'
          ? 'card'
          : lastAssistantMessage?.action
            ? 'action'
            : lastAssistantMessage
              ? 'text'
              : undefined;

      const responseFormat = IntentDiscoveryService.recommendResponseFormat(effectiveContent, lastAssistantMsgType);

      // Short-circuit ambiguous follow-ups with a clarifying question
      if (responseFormat === 'clarify') {
        addMessage({
          role: 'assistant',
          content: "Are you asking about the news I just showed, or something else?",
          timestamp: new Date(),
          type: 'text',
        });
        updateChatState({ isChatting: false, thinkingStep: '' });
        return;
      }

      updateChatState({
        isChatting: true,
        thinkingStep: "Consulting Advisor...",
      });

      // SoSoValue intelligence: show card for data requests, fetch silently for synthesis
      const SOSOVALUE_TRIGGERS = /\b(news|market|sentiment|flash|sosovalue|ssi|signal|headline|crypto news|market intel)\b/i;
      const isMarketQuery = SOSOVALUE_TRIGGERS.test(effectiveContent);
      let sosovalueData: any = undefined;

      if (isMarketQuery) {
        try {
          updateChatState({ thinkingStep: "Fetching SoSoValue market intelligence..." });
          const ssRes = await fetch(`${apiBase}/api/agent/sosovalue`);
          if (ssRes.ok) {
            sosovalueData = await ssRes.json();
            if (responseFormat === 'card') {
              addMessage({
                role: 'assistant',
                content: "Here's the latest market intelligence from SoSoValue:",
                timestamp: new Date(),
                type: 'sosovalue_intelligence',
                sosovalueData,
              });
            }
          }
        } catch {
          // Non-blocking — advisor still runs below
        }
      }

      // Fetch research evidence from the Arc Data Hub gateway.
      // Uses fetchPaidSource which handles the full 402→pay→re-fetch cycle.
      // The returned data becomes macroData for the advisor (provides evidence context).
      let x402Receipt: AIMessage["x402Receipt"] = null;
      let macroData: Record<string, any> = {};

      // Inject silently-fetched SoSoValue data as macro context for synthesis responses
      if (sosovalueData) {
        macroData.sosovalue = sosovalueData;
      }

      // Gate paid research: only fetch when user wants data/action or explicitly requests research
      const explicitResearchRequest = /\b(deep research|premium research|research bundle|run research|paid research|evidence backed|with evidence)\b/i.test(normalizedContent);
      const shouldFetchResearch = (responseFormat === 'card' || responseFormat === 'action') || explicitResearchRequest;
      const currentCredits = creditsStatus?.credits.bonus ?? 0;
      const hasCredits = currentCredits >= RESEARCH_BUNDLE_PRICE;

      if (!hasCredits || !shouldFetchResearch) {
        // No credits or synthesis-only query — skip paid research, advisor uses built-in context only
        x402Receipt = {
          status: "failed",
          amount: "0.000",
          currency: "USDC",
          sources: [],
          reason: shouldFetchResearch
            ? "Advisor answered without research evidence."
            : "Synthesis question — answered with free context only.",
          error: !hasCredits
            ? "Insufficient research credits. Earn more or add funds to unlock evidence-backed responses."
            : undefined,
        };
      } else {
        try {
          updateChatState({ thinkingStep: "Gathering research evidence..." });

          const bundleSources = "macro_analysis,portfolio_optimization,risk_assessment";
          const { data: bundleData, receipt } = await fetchPaidSource(bundleSources);

          x402Receipt = receipt;

          if (bundleData) {
            macroData = { ...macroData, ...(bundleData.data || bundleData) };
            if (bundleData.bundle) macroData._research = { bundle: bundleData.bundle };
            if (bundleData.sources) macroData.sources = bundleData.sources;
            if (bundleData._billing) macroData._billing = bundleData._billing;
          }
        } catch (error: any) {
          const errorMessage = error?.message || "Research fetch failed";
          x402Receipt = {
            status: "failed",
            amount: "0.000",
            currency: "USDC",
            sources: [],
            reason: "Advisor answered without research evidence.",
            error: errorMessage,
          };
        }
      }

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

        // Pick up user's own Gemini key if they've set one
        const userGeminiKey = typeof window !== "undefined"
          ? localStorage.getItem("diversifi_user_gemini_key") || ""
          : "";

        const response = await fetch(`${apiBase}/api/agent/advisor`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(userGeminiKey ? { "x-gemini-key": userGeminiKey } : {}),
          },
          body: JSON.stringify({
            mode: "conversation",
            message: effectiveContent,
            history: messages,
            chainId,
            address,
            portfolio: portfolioSnapshot,
            financialStrategy: getPersistedStrategy(),
            macroData: Object.keys(macroData).length > 0 ? macroData : undefined,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Patch receipt amount to reflect true cost to user's research allowance
          const patchedReceipt = x402Receipt && x402Receipt.status !== "failed" && x402Receipt.sources.length > 0
            ? { ...x402Receipt, amount: (Number.parseFloat(x402Receipt.amount || "0") || RESEARCH_BUNDLE_PRICE).toFixed(3) }
            : x402Receipt;

          // Build compact portfolio context line for grounding proof
          let portfolioContext: string | undefined;
          if (portfolioSnapshot && portfolioSnapshot.holdings.length > 0) {
            const holdingParts = portfolioSnapshot.holdings
              .filter((h) => h.value >= 0.01)
              .slice(0, 5)
              .map((h) => `${h.value.toFixed(2)} ${h.symbol}`);
            const chainNames = portfolioSnapshot.chains.map((c) => c.chainName).join(" + ");
            portfolioContext = `Analyzing: ${holdingParts.join(" · ")}${portfolioSnapshot.holdings.length > 5 ? " …" : ""} on ${chainNames}`;
          }

          const assistantMessage: AIMessage = {
            role: "assistant",
            content: result.response,
            timestamp: new Date(),
            type: result.type || "text",
            action: result.action,
            provider: result.provider,
            x402Receipt: patchedReceipt,
            portfolioContext,
            researchSources: result.researchSources || [],
          };
          addMessage(assistantMessage);

          if (x402Receipt) {
            const spent = Number.parseFloat(x402Receipt.amount || "0");
            const isSpendEvent = x402Receipt.status === "paid" || x402Receipt.status === "credit";
            const isResearchEvent = isSpendEvent || x402Receipt.status === "failed";

            // Always deduct from bonus credits when research sources are consumed.
            // The gateway may grant free-tier access (cost=0 in receipt) but the
            // user's research allowance should still reflect usage.
            const effectiveCost = spent > 0 ? spent : (x402Receipt.status !== "failed" && x402Receipt.sources.length > 0 ? RESEARCH_BUNDLE_PRICE : 0);
            if (effectiveCost > 0) {
              deductCredits(effectiveCost);
            }

            if (isResearchEvent || (x402Receipt.status !== "failed" && x402Receipt.sources.length > 0)) {
              addActivity({
                type: "research_payment",
                tier: "ADVISOR",
                status: x402Receipt.status === "failed" ? "failed" : "success",
                description: x402Receipt.status === "failed"
                  ? "Premium Arc research skipped"
                  : `Premium Arc research ${x402Receipt.status === "credit" ? "used credits" : x402Receipt.status === "paid" ? "paid" : "from allowance"}`,
                details: {
                  query: effectiveContent,
                  cost: effectiveCost,
                  amount: effectiveCost.toFixed(3),
                  txHash: x402Receipt.txHash,
                  x402Hash: x402Receipt.txHash,
                  explorer: x402Receipt.explorer,
                  remainingCredit: x402Receipt.remainingCredit,
                  sources: x402Receipt.sources.map((source) => ({
                    label: source.label,
                    cost: source.cost,
                    tier: source.tier,
                  })),
                },
              });
            }
          }

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
      creditsStatus,
      messages,
      addMessage,
      addActivity,
      fetchPaidSource,
      deductCredits,
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

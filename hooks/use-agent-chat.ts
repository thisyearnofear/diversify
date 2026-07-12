import { useCallback, useState } from "react";
import { useAIConversationOptional } from "../context/AIConversationContext";
import { useWalletContext } from "../components/wallet/WalletProvider";
import { getPersistedStrategy } from "./useFinancialStrategies";
import { useAgentConfig } from "./use-agent-config";
import { useSharedMultichainBalances } from "../context/app/PortfolioContext";
import { useAgentChatContext } from "../context/app/AgentChatContext";
// Deep leaf imports — NOT the barrel. Reached in first-load via
// use-app-shell → use-advisor; the barrel would pull the whole AI/ledger/
// ethers/web3 stack in. IntentDiscovery + AgentAction are light and used
// synchronously; recordRecommendation pulls ethers and is dynamically
// imported at its async call site below.
import { IntentDiscoveryService, type AppIntent, type ResponseFormat } from "@diversifi/shared/src/services/ai/intent-discovery.service";
import { AgentActionService } from "@diversifi/shared/src/services/ai/agent-action.service";
import { useX402Payment } from "./use-x402-payment";
import { useAgentActivities } from "./use-agent-activities";
import { useCredits } from "./use-credits";
import { trackFunnelEvent } from "../lib/analytics";
import type {
  AgentChatActions,
  AgentChatDependencies,
  AgentChatState,
  AIMessage,
} from "./agent-types";

/**
 * Detect whether the user's input is a question (not a command).
 * Used to prevent the regex fast-path from hijacking short questions
 * like "how to earn?" or "what is PAXG?" with canned responses.
 */
function contentIncludesQuestion(text: string): boolean {
  if (text.includes('?')) return true;
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
  return ['what', 'how', 'why', 'should', 'when', 'where', 'who', 'which', 'can', 'could', 'would', 'is', 'are', 'do', 'does'].includes(firstWord);
}

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

// Cap the number of messages sent as history to the API (server already
// slices to last 10, but capping on the client reduces payload size too).
const MAX_HISTORY_TO_SEND = 20;

export function useAgentChat({
  apiBase,
  capabilities,
  useGlobalConversation = true,
  generateSpeech,
}: AgentChatDependencies): AgentChatState & AgentChatActions {
  const globalConversation = useAIConversationOptional();
  const { chainId, address } = useWalletContext();
  const { config } = useAgentConfig();
  const portfolio = useSharedMultichainBalances(address, config.goal);
  const { fetchPaidSource } = useX402Payment();
  const { addActivity } = useAgentActivities();
  const { deductCredits, status: creditsStatus } = useCredits();

  // Shared chat state via React Context (replaces module-level pub-sub).
  // Falls back to local state if no provider is present (tests).
  const ctx = useAgentChatContext();
  const [localChatState, setLocalChatState] = useState<ChatStoreState>(defaultChatState);
  const chatState = ctx?.chatState ?? localChatState;
  const updateChatState = ctx?.updateChatState ?? ((updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>)) => {
    setLocalChatState((prev) => {
      const partial = typeof updater === "function" ? updater(prev) : updater;
      return { ...prev, ...partial };
    });
  });

  const [localMessages, setLocalMessages] = useState<AIMessage[]>([]);

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

  /**
   * Patch an existing message in place. Matched by `id` (preferred) or
   * `timestamp` fallback. Mirrors `globalConversation.patchMessage` so
   * the anchor-status patch path works the same way whether the chat is
   * on the global context or a per-component local one.
   */
  const patchMessage = useCallback(
    (match: { id?: string; timestamp: Date }, patch: Partial<AIMessage>) => {
      if (isUsingGlobal) {
        globalConversation!.patchMessage(match, patch);
        return;
      }
      setLocalMessages((prev) =>
        prev.map((m) => {
          const matchesId = match.id && m.id && m.id === match.id;
          const matchesTimestamp =
            !match.id && m.timestamp.getTime() === match.timestamp.getTime();
          if (!matchesId && !matchesTimestamp) return m;
          return { ...m, ...patch };
        }),
      );
    },
    [globalConversation, isUsingGlobal],
  );

  const sendChatMessage = useCallback(
    async (content: string) => {
      if (!capabilities.chat) {
        addMessage({
          role: "assistant",
          content: "The Advisor is currently unavailable — no AI provider is configured. Please try again later or contact support.",
          timestamp: new Date(),
          type: "text",
        });
        updateChatState({ isChatting: false, thinkingStep: "" });
        return;
      }

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
      // Only fast-path unambiguous *commands* (navigation, swaps, claims, yield).
      // Never fast-path ONBOARDING questions or QUERY — those go to the LLM so
      // the user gets a real answer instead of canned marketing copy.
      const isUnambiguousCommand =
        !contentIncludesQuestion(effectiveContent) && (
        intent.type === 'NAVIGATE' ||
        intent.type === 'SWAP_SHORTCUT' ||
        intent.type === 'SEND_TO_PHONE' ||
        intent.type === 'YIELD_EARN' ||
        (intent.type === 'GOODDOLLAR' && (intent as any).topic === 'claim') ||
        (intent.type === 'WDK_ACTION' && (intent as any).topic === 'switch') ||
        (intent.type === 'ONBOARDING' && (intent as any).topic === 'demo'));
      const effectiveIntent: AppIntent = allowFastPath && isUnambiguousCommand
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
          fastPathResponse = "Checking G$ UBI eligibility... 🪙";
          break;
        case 'WDK_ACTION':
          fastPathResponse = "Switching your Guardian infrastructure to WDK settlement... 🌌";
          break;
        case 'ONBOARDING':
          fastPathResponse = "Entering Demo Mode... 🎮";
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

        // Add the message to chat immediately — no artificial delay
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

      updateChatState({
        isChatting: true,
        thinkingStep: "Thinking...",
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
        // No credits or synthesis-only query — skip paid research, advisor uses
        // built-in context only. Do NOT attach a "failed" receipt to normal
        // free answers — that makes every free response look like an error.
        x402Receipt = null;
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

      // Track chat send for funnel analytics
      trackFunnelEvent('chat_send', { intent: effectiveIntent.type });
      const sendStartTime = Date.now();
      let pendingAssistant: { id: string; timestamp: Date } | null = null;

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
            stream: true,
            message: effectiveContent,
            history: messages.slice(-MAX_HISTORY_TO_SEND),
            chainId,
            address,
            portfolio: portfolioSnapshot,
            financialStrategy: getPersistedStrategy(),
            macroData: Object.keys(macroData).length > 0 ? macroData : undefined,
          }),
        });

        if (response.ok && response.body) {
          // ── Streaming path: read SSE events and patch the assistant message ──
          const messageTimestamp = new Date();
          const messageId = `assistant-${messageTimestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`;

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

          // Create placeholder message — content fills in as chunks arrive
          const assistantMessage: AIMessage = {
            id: messageId,
            role: "assistant",
            content: "",
            timestamp: messageTimestamp,
            type: "text",
            portfolioContext,
          };
          addMessage(assistantMessage);
          pendingAssistant = { id: messageId, timestamp: messageTimestamp };

          let streamedContent = "";
          let finalResult: any = null;

          // Read the SSE stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let event: any;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                // Ignore malformed SSE lines
                continue;
              }

              if (event.type === "chunk") {
                streamedContent += event.text;
                patchMessage(
                  { id: messageId, timestamp: messageTimestamp },
                  { content: streamedContent },
                );
              } else if (event.type === "done") {
                finalResult = event;
                // Replace streaming content with the cleaned final response
                // (action markers are stripped from the final text)
                streamedContent = event.response;
              } else if (event.type === "error") {
                throw new Error(event.message || "Stream error");
              }
            }
          }

          // Process the final result (same as before, just from the stream)
          if (!finalResult) {
            throw new Error("Stream ended without a done event");
          }

          const result = finalResult;
          // Patch receipt amount to reflect true cost to user's research allowance
          const patchedReceipt = x402Receipt && x402Receipt.status !== "failed" && x402Receipt.sources.length > 0
            ? { ...x402Receipt, amount: (Number.parseFloat(x402Receipt.amount || "0") || RESEARCH_BUNDLE_PRICE).toFixed(3) }
            : x402Receipt;

          // Final patch with all metadata
          patchMessage(
            { id: messageId, timestamp: messageTimestamp },
            {
              content: result.response,
              type: "text",
              action: result.action,
              provider: result.provider,
              x402Receipt: patchedReceipt,
              researchSources: result.researchSources || [],
            },
          );

          // Track successful completion
          const latencyMs = Date.now() - sendStartTime;
          trackFunnelEvent('chat_done', {
            latency: String(Math.round(latencyMs)),
            provider: String(result.provider || 'unknown'),
            ...(result.action ? { action: String(result.action.type) } : {}),
          });
          pendingAssistant = null;

          // Anchor this advice to the 0G RecommendationLedger so the user
          // sees verifiable on-chain state. Fire-and-patch: we don't block
          // the reply, but we DO update the message in place once the
          // anchor status resolves. Only anchor when we have a wallet and
          // the response was a real recommendation (not free synthesis).
          if (
            patchedReceipt &&
            patchedReceipt.status !== "failed" &&
            patchedReceipt.status !== "skipped" &&
            address
          ) {
            const messageId = assistantMessage.id;
            const anchorTimestamp = messageTimestamp;
            // Dynamic import keeps ethers (ledger dep) out of first-load.
            void import("@diversifi/shared/src/services/recommendation-ledger.service")
              .then(({ recordRecommendation }) => recordRecommendation({
              user: address,
              action: String(result.action?.type ?? result.type ?? "ADVICE"),
              targetToken: result.targetToken ?? "",
              reasoning: String(result.response ?? "").slice(0, 500),
              evidenceCid: "",
              servingModel: result.provider ?? "diversifi-agent",
              settlementTxHash: patchedReceipt.txHash ?? "",
              confidence: Math.round(
                Number.isFinite(result.confidence)
                  ? Number(result.confidence) * 10000
                  : 8000,
              ),
            })
              .then((anchor) => {
                patchMessage(
                  { id: messageId, timestamp: anchorTimestamp },
                  {
                    x402Receipt: {
                      ...patchedReceipt,
                      anchor: {
                        status: anchor.status,
                        txHash: anchor.status === "failed" ? undefined : anchor.txHash,
                        explorerUrl: anchor.status === "failed" ? undefined : anchor.explorerUrl,
                        id: anchor.status === "anchored" ? anchor.id : undefined,
                        error: anchor.status === "failed" ? anchor.error : undefined,
                      },
                    },
                  },
                );
              })
              .catch((err) => {
                console.warn("[useAgentChat] Ledger anchor failed:", err);
                patchMessage(
                  { id: messageId, timestamp: anchorTimestamp },
                  {
                    x402Receipt: {
                      ...patchedReceipt,
                      anchor: {
                        status: "failed",
                        error: err?.message ?? "Anchor broadcast failed",
                      },
                    },
                  },
                );
              }));
          }

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
          trackFunnelEvent('chat_error', { status: String(response.status) });

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
        trackFunnelEvent('chat_error', { reason: String(error instanceof Error ? error.message : 'unknown') });

        const errorContent =
          "⚠️ **Response Interrupted**\n\nThe AI provider could not finish this response. Please try again.";
        if (pendingAssistant) {
          patchMessage(pendingAssistant, { content: errorContent, provider: undefined });
        } else {
          addMessage({
            role: "assistant",
            content: errorContent,
            timestamp: new Date(),
            type: "text",
          });
        }
      } finally {
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
      patchMessage,
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
    patchMessage,
  };
}

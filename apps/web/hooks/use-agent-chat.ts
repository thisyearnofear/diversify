import { useCallback, useRef, useState } from "react";
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
import { useResearchPaymentSettings } from "./use-research-account";
import { trackFunnelEvent } from "../lib/analytics";
import { buildWalletPortfolioView } from "../lib/wallet-portfolio-view";
import { useGuardianVisibilityOptional } from "../context/app/GuardianVisibilityContext";
import {
  classifyVisibilityIntent,
  visibilityConfirmation,
} from "../lib/guardian-visibility-intent";
import { classifyAskWorldQuery } from "../lib/agent/ask-world-intent";
import { fetchAndResolve, worldAnswerToText } from "../lib/agent/ask-world-facts";
import {
  parseQuestionSkeleton,
  toQuestionSkeleton,
} from "../lib/agent/ask-world-spike/minimize-question";
import type { AskWorldQuery } from "../lib/agent/ask-world-types";
import type {
  AgentChatActions,
  AgentChatDependencies,
  AgentChatState,
  AIMessage,
} from "./agent-types";
import type { ResearchQuote } from "@diversifi/shared/src/types/research-billing";

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
  /**
   * Whether the last advisor response reported long-term memory active
   * (SSE `done` event's `memoryEnabled`). Session-scoped disclosure
   * state for the chat drawer — reset by "Also forget what it
   * remembers".
   */
  memoryEnabled: boolean;
};

const defaultChatState: ChatStoreState = {
  isChatting: false,
  thinkingStep: "",
  memoryEnabled: false,
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
  const { chainId, address, signMessage } = useWalletContext();
  const { config } = useAgentConfig();
  const portfolio = useSharedMultichainBalances(address, config.goal);
  const { fetchPaidSource, quoteResearch } = useX402Payment();
  const { addActivity } = useAgentActivities();
  const { deductCredits, status: creditsStatus } = useCredits();
  const { settings: paymentSettings } = useResearchPaymentSettings();
  const visibilityCtx = useGuardianVisibilityOptional();

  // Shared chat state via React Context (replaces module-level pub-sub).
  // Falls back to local state if no provider is present (tests).
  const ctx = useAgentChatContext();
  const [localChatState, setLocalChatState] = useState<ChatStoreState>(defaultChatState);
  const chatState = ctx?.chatState ?? localChatState;
  const localUpdateChatStateRef = useRef((updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>)) => {
    setLocalChatState((prev) => {
      const partial = typeof updater === "function" ? updater(prev) : updater;
      return { ...prev, ...partial };
    });
  });
  // Stable reference: context update is already stable, fallback lives in a ref.
  const updateChatState = useCallback(
    (updater: Partial<ChatStoreState> | ((prev: ChatStoreState) => Partial<ChatStoreState>)) => {
      (ctx?.updateChatState ?? localUpdateChatStateRef.current)(updater);
    },
    [ctx?.updateChatState],
  );

  const [localMessages, setLocalMessages] = useState<AIMessage[]>([]);

  const isUsingGlobal = useGlobalConversation && globalConversation !== undefined;
  const messages = isUsingGlobal ? globalConversation!.messages : localMessages;
  const { isChatting, thinkingStep, memoryEnabled } = chatState;

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
    async (
      content: string,
      options?: {
        decisionRef?: import("../context/app/NavigationContext").GuardianDecisionRef;
        /** The pair being asked about — symbols only; the server rebuilds
         *  the facts from its curated registry. */
        pair?: { from: string; to: string };
      },
    ) => {
      // Legibility preference flips are a fixed utterance class handled
      // locally — zero LLM cost, works offline, and the confirmation names
      // where to reverse it. Inert when no visibility provider is mounted.
      const visibilityIntent = visibilityCtx
        ? classifyVisibilityIntent(content)
        : null;
      if (visibilityIntent && visibilityCtx) {
        visibilityCtx.setVisibility(visibilityIntent, "agent");
        addMessage({
          role: "assistant",
          content: visibilityConfirmation(visibilityIntent),
          timestamp: new Date(),
          type: "text",
        });
        return;
      }

      // "Ask the World": fixed factual macro questions get deterministic
      // fast answers computed from real datasets — zero LLM tokens, no
      // advisor POST, no credit spend. Advice, portfolio framings, and
      // entities our data doesn't cover fall through to the advisor.
      //
      // TypeSafe/Jev (when flagged) only routes: on a regex miss it may
      // classify a privacy-minimised skeleton; an accepted intent reuses
      // the same facts path — Jev never invents numbers.
      const askWorldQuery = classifyAskWorldQuery(content);
      const spikeEnabled = process.env.NEXT_PUBLIC_TYPESAFE_ASK_WORLD_SPIKE === "true";

      const answerFromWorld = async (
        query: AskWorldQuery,
        intentLabel: string,
      ): Promise<"answered" | "unavailable" | "fall-through"> => {
        updateChatState({ isChatting: true, thinkingStep: "Asking the world..." });
        const startedAt = Date.now();
        const outcome = await fetchAndResolve(query, {
          startedAt,
          urlPrefix: apiBase,
        });
        if (outcome.status === "answered") {
          addMessage({
            role: "assistant",
            content: worldAnswerToText(outcome.answer),
            timestamp: new Date(),
            type: "answer",
            answer: outcome.answer,
          });
          trackFunnelEvent("chat_done", {
            latency: String(outcome.answer.badge.latencyMs),
            intent: intentLabel,
          });
          updateChatState({ isChatting: false, thinkingStep: "" });
          return "answered";
        }
        if (outcome.status === "unavailable") {
          addMessage({
            role: "assistant",
            content:
              "I couldn't reach the economic datasets behind that answer just now, and I won't guess numbers. Try again in a moment — or rephrase and I'll reason it through with my sources instead.",
            timestamp: new Date(),
            type: "text",
          });
          updateChatState({ isChatting: false, thinkingStep: "" });
          return "unavailable";
        }
        updateChatState({ isChatting: false, thinkingStep: "" });
        return "fall-through";
      };

      if (askWorldQuery) {
        // Shadow agreement: when the regex already matched, still send a
        // minimised skeleton so Jev can be compared — never blocks the answer.
        if (spikeEnabled) {
          const skeleton = toQuestionSkeleton(content);
          if (skeleton) {
            void fetch(`${apiBase}/api/agent/ask-world-spike`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ skeleton, regexKind: askWorldQuery.kind }),
            }).catch(() => {});
          }
        }
        const status = await answerFromWorld(askWorldQuery, "ASK_WORLD");
        if (status !== "fall-through") return;
      } else if (spikeEnabled) {
        const skeleton = toQuestionSkeleton(content);
        if (skeleton) {
          updateChatState({ isChatting: true, thinkingStep: "Asking the world..." });
          try {
            const spikeResp = await fetch(`${apiBase}/api/agent/ask-world-spike`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ skeleton, regexKind: "none" }),
            });
            if (spikeResp.ok) {
              const spike = (await spikeResp.json()) as {
                accepted?: boolean;
                intent?: string;
              };
              const query = parseQuestionSkeleton(skeleton);
              // Jev must accept AND agree with the skeleton's own class —
              // TypeSafe only routes; numbers still come from our datasets.
              if (spike.accepted && query && query.kind === spike.intent) {
                const status = await answerFromWorld(query, "ASK_WORLD_JEV");
                if (status !== "fall-through") return;
              }
            }
          } catch {
            // Provider/network failure → advisor below; never invent numbers.
          }
          updateChatState({ isChatting: false, thinkingStep: "" });
        }
      }

      // The advisor is the LLM path; the local fast paths above stay alive
      // even when no provider is configured.
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
      const rawNormalized = content.trim().toLowerCase();
      const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
      const isAffirmative = /^(yes|yeah|yep|sure|ok|okay|do it|go ahead|please do|confirm)$/i.test(rawNormalized);

      if (lastAssistantMessage?.action?.type === "confirm_research" && /^(no|nope|cancel|skip)$/i.test(rawNormalized)) {
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
            reason: "User skipped the quoted review.",
          },
        });
        return;
      }

      // User approved the quoted review (Fund & run / typed "yes") — restore
      // the original question so intent + evidence fetch run against it, and
      // let the paid fetch below proceed to the funding signature.
      let confirmedReview = false;
      if (isAffirmative && lastAssistantMessage?.action?.type === "confirm_research") {
        const originalQuery = [...messages].reverse().find((m) => m.role === "user")?.content;
        if (originalQuery) {
          effectiveContent = originalQuery;
          confirmedReview = true;
        }
      }
      const normalizedContent = effectiveContent.trim().toLowerCase();

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

          const { getWalletAuthHeaders } = await import("../lib/wallet-auth");
          const authHeaders = (await getWalletAuthHeaders(address, signMessage).catch(() => null)) || {};

          const response = await fetch(`${apiBase}/api/vault/rebalance`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
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
        await AgentActionService.execute(intent, effectiveContent, {});        // Determine the action for the UI component (AIChat) to execute. The
        // button now applies its own transition; carriers no longer set a
        // `delay` (the field was carried but never read by the consumer).
        let navAction: AIMessage["action"] | undefined;
        if (intent.type === "NAVIGATE") {
          navAction = { type: "navigate", tab: intent.tab };
        } else if (intent.type === "YIELD_EARN") {
          // Yield/earn content lives on the Shield tab (the RWA vault
          // sleeve) — there is no standalone "earn" tab.
          navAction = { type: "navigate", tab: "protect" };
        } else if (intent.type === "GOODDOLLAR") {
          navAction = {
            type: intent.topic === 'claim' ? 'claim_ubi' : 'verify_identity',
          };
        } else if (intent.type === "ONBOARDING" && intent.topic === "demo") {
          navAction = { type: "navigate", tab: "overview" };
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

      // SoSoValue intelligence: legacy crypto-era integration, disabled (off-thesis).
      // The API is crypto-native (no EM macro events, no fiat currency data).
      // TinyFish Search + FRED + World Bank + Firecrawl cover the FX-risk data needs.
      const isMarketQuery = false;
      let sosovalueData: any = undefined;

      // Fetch research evidence from the Data Hub gateway (x402).
      // Uses fetchPaidSource which handles the full 402→pay→re-fetch cycle.
      // The returned data becomes macroData for the advisor (provides evidence context).
      let x402Receipt: AIMessage["x402Receipt"] = null;
      let macroData: Record<string, any> = {};
      const bundleSources = "macro_analysis,portfolio_optimization,risk_assessment";
      // When the review would require funding, the quote is stashed here and
      // emitted as a confirm_research offer after the advisor answers.
      let pendingReviewQuote: ResearchQuote | null = null;

      // Inject silently-fetched SoSoValue data as macro context for synthesis responses
      if (sosovalueData) {
        macroData.sosovalue = sosovalueData;
      }

      // Gate paid evidence: only fetch when user wants data/action or explicitly
      // requests it. The funding ladder: covered balance → serve silently;
      // no balance + auto-fund within the user's cap or an explicit confirm →
      // straight to the funding signature; otherwise offer the review first —
      // never silently downgrade a paid-eligible question.
      const explicitResearchRequest = /\b(deep research|premium research|research bundle|run research|paid research|evidence backed|with evidence)\b/i.test(normalizedContent);
      const shouldFetchResearch = (responseFormat === 'card' || responseFormat === 'action') || explicitResearchRequest || confirmedReview;
      const currentCredits = creditsStatus?.credits.bonus ?? 0;
      const hasCredits = currentCredits >= RESEARCH_BUNDLE_PRICE;

      const runFundedFetch = async () => {
        updateChatState({ thinkingStep: "Gathering evidence..." });
        const { data: bundleData, receipt } = await fetchPaidSource(bundleSources);
        x402Receipt = receipt;
        if (bundleData) {
          macroData = { ...macroData, ...(bundleData.data || bundleData) };
          if (bundleData.bundle) macroData._research = { bundle: bundleData.bundle };
          if (bundleData.sources) macroData.sources = bundleData.sources;
          if (bundleData._billing) macroData._billing = bundleData._billing;
        }
      };

      if (!shouldFetchResearch) {
        // Synthesis-only query — no paid fetch. Do NOT attach a "failed"
        // receipt to normal free answers — that makes every free response
        // look like an error.
        x402Receipt = null;
      } else if (hasCredits || confirmedReview) {
        try {
          await runFundedFetch();
        } catch (error: any) {
          const errorMessage = error?.message || "Evidence fetch failed";
          const userDeclined = /reject|denied|4001|declined/i.test(errorMessage);
          x402Receipt = {
            status: userDeclined ? "skipped" : "failed",
            amount: "0.000",
            currency: "USDC",
            sources: [],
            reason: userDeclined
              ? "Funding declined — answered with free context."
              : "Guardian answered without paid evidence.",
            error: errorMessage,
          };
        }
      } else {
        // No funded balance — quote first. If the gateway would serve this
        // from balance or free tier, just fetch; otherwise offer the review
        // so the funding decision is the user's, with the price up front.
        let quote: ResearchQuote | null = null;
        try {
          quote = await quoteResearch(bundleSources);
        } catch {
          // Quote probe failed — answer free, no offer.
        }
        if (quote) {
          const requiredCost =
            quote.requiredCost || Number.parseFloat(quote.amount || "0");
          const balanceCovers =
            Number.parseFloat(quote.currentBalance || "0") >= requiredCost;
          // Auto-fund is a bound, so it checks the authoritative quote —
          // not the client-side estimate — against the user's cap.
          const withinAutoCap =
            paymentSettings.autoPayEnabled && requiredCost <= paymentSettings.autoPayMaxUSDC;
          if (quote.status === "free" || balanceCovers || withinAutoCap) {
            try {
              await runFundedFetch();
            } catch (error: any) {
              const errorMessage = error?.message || "Evidence fetch failed";
              x402Receipt = {
                status: "failed",
                amount: "0.000",
                currency: "USDC",
                sources: [],
                reason: "Guardian answered without paid evidence.",
                error: errorMessage,
              };
            }
          } else {
            pendingReviewQuote = quote;
          }
        }
      }

      // Track chat send for funnel analytics
      trackFunnelEvent('chat_send', { intent: effectiveIntent.type });
      const sendStartTime = Date.now();
      let pendingAssistant: { id: string; timestamp: Date } | null = null;

      try {
        const walletView = buildWalletPortfolioView(portfolio);
        const portfolioSnapshot =
          address && walletView.holdings.length > 0
            ? {
                totalValue: walletView.totalUsd,
                chainCount: portfolio.chainCount,
                tokenCount: walletView.holdings.length,
                holdings: walletView.holdings.slice(0, 8).map((holding) => ({
                  symbol: holding.symbol,
                  value: holding.valueUsd,
                  percent: holding.percent,
                  chainName: holding.balances[0]?.chainName,
                  region: holding.balances[0]?.region,
                })),
                freshness: walletView.freshness,
                hasEstimates: walletView.hasEstimates,
                gaps: walletView.gaps.slice(0, 8),
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
            contextRecords: options?.decisionRef ? [{ ...options.decisionRef }] : undefined,
            pairContext: options?.pair ? { from: options.pair.from, to: options.pair.to } : undefined,
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
          // The `done` event reports whether server-side long-term memory
          // (Cognee) is active — surface it as the drawer's disclosure line.
          updateChatState({ memoryEnabled: result.memoryEnabled === true });
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
              billing: result.billing,
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

          // The free answer is on screen — now offer the funded review as a
          // separate trailing message so its confirm_research action is the
          // last assistant action next turn (Run → signature, Skip → pass).
          if (pendingReviewQuote) {
            const topup = pendingReviewQuote.suggestedTopup;
            addMessage({
              role: "assistant",
              content: `I can pull live evidence for a deeper Protection Review — ${pendingReviewQuote.amount} USDC from your balance${topup ? ` (funded by a ${topup} USDC top-up)` : ""}.`,
              timestamp: new Date(),
              type: "text",
              action: {
                type: "confirm_research",
                quoteAmount: pendingReviewQuote.amount,
                fundingAmount: topup,
                quoteSources: pendingReviewQuote.sources.map((s) => ({
                  label: s.label,
                  cost: s.cost,
                  tier: s.tier,
                })),
              },
              x402Receipt: {
                status: "quoted",
                amount: pendingReviewQuote.amount,
                currency: "USDC",
                sources: pendingReviewQuote.sources,
                reason: pendingReviewQuote.reason,
              },
            });
          }

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
                        evidenceUploaded: anchor.status === "failed" ? undefined : anchor.evidenceUploaded,
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
                  ? "Protection review skipped"
                  : `Protection review ${x402Receipt.status === "credit" ? "funded from balance" : x402Receipt.status === "paid" ? "funded" : "covered by free tier"}`,
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
      portfolio.errors,
      portfolio.isLoading,
      portfolio.isStale,
      portfolio.hasEstimates,
      portfolio.chains,
      portfolio.totalValue,
      creditsStatus,
      messages,
      addMessage,
      addActivity,
      fetchPaidSource,
      signMessage,
      quoteResearch,
      patchMessage,
      deductCredits,
      updateChatState,
      visibilityCtx,
      paymentSettings.autoPayEnabled,
      paymentSettings.autoPayMaxUSDC,
    ],
  );

  const setMemoryEnabled = useCallback(
    (enabled: boolean) => updateChatState({ memoryEnabled: enabled }),
    [updateChatState],
  );

  return {
    messages,
    isChatting,
    thinkingStep,
    memoryEnabled,
    sendChatMessage,
    addMessage,
    clearMessages,
    setMemoryEnabled,
    patchMessage,
  };
}

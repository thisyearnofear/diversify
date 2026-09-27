/**
 * Ask Guardian drawer helpers: starter intents, per-tab greetings, the
 * Exchange pair reader for the context line, breakpoint + BYO-key hooks,
 * and the provider badge. Pure/leaf — no drawer state.
 */
import React, { useEffect, useState } from "react";
import type { TabId } from "@/constants/tabs";

// Persisted user API key (client-side only, never sent to our server unintentionally)
export const USER_GEMINI_KEY_STORAGE = "diversifi_user_gemini_key";
// Starter intents — same prompts as before, re-labelled as questions for the
// empty state. The paid/free tier stays on the intent but only surfaces in
// title + sr-only text, never as a visible price tag.
export const STARTER_PROMPTS = [
  {
    id: "summary",
    label: "Portfolio summary",
    question: "How is my portfolio protected?",
    prompt: "Summarize my portfolio protection status and tell me the top 3 actions to take.",
    badge: "Free",
  },
  {
    id: "currency",
    label: "Currency risk",
    question: "Am I exposed to currency risk?",
    prompt: "Explain my currency exposure and whether I should protect savings before the next payment cycle.",
    badge: "Free",
  },
  {
    id: "plan",
    label: "Protection plan",
    question: "What should my protection plan be?",
    prompt: "Create a practical protection plan for my savings using stablecoins, yield, and real-world assets.",
    badge: "Free",
  },
  {
    id: "payment",
    label: "Payment readiness",
    question: "Should I convert before my next payment?",
    prompt: "Help me model FX drag for an upcoming supplier payment and decide whether to convert now or wait.",
    badge: "Shield",
  },
] as const;

export type StarterId = (typeof STARTER_PROMPTS)[number]["id"];

// Three chips per tab, chosen from the existing intents — the tab's job
// orders them, never invents new ones.
export const STARTERS_BY_TAB: Partial<Record<TabId, readonly StarterId[]>> = {
  overview: ["summary", "currency", "plan"],
  protect: ["plan", "currency", "summary"],
  exchange: ["currency", "payment", "summary"],
};
export const DEFAULT_STARTERS: readonly StarterId[] = ["summary", "currency", "plan"];

// Per-tab greeting for the empty state — one line, keyed to the surface the
// user was on when they opened the drawer.
export const GREETING_BY_TAB: Partial<Record<TabId, string>> = {
  overview: "Ask about your savings picture",
  protect: "Ask about your protection plan",
  exchange: "Ask about a swap or a payment",
  agent: "Ask about a decision or review",
};
export const DEFAULT_GREETING = "Ask Guardian for a clear next action";

export const EXCHANGE_PAIR_KEY = "diversifi.exchange.pair";

export function readExchangePair(): { fromToken: string; toToken: string } | null {
  try {
    const raw = sessionStorage.getItem(EXCHANGE_PAIR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.fromToken === "string" && typeof parsed?.toToken === "string" && parsed.fromToken !== parsed.toToken) {
      return { fromToken: parsed.fromToken, toToken: parsed.toToken };
    }
  } catch {
    /* opaque — fall back to the tab label alone */
  }
  return null;
}

/** Desktop = lg breakpoint and up (1024px), same as Tailwind `lg:`. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 1024px)");
    if (!mq) return;
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function useUserGeminiKey() {
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

export function ProviderBadge({ provider }: { provider?: string }) {
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

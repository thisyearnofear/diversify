/**
 * voice-verbs — the spoken grammar that turns a transcription into an
 * instrument action.
 *
 * Voice inspects, navigates and previews. It never commits — the
 * gesture set's commit verb stays tap/hold (design-language §5). Every
 * verb resolves to a preview/draft only: Shield actions dispatch into
 * use-shield-mode (compare, focus, floor preview, slice inspect), and
 * the Exchange verb merely drafts the ticket via navigateToSwap.
 */
import type { TabId } from "@/constants/tabs";
import type { FinancialStrategy } from "@/context/app/types";
import type { RiskTolerance } from "@/components/protection-cards/plan-preview";
import type { ShieldAction } from "@/components/tabs/protect/use-shield-mode";
import { SLEEVE_ID } from "@/components/tabs/protect/ring-ids";
import { STRATEGIES } from "@/constants/strategies";

export type VoiceVerb =
  /** A ShieldAction verbatim — dispatched by the Shield handler. */
  | { kind: "shield"; action: ShieldAction }
  /** A fuzzy slice query the Shield handler resolves against live legs. */
  | { kind: "slice"; query: string }
  /** "close the biggest gap" — resolved against live alignment. */
  | { kind: "biggest_gap" }
  /** Drafts an Exchange ticket via navigateToSwap — never executes. */
  | { kind: "prefill"; amount: string; from: string; to: string };

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ");
}

/** Spoken aliases beyond each strategy's own id and display name. */
const PHILOSOPHY_ALIASES: Record<string, string[]> = {
  islamic: ["islamic finance", "halal", "sharia"],
  africapitalism: ["africa", "african"],
  buen_vivir: ["buen vivir", "andean"],
  confucian: ["confucian", "confucius"],
  gotong_royong: ["gotong royong", "gotong"],
  pan_caribbean: ["caribbean", "pan caribbean"],
  global: ["global", "diversified", "global diversification"],
  custom: ["custom", "my own"],
};

/**
 * Resolve a spoken phrase to a philosophy id: exact id, display name, or
 * curated alias (longest alias first so "islamic finance" beats a stray
 * shorter hit).
 */
export function philosophyFromText(text: string): FinancialStrategy | null {
  const t = normalize(text);
  if (!t) return null;
  const candidates: { id: FinancialStrategy; phrase: string }[] = [];
  for (const s of STRATEGIES) {
    candidates.push({ id: s.id, phrase: s.id.replace(/_/g, " ") });
    candidates.push({ id: s.id, phrase: s.name.toLowerCase() });
    for (const alias of PHILOSOPHY_ALIASES[s.id] ?? []) {
      candidates.push({ id: s.id, phrase: alias });
    }
  }
  candidates.sort((a, b) => b.phrase.length - a.phrase.length);
  for (const c of candidates) {
    if (t === c.phrase) return c.id;
  }
  return null;
}

const RISK_WORDS: Record<string, RiskTolerance> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

export function matchVoiceVerb(text: string, tab: TabId): VoiceVerb | null {
  const t = normalize(text);
  if (!t) return null;

  if (tab === "protect") {
    if (
      t === "compare" ||
      t === "compare philosophies" ||
      t === "compare plans" ||
      t === "show other plans"
    ) {
      return { kind: "shield", action: { type: "toggleCompare" } };
    }
    if (t === "exit compare" || t === "back to my plan" || t === "stop comparing") {
      return { kind: "shield", action: { type: "exitCompare" } };
    }
    if (
      t === "show tokenized assets" ||
      t === "open the sleeve" ||
      t === "what are tokenized assets"
    ) {
      return { kind: "shield", action: { type: "selectSlice", token: SLEEVE_ID } };
    }
    if (t === "close the biggest gap" || t === "close the largest gap") {
      return { kind: "biggest_gap" };
    }
    const floorMatch = t.match(
      /^(?:make|set)(?: the)? (?:reserve|floor) (conservative|balanced|aggressive)$/,
    );
    if (floorMatch) {
      return {
        kind: "shield",
        action: { type: "previewFloor", risk: RISK_WORDS[floorMatch[1]] },
      };
    }
    if (/^(?:bigger|larger|stronger|more) reserve$/.test(t)) {
      return { kind: "shield", action: { type: "previewFloor", risk: "Conservative" } };
    }
    if (/^(?:smaller|less|lower) reserve$/.test(t)) {
      return { kind: "shield", action: { type: "previewFloor", risk: "Aggressive" } };
    }
    const previewMatch = t.match(/^(?:show|preview|try)(?: me)? (.+)$/);
    if (previewMatch) {
      const philosophy = philosophyFromText(previewMatch[1]);
      if (philosophy) {
        return { kind: "shield", action: { type: "focusPhilosophy", id: philosophy } };
      }
    }
    const sliceMatch = t.match(
      /^(?:show|open|what'?s in|what is in)(?: me| my)? (.+?)(?: slice| leg| position)?$/,
    );
    if (sliceMatch) {
      return { kind: "slice", query: sliceMatch[1] };
    }
    if (t === "cancel" || t === "never mind" || t === "go back") {
      return { kind: "shield", action: { type: "reset" } };
    }
    return null;
  }

  if (tab === "exchange") {
    const swapMatch = t.match(/^swap (\d+(?:\.\d+)?) (\S+) (?:to|for|into) (\S+)$/);
    if (swapMatch) {
      return {
        kind: "prefill",
        amount: swapMatch[1],
        from: swapMatch[2],
        to: swapMatch[3],
      };
    }
    return null;
  }

  // overview (Home) is already served by guardian-interaction.ts's
  // currency intent via askAdvisor — no grammar here.
  return null;
}

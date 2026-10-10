/**
 * corridor-voice — the currency's own register.
 *
 * Each voiced corridor gets a hand-curated epithet that names its FX
 * story the way its own audience does — "japa math", "padala math",
 * "la TRM" — plus lost/gained sentence templates that wrap the SAME
 * drift number the corridor dataset computes. The honesty contract of
 * every other surface applies harder here: a voice carries no numbers,
 * no dates and no claims of its own — it phrases a fact, it never
 * becomes one. A currency with no voice renders nothing; an epithet
 * without a real register behind it is worse than none (that is why the
 * list is short — add a corridor only when the register is genuinely
 * how its audience talks, and re-check it still is).
 */
import { CURRENCY_BY_CODE } from "@/constants/currency-risk";
import { moneyNameFor } from "@/lib/corridor-context";
import type { LiveBeatText } from "@/lib/live-lines";

export interface CorridorVoice {
  /** Fiat code — matches corridor-context's TOKEN_TO_FIAT values. */
  code: string;
  /** The story's local name, shown as the card kicker / beat lead-in. */
  epithet: string;
  /** Why this register is real — kept in-source so the next curator
   *  can verify it rather than trust it. */
  note: string;
  /** Sentence templates for the currency's move vs the dollar.
   *  Placeholders: {name} money name, {other} the stronger side's name,
   *  {pct} rounded drift points, {years} horizon in years. Direction is
   *  chosen from the data — `lost` when vsUSD < 0, `gained` otherwise. */
  lost: string;
  gained: string;
}

export const CORRIDOR_VOICES: Record<string, CorridorVoice> = {
  NGN: {
    code: "NGN",
    epithet: "japa math",
    note: "'Japa' — Yoruba for 'run away' — is how Nigerians name the emigration calculus the naira's slide feeds; the drift number IS the japa math.",
    lost: "japa math: the naira lost ~{pct}% to the {other} in {years} years",
    gained: "japa math: the naira gained ~{pct}% on the {other} in {years} years",
  },
  PHP: {
    code: "PHP",
    epithet: "padala math",
    note: "'Padala' — the remittance OFWs send home — is the peso's lived meaning; the rate is a household figure, not a market one.",
    lost: "padala math: the peso lost ~{pct}% to the {other} in {years} years",
    gained: "padala math: the peso gained ~{pct}% on the {other} in {years} years",
  },
  COP: {
    code: "COP",
    epithet: "la TRM",
    note: "Colombians track 'la TRM' — the official reference rate — the way other countries track weather; it's the currency's own daily number.",
    lost: "la TRM: the peso lost ~{pct}% to the {other} in {years} years",
    gained: "la TRM: the peso gained ~{pct}% on the {other} in {years} years",
  },
  BRL: {
    code: "BRL",
    epithet: "custo Brasil",
    note: "'Custo Brasil' — the Brazil cost — is the country's own name for how much more everything costs at home; the real's slide is the standing example.",
    lost: "custo Brasil: the real lost ~{pct}% to the {other} in {years} years",
    gained: "custo Brasil: the real gained ~{pct}% on the {other} in {years} years",
  },
  ARS: {
    code: "ARS",
    epithet: "el dólar blue",
    note: "Argentina's parallel-market dollar — 'el blue' — is quoted on street corners and front pages alike; the most meme-native currency story in the dataset.",
    lost: "el dólar blue: the peso lost ~{pct}% to the {other} in {years} years",
    gained: "el dólar blue: the peso gained ~{pct}% on the {other} in {years} years",
  },
  GHS: {
    code: "GHS",
    epithet: "the cedi's season",
    note: "The cedi's swings are a national talking point — depreciation winters and appreciation seasons each get named on Ghanaian socials.",
    lost: "the cedi's season: the cedi lost ~{pct}% to the {other} in {years} years",
    gained: "the cedi's season: the cedi gained ~{pct}% on the {other} in {years} years",
  },
};

/** The voice for a fiat code, or null — absence is honest. */
export function voiceFor(code: string | null | undefined): CorridorVoice | null {
  return code ? CORRIDOR_VOICES[code] ?? null : null;
}

function fill(
  template: string,
  vars: { name: string; other: string; pct: number; years: number },
): string {
  return template
    .replace("{name}", vars.name)
    .replace("{other}", vars.other)
    .replace("{pct}", String(vars.pct))
    .replace("{years}", String(vars.years));
}

/**
 * The persona beat — the currency's 5-year move against the dollar told
 * in its own register. The number comes from CURRENCY_RISK_DATA like
 * every other surface; a voice without drift data returns null.
 */
export function voiceBeatForCode(
  code: string | null | undefined,
): LiveBeatText | null {
  const voice = voiceFor(code);
  const entry = code ? CURRENCY_BY_CODE[code] : null;
  if (!voice || !entry) return null;
  const drift = entry.depreciation.vsUSD["5yr"];
  if (!Number.isFinite(drift) || Math.abs(drift) < 1) return null;
  const flag = entry.flag ? `${entry.flag} ` : "";
  return {
    key: `voice-${voice.code}`,
    text: `${flag}${fill(drift < 0 ? voice.lost : voice.gained, {
      name: moneyNameFor(code!),
      other: "dollar",
      pct: Math.abs(Math.round(drift)),
      years: 5,
    })}`,
  };
}

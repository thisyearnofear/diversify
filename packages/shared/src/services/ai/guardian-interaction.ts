/**
 * Reversible Guardian interaction vocabulary, shared by typing and speech.
 * This module cannot authorize transactions or change financial policy.
 * The UI supplies its supported currency catalogue and current view.
 */
export type GuardianBenchmark = 'USD' | 'EUR' | 'XAU';
export type GuardianHorizon = '1yr' | '3yr' | '5yr';
export type GuardianTab = 'overview' | 'protect' | 'exchange' | 'agent';

export type CurrencyView = {
  currencyCode: string;
  benchmark: GuardianBenchmark;
  horizon: GuardianHorizon;
  story: boolean;
};
export type CurrencyClarification = {
  story: boolean;
  benchmark?: GuardianBenchmark;
  horizon?: GuardianHorizon;
};

export type GuardianInteraction =
  | { kind: 'currency'; view: CurrencyView }
  | { kind: 'navigate'; tab: GuardianTab }
  | { kind: 'explain_current' }
  | { kind: 'cancel_draft' }
  | { kind: 'review_proposal' }
  | { kind: 'clarify'; message: string; clarification?: CurrencyClarification };

export type InteractionContext = {
  currencies: readonly string[];
  currency?: CurrencyView | null;
  clarification?: CurrencyClarification | null;
};

/** Only screen-control paraphrases earn an interpretation call. */
export function isInteractionRequest(text: string): boolean {
  const s = text.trim();
  return /^(?:(?:please|can you|could you|would you)\s+)*(?:bring up|pull up|take me|open|show|switch|change|compare|look at)\b/i.test(s)
    && /\b(?:currency|currencies|story|history|reading|comparison|screen|tab|portfolio|shield|home|exchange|naira|brazil|real|gold|euros?|ngn|brl|usd|eur|xau)\b/i.test(s)
    && !/\b(?:why|how|if|unless|dont|don't|do not)\b/i.test(s);
}

export function explainCurrencyReading(reading: {
  currencyCode: string; benchmarkLabel: string; horizon: GuardianHorizon;
  delta: number; dataAsOf: string; isLive: boolean;
}): string {
  const magnitude = Math.abs(reading.delta);
  if (!Number.isFinite(magnitude)) return 'This reading is unavailable. Open its source details before comparing.';
  const change = magnitude < 0.05 ? 'was approximately unchanged'
    : `bought ${magnitude.toFixed(1)}% ${reading.delta < 0 ? 'less' : 'more'}`;
  return `${reading.currencyCode} ${change} against ${reading.benchmarkLabel} over ${reading.horizon[0]} ${reading.horizon === '1yr' ? 'year' : 'years'}. ${reading.isLive ? 'Rate feed' : 'Curated historical data'}, as of ${reading.dataAsOf}. This is a historical currency comparison, not your portfolio return or an executable quote.`;
}

/** Speak complete sentences; never slice through an amount or its unit. */
export function speechReadback(text: string): string {
  const plain = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*#`]/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= 500) return plain;
  const sentences = plain.split(/(?<=[.!?])\s+(?=[A-Z])/);
  let excerpt = '';
  for (const sentence of sentences.slice(0, 2)) {
    if ((excerpt + sentence).length > 500) break;
    excerpt += `${excerpt ? ' ' : ''}${sentence}`;
  }
  return excerpt ? `${excerpt} The full response is in the transcript.` : 'The response is ready in the transcript.';
}

const CURRENCY_NAMES: Record<string, readonly string[]> = {
  NGN: ['naira', 'nigerian naira'],
  BRL: ['brazilian real', 'brazilian reais', 'reais'],
  PHP: ['philippine peso', 'philippine pesos', 'filipino peso'],
  ARS: ['argentine peso', 'argentinian peso'],
  MXN: ['mexican peso'],
  KES: ['kenyan shilling'],
  GHS: ['ghanaian cedi', 'cedi'],
  ZAR: ['south african rand', 'rand'],
  TRY: ['turkish lira', 'lira'],
  INR: ['indian rupee'],
  USD: ['us dollar', 'us dollars', 'dollar', 'dollars'],
  EUR: ['euro', 'euros'],
  GBP: ['british pound', 'sterling'],
  JPY: ['japanese yen', 'yen'],
};

const BENCHMARK_NAMES: Record<GuardianBenchmark, RegExp> = {
  USD: /\b(?:usd|(?:us )?dollars?)\b/,
  EUR: /\b(?:eur|euros?)\b/,
  XAU: /\b(?:xau|gold)\b/,
};
const HORIZONS: readonly GuardianHorizon[] = ['1yr', '3yr', '5yr'];
const BENCHMARKS: readonly GuardianBenchmark[] = ['USD', 'EUR', 'XAU'];
const TABS: readonly GuardianTab[] = ['overview', 'protect', 'exchange', 'agent'];
const normalize = (s: string) => s.toLowerCase().replace(/\bwhat[’']s\b/g, 'what is').replace(/[’']s\b/g, '').replace(/[’']/g, '').replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
const containsName = (text: string, name: string) =>
  new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

function currenciesIn(text: string, supported: readonly string[]): string[] {
  return supported.filter(code =>
    [code.toLowerCase(), ...(CURRENCY_NAMES[code] ?? [])].some(name => containsName(text, name)),
  );
}

function horizonIn(text: string): GuardianHorizon | undefined {
  if (/\b(?:one|1)\s*(?:year|yr)s?\b/.test(text)) return '1yr';
  if (/\b(?:three|3)\s*(?:year|yr)s?\b/.test(text)) return '3yr';
  if (/\b(?:five|5)\s*(?:year|yr)s?\b/.test(text)) return '5yr';
}

/** Strict structural boundary for model output. Unknown keys never execute. */
export function validateInteraction(value: unknown, context: InteractionContext): GuardianInteraction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const exactKeys = (object: Record<string, unknown>, keys: string[]) =>
    Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
  switch (item.kind) {
    case 'currency': {
      if (!exactKeys(item, ['kind', 'view']) || !item.view || typeof item.view !== 'object' || Array.isArray(item.view)) return null;
      const v = item.view as Record<string, unknown>;
      if (!exactKeys(v, ['currencyCode', 'benchmark', 'horizon', 'story'])
        || typeof v.currencyCode !== 'string' || !context.currencies.includes(v.currencyCode)
        || !BENCHMARKS.includes(v.benchmark as GuardianBenchmark)
        || v.currencyCode === v.benchmark
        || !HORIZONS.includes(v.horizon as GuardianHorizon)
        || typeof v.story !== 'boolean') return null;
      return { kind: 'currency', view: v as CurrencyView };
    }
    case 'navigate':
      return exactKeys(item, ['kind', 'tab']) && TABS.includes(item.tab as GuardianTab)
        ? { kind: 'navigate', tab: item.tab as GuardianTab } : null;
    case 'explain_current':
    case 'cancel_draft':
    case 'review_proposal':
      return exactKeys(item, ['kind']) ? { kind: item.kind } : null;
    // Clarifications may be generated locally, but arbitrary model text is
    // not an executable command or a source of financial facts.
    default:
      return null;
  }
}

/** Local, zero-cost path. A miss is conversation, never an execution guess. */
export function discoverInteraction(text: string, context: InteractionContext): GuardianInteraction | null {
  const s = normalize(text);
  if (!s || s.length > 1200) return null;
  // Negations, hypothetical requests and multiple imperative clauses must
  // not become a confident local action merely because they contain a noun.
  if (/\b(?:dont|do not|never|instead|if|unless)\b/.test(s)
    || /\b(?:and|then)\s+(?:show|open|send|swap|buy|sell|change|compare)\b/.test(s)
    || /\b(?:why|risks?|tradeoffs?|should|mean for|recommend|someone saving)\b/.test(s)) return null;
  if (context.clarification) {
    const answer = s.replace(/^the /, '').replace(/ please[.!?]?$/, '').replace(/[.!?]$/, '');
    const code = context.currencies.find(currency =>
      [currency.toLowerCase(), ...(CURRENCY_NAMES[currency] ?? [])].includes(answer),
    );
    if (code) {
      const sameCurrency = context.currency?.currencyCode === code;
      const benchmark = context.clarification.benchmark
        ?? (sameCurrency ? context.currency?.benchmark : undefined)
        ?? (code === 'USD' ? 'XAU' : 'USD');
      if (code === benchmark) return { kind: 'clarify', message: 'Choose a different comparison: dollars, euros, or gold.' };
      return {
        kind: 'currency',
        view: {
          currencyCode: code, benchmark,
          horizon: context.clarification.horizon ?? (sameCurrency ? context.currency?.horizon : undefined) ?? '1yr',
          story: context.clarification.story,
        },
      };
    }
  }
  if (/^(?:please )?(?:cancel|discard|clear)(?: (?:that|this|the|my))?(?: (?:draft|proposal|request))?[.!]?$/.test(s)) {
    return { kind: 'cancel_draft' };
  }
  if (/^(?:please )?(?:confirm|approve|go ahead|sign it|do it)[.!]?$/.test(s)) {
    return { kind: 'review_proposal' };
  }
  if (/^(?:please )?(?:explain (?:that|this|the) (?:number|reading|figure)|what does (?:that|this|the) (?:number|reading|figure) mean|read (?:it|that|this) back)[?.! ]*$/.test(s)) {
    return { kind: 'explain_current' };
  }

  const command = /^(?:(?:please|can you|could you|would you)\s+)*(?:show|open|take me to|go to|switch to|compare|tell me|lets look at)\b/.test(s);
  const storyQuestion = /^(?:what(?: has)? happened to|what(?:s| is) the (?:story|history) of)\b/.test(s);
  if (!command && !storyQuestion) return null;

  const comparison = /\bcompare\b/.test(s);
  const story = storyQuestion || /\b(?:story|history|happened)\b/.test(s);
  if (/\btell me\b/.test(s) && !story) return null;
  const horizon = horizonIn(s);
  if (!horizon && /\b\w+\s*(?:years?|yrs?|months?)\b/.test(s)) {
    return { kind: 'clarify', message: 'Choose a one-, three-, or five-year comparison.' };
  }
  const comparisonParts = comparison ? s.split(/\b(?:with|against|versus|vs\.?|to)\b/) : [s];
  const benchmarkText = comparisonParts.length > 1 ? comparisonParts.slice(1).join(' ') : s;
  const benchmarkMatches = BENCHMARKS.filter(b => BENCHMARK_NAMES[b].test(benchmarkText));
  if (comparison && comparisonParts.length > 1 && benchmarkMatches.length === 0) {
    return { kind: 'clarify', message: 'I can compare with dollars, euros, or gold. Which would you like?' };
  }
  const sourceText = comparisonParts[0];
  const sourceCurrencies = currenciesIn(sourceText, context.currencies);
  let currencyCode = sourceCurrencies.length === 1 ? sourceCurrencies[0] : undefined;
  if (comparison && !currencyCode && sourceCurrencies.length === 0) currencyCode = context.currency?.currencyCode;
  if (story && !currencyCode && /\b(?:that|this|its|it)\b/.test(s)) currencyCode = context.currency?.currencyCode;
  if (sourceCurrencies.length > 1) {
    return { kind: 'clarify', message: 'Which currency should I start with?', clarification: { story, horizon } };
  }
  if (comparison && benchmarkMatches.length > 1) {
    return { kind: 'clarify', message: 'Compare with dollars, euros, or gold?' };
  }
  if (currencyCode) {
    const sameCurrency = context.currency?.currencyCode === currencyCode;
    const benchmark = comparison
      ? benchmarkMatches[0] ?? context.currency?.benchmark
      : sameCurrency ? context.currency?.benchmark : currencyCode === 'USD' ? 'XAU' : 'USD';
    if (!benchmark || benchmark === currencyCode) {
      return { kind: 'clarify', message: 'Choose a different comparison: dollars, euros, or gold.' };
    }
    return {
      kind: 'currency',
      view: {
        currencyCode,
        benchmark,
        horizon: horizon ?? (sameCurrency ? context.currency?.horizon : undefined) ?? '1yr',
        story: comparison ? false : story,
      },
    };
  }
  if (comparison || story || /\b(?:peso|rupee|shilling|currency|currencies)\b/.test(s)) {
    return {
      kind: 'clarify',
      message: /\bpeso\b/.test(s)
        ? 'Which peso do you mean? Say “Philippine peso” or “Argentine peso”.'
        : 'Which currency do you mean? You can say “Nigerian naira” or “Brazilian real”.',
      clarification: { story: !comparison && story, benchmark: comparison ? benchmarkMatches[0] : undefined, horizon },
    };
  }
  const navigation: [RegExp, GuardianTab][] = [
    [/\b(?:home|portfolio)\b/, 'overview'],
    [/\b(?:shield|protection plan|my plan|protect)\b/, 'protect'],
    [/\b(?:exchange|swap screen)\b/, 'exchange'],
    [/\b(?:guardian activity|guardian journal|guardian tab)\b/, 'agent'],
  ];
  const tabs = navigation.filter(([pattern]) => pattern.test(s));
  return tabs.length === 1 ? { kind: 'navigate', tab: tabs[0][1] } : null;
}

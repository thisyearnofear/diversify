/**
 * Bright Data Service
 *
 * Wraps Bright Data's SERP API and Web Unlocker to build a verifiable
 * research evidence layer for DiversiFi. Scrapes central bank announcements,
 * commodity prices, and financial news sentiment — then uses Gemini to
 * parse raw scraped text into structured JSON the AI advisor can consume.
 *
 * Pattern-matched from SynthDataService (retry, caching) and
 * x402-gateway's geminiSynthesise (structured extraction).
 */

import { unifiedCache } from "../utils/unified-cache-service";
import { generateChatCompletion } from "./ai/ai-service";
import type {
  BrightDataCentralBankAnnouncement,
  BrightDataCommodityPrice,
  BrightDataNewsItem,
  BrightDataEvidenceBundle,
  BrightDataBankCode,
  BrightDataCommodity,
} from "./bright-data-types";

const BRIGHT_DATA_BASE = "https://api.brightdata.com";
const API_KEY = () => process.env.BRIGHT_DATA_API_KEY;

const CENTRAL_BANK_DOMAINS: Record<BrightDataBankCode, string> = {
  FED: "federalreserve.gov",
  ECB: "ecb.europa.eu",
  BOE: "bankofengland.co.uk",
  BOJ: "boj.or.jp",
  PBOC: "pbc.gov.cn",
  CBRT: "tcmb.gov.tr",
  SARB: "resbank.co.za",
  BCB: "bcb.gov.br",
};

const COMMODITY_URLS: Record<BrightDataCommodity, string> = {
  gold: "https://www.kitco.com/gold-price-today-usa/",
  crude_oil: "https://oilprice.com/oil-price-charts/",
  brent: "https://oilprice.com/oil-price-charts/",
  copper: "https://www.kitco.com/copper-price-today-usa/",
  wheat: "https://tradingeconomics.com/commodity/wheat",
  corn: "https://tradingeconomics.com/commodity/corn",
};

export class BrightDataService {
  // ── CENTRAL BANK ANNOUNCEMENTS (SERP API) ──────────────────────────

  static async getCentralBankAnnouncements(params: {
    banks: BrightDataBankCode[];
    maxAgeHours?: number;
  }): Promise<BrightDataCentralBankAnnouncement[]> {
    const { banks, maxAgeHours = 48 } = params;
    const cacheKey = `brightdata:central-banks:${banks.sort().join(",")}:${maxAgeHours}`;

    const { data } = await unifiedCache.getOrFetch(
      cacheKey,
      async () => {
        const results = await Promise.all(
          banks.map((bank) => fetchBankAnnouncements(bank, maxAgeHours))
        );
        const flattened = results.flat();
        return { data: flattened, source: "brightdata-serp" };
      },
      "moderate",
      false
    );

    return data;
  }

  // ── COMMODITY PRICES (Web Unlocker) ───────────────────────────────

  static async getCommodityPrices(params: {
    commodities: BrightDataCommodity[];
  }): Promise<BrightDataCommodityPrice[]> {
    const { commodities } = params;
    const cacheKey = `brightdata:commodities:${commodities.sort().join(",")}`;

    const { data } = await unifiedCache.getOrFetch(
      cacheKey,
      async () => {
        const results = await Promise.all(
          commodities.map((c) => fetchCommodityPrice(c))
        );
        return { data: results.filter(Boolean) as BrightDataCommodityPrice[], source: "brightdata-unlocker" };
      },
      "volatile",
      false
    );

    return data;
  }

  // ── FINANCIAL NEWS SENTIMENT (SERP API) ───────────────────────────

  static async getFinancialNewsSentiment(params: {
    regions?: string[];
    topics?: string[];
    maxItems?: number;
  }): Promise<BrightDataNewsItem[]> {
    const { regions = ["US"], topics = ["inflation", "central bank", "commodities"], maxItems = 10 } = params;
    const cacheKey = `brightdata:news:${regions.sort().join(",")}:${topics.sort().join(",")}`;

    const { data } = await unifiedCache.getOrFetch(
      cacheKey,
      async () => {
        const queries = buildNewsQueries(regions, topics);
        const rawResults = await Promise.all(
          queries.map((q) => fetchSerpResults(q, maxItems / queries.length || 3))
        );
        const headlines = rawResults.flat();
        const parsed = await parseNewsSentiment(headlines);
        return { data: parsed, source: "brightdata-serp" };
      },
      "moderate",
      false
    );

    return data;
  }

  // ── EVIDENCE LAYER BUNDLE ─────────────────────────────────────────

  static async getEvidenceLayer(): Promise<BrightDataEvidenceBundle> {
    const cacheKey = "brightdata:evidence-layer";

    const { data } = await unifiedCache.getOrFetch(
      cacheKey,
      async () => {
        const [centralBanks, commodities, news] = await Promise.all([
          BrightDataService.getCentralBankAnnouncements({
            banks: ["FED", "ECB", "BOE", "BOJ", "PBOC", "CBRT", "SARB", "BCB"],
            maxAgeHours: 24,
          }),
          BrightDataService.getCommodityPrices({
            commodities: ["gold", "crude_oil", "copper", "wheat"],
          }),
          BrightDataService.getFinancialNewsSentiment({
            regions: ["US", "EU", "EM"],
            topics: ["inflation", "central bank", "commodities"],
            maxItems: 15,
          }),
        ]);

        const sourceUrls = [
          ...centralBanks.map((a) => a.url),
          ...commodities.map((c) => c.sourceUrl),
          ...news.map((n) => n.url),
        ].filter(Boolean);

        const bundle: BrightDataEvidenceBundle = {
          centralBanks,
          commodities,
          news,
          meta: { generatedAt: new Date().toISOString(), sourceUrls },
        };

        return { data: bundle, source: "brightdata-evidence-layer" };
      },
      "moderate",
      false
    );

    return data;
  }
}

// ── INTERNAL FETCH HELPERS ────────────────────────────────────────────

async function fetchBankAnnouncements(
  bank: BrightDataBankCode,
  maxAgeHours: number
): Promise<BrightDataCentralBankAnnouncement[]> {
  const domain = CENTRAL_BANK_DOMAINS[bank];
  const queries = [
    `${bank} rate decision statement site:${domain}`,
    `${bank} monetary policy minutes site:${domain}`,
    `${bank} press conference transcript site:${domain}`,
  ];

  const allResults = await Promise.all(queries.map((q) => fetchSerpResults(q, 3)));
  const flat = allResults.flat();

  if (flat.length === 0) {
    return [];
  }

  const snippets = flat
    .map((r: any) => `TITLE: ${r.title}\nURL: ${r.url}\nSNIPPET: ${r.snippet}\nDATE: ${r.date || "unknown"}`)
    .join("\n\n---\n\n");

  return parseWithGemini<BrightDataCentralBankAnnouncement[]>(
    `You are a central bank policy analyst. Extract structured data from search results.

RESPOND WITH VALID JSON ONLY — an array of objects:
[{ "bank": "${bank}", "title": string, "snippet": string, "url": string, "publishedDate": string,
   "keyTakeaways": string[] (max 3), "policyStance": "hawkish"|"dovish"|"neutral", "rateChangeBps": number|null,
   "confidenceScore": number (0-1) }]

If the search results don't contain actual central bank announcements, return an empty array [].

Search results:
${snippets}`,
    []
  );
}

async function fetchCommodityPrice(
  commodity: BrightDataCommodity
): Promise<BrightDataCommodityPrice | null> {
  const url = COMMODITY_URLS[commodity];
  if (!url) return null;

  const rawHtml = await fetchWebUnlocker(url);
  if (!rawHtml) return null;

  const text = stripHtml(rawHtml).slice(0, 3000);

  return parseWithGemini<BrightDataCommodityPrice | null>(
    `Extract the CURRENT SPOT PRICE from a scraped commodity page.
Respond with VALID JSON ONLY — a single object, or null if no price found:
{ "commodity": "${commodity}", "price": number, "currency": "USD", "unit": string (e.g. "per ounce"),
  "change24h": number, "change24hPct": number, "source": string, "sourceUrl": "${url}",
  "retrievedAt": "${new Date().toISOString()}" } | null

SCRAPED PAGE CONTENT:
${text}`,
    null
  );
}

function buildNewsQueries(regions: string[], topics: string[]): string[] {
  const regionMap: Record<string, string> = {
    US: "US financial markets",
    EU: "European financial markets",
    EM: "emerging markets finance",
    Global: "global financial markets",
  };

  const queries: string[] = [];
  for (const region of regions) {
    const regionLabel = regionMap[region] || region;
    for (const topic of topics) {
      queries.push(`${regionLabel} ${topic} news today`);
    }
  }
  return queries;
}

async function parseNewsSentiment(
  rawHeadlines: Array<{ title: string; snippet: string; url: string; date?: string; source?: string }>
): Promise<BrightDataNewsItem[]> {
  if (rawHeadlines.length === 0) return [];

  const input = rawHeadlines
    .map((h, i) => `[${i}] HEADLINE: ${h.title}\n    SOURCE: ${h.source || "unknown"}\n    SNIPPET: ${h.snippet}\n    URL: ${h.url}`)
    .join("\n\n");

  return parseWithGemini<BrightDataNewsItem[]>(
    `You are a financial news sentiment analyst. Classify each headline.
Respond with VALID JSON ONLY — array of:
[{ "headline": string, "source": string, "url": string, "publishedDate": string, "snippet": string,
   "sentiment": "positive"|"negative"|"neutral", "sentimentScore": number (-1 to 1),
   "region": "US"|"EU"|"EM"|"Global", "topics": string[] }]

Headlines:
${input}`,
    []
  );
}

// ── BRIGHT DATA API CALLS ─────────────────────────────────────────────

async function fetchSerpResults(
  query: string,
  numResults: number = 5
): Promise<Array<{ title: string; snippet: string; url: string; date?: string; source?: string }>> {
  const data = await makeBrightDataRequest<any>(
    "/serp/req",
    {
      query,
      num_results: numResults,
      include_markdown: false,
    }
  );

  if (!data?.organic) return [];

  return data.organic.slice(0, numResults).map((r: any) => ({
    title: r.title || "",
    snippet: r.snippet || r.description || "",
    url: r.link || r.url || "",
    date: r.date || undefined,
    source: r.source || extractDomain(r.link || ""),
  }));
}

async function fetchWebUnlocker(url: string): Promise<string | null> {
  const data = await makeBrightDataRequest<any>(
    "/unlocker/request",
    {
      url,
      method: "GET",
      format: "raw",
    }
  );

  return data?.body || data?.html || data?.content || null;
}

// ── SHARED INFRASTRUCTURE ─────────────────────────────────────────────

async function makeBrightDataRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T | null> {
  const key = API_KEY();
  if (!key) {
    console.warn("[BrightData] No BRIGHT_DATA_API_KEY configured");
    return null;
  }

  const maxRetries = 2;
  const baseDelay = 1000;
  const url = `${BRIGHT_DATA_BASE}${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status >= 400) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      return (await response.json()) as T;
    } catch (error: any) {
      const is4xx = error?.message?.match(/^HTTP 4\d\d/);
      if (is4xx || attempt === maxRetries) {
        console.warn(`[BrightData] Request failed (attempt ${attempt + 1}):`, error.message);
        return null;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`[BrightData] Retrying in ${delay}ms (attempt ${attempt + 1})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

async function parseWithGemini<T>(
  systemPrompt: string,
  fallback: T
): Promise<T> {
  try {
    const result = await generateChatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Extract the data now." },
      ],
      responseMimeType: "application/json",
      temperature: 0.1,
      maxTokens: 800,
    }, "gemini");

    const trimmed = result.content.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate =
      fencedMatch?.[1]?.trim() ||
      (() => {
        const startBrace = trimmed.indexOf("{");
        const startBracket = trimmed.indexOf("[");
        const start = startBrace === -1 ? startBracket : startBracket === -1 ? startBrace : Math.min(startBrace, startBracket);
        if (start === -1) return trimmed;
        const endChar = trimmed[start] === "{" ? "}" : "]";
        const end = trimmed.lastIndexOf(endChar);
        if (end === -1 || end <= start) return trimmed;
        return trimmed.slice(start, end + 1).trim();
      })();

    return JSON.parse(candidate) as T;
  } catch (err) {
    console.warn("[BrightData] Gemini parsing failed:", (err as Error).message);
    return fallback;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

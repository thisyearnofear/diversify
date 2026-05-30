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

const BRIGHT_DATA_BASE = "https://api.brightdata.com/request";
const API_KEY = () => process.env.BRIGHT_DATA_API_KEY || "";
const UNLOCKER_ZONE = () => process.env.BRIGHT_DATA_UNLOCKER_ZONE || "web_unlocker1";

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

  // Try direct HTML parsing first
  const parsedHtml = parseCommodityHtml(commodity, rawHtml, url);
  if (parsedHtml) return parsedHtml;

  // Fallback: strip HTML and try Gemini
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

function parseCommodityHtml(commodity: string, html: string, sourceUrl: string): BrightDataCommodityPrice | null {
  const text = stripHtml(html);
  const units: Record<string, string> = {
    gold: "per ounce", crude_oil: "per barrel", brent: "per barrel",
    copper: "per ounce", wheat: "per bushel", corn: "per bushel",
  };

  // Try multiple pattern families
  const patterns = [
    // "Gold price today: $2,342.50"
    new RegExp(`${commodity.replace(/_/g, '\\s*')}[\\s\\w]*?(?:price|spot)[:\\s]*\\$?([\\d,]+(?:\\.\\d{1,2})?)`, 'i'),
    // "$2,342.50 per ounce"
    /\$?([\d,]+(?:\.\d{1,2})?)\s*(?:USD|US\s*Dollars?)?\s*(?:per\s+(?:troy\s+)?(?:oz|ounce|barrel|bushel))/i,
    // Simple price: 2,342.50 USD
    /([\d,]+(?:\.\d{1,2})?)\s*(?:USD|US\s*Dollars?)/i,
  ];

  const changePatterns = [
    /(?:change|Δ)[\s:]*([+-]?[\d,]+(?:\.\d{1,2})?)/i,
    /([+-]?[\d,]+(?:\.\d{1,2})?)\s*(?:%|percent)/i,
  ];

  let price: number | null = null;
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      price = parseFloat(match[1].replace(/,/g, ''));
      break;
    }
  }

  if (!price || isNaN(price)) return null;

  let change24h = 0;
  let change24hPct = 0;
  for (const pattern of changePatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val)) {
        // If it has a % sign, it's percentage change
        if (match[0].includes('%')) {
          change24hPct = val;
          change24h = (price * val) / 100;
        } else {
          change24h = val;
          change24hPct = (val / price) * 100;
        }
        break;
      }
    }
  }

  return {
    commodity,
    price,
    currency: "USD",
    unit: units[commodity] || "per unit",
    change24h,
    change24hPct,
    source: new URL(sourceUrl).hostname.replace("www.", ""),
    sourceUrl,
    retrievedAt: new Date().toISOString(),
  };
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
  const zone = UNLOCKER_ZONE();
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${numResults}&hl=en`;

  const rawHtml = await makeBrightDataRequest<string>({
    zone,
    url: googleUrl,
    format: "raw",
  });

  if (!rawHtml) return [];
  const results = parseGoogleSerpHtml(rawHtml, numResults);
  if (results.length > 0) return results;

  // Fallback: try Gemini
  return parseWithGemini<Array<{ title: string; snippet: string; url: string; date?: string; source?: string }>>(
    `Extract search results from Google SERP HTML. Return VALID JSON array of objects:
[{ "title": string, "snippet": string, "url": string, "date": string|null, "source": string }]
Only include actual organic search results. Return [] if no results found.

HTML:
${rawHtml.slice(0, 6000)}`,
    []
  );
}

function parseGoogleSerpHtml(html: string, maxResults: number): Array<{ title: string; snippet: string; url: string; date?: string; source?: string }> {
  const results: Array<{ title: string; snippet: string; url: string; date?: string; source?: string }> = [];

  // Extract title-URL pairs from search result links
  // Google search results: <a href="URL"><h3>TITLE</h3></a>
  const linkBlocks = html.match(/<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi) || [];
  const seen = new Set<string>();

  for (const block of linkBlocks) {
    if (results.length >= maxResults) break;

    const hrefMatch = block.match(/href="(https?:\/\/[^"]+)"/i);
    const url = hrefMatch ? hrefMatch[1].replace(/&amp;/g, '&') : '';
    if (!url || url.includes('google.com') || url.includes('accounts.google.com') || url.includes('support.google.com')) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    // Extract title from <h3>
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim() : '';

    // Find snippet near this result
    const blockStart = html.indexOf(url);
    const afterBlock = blockStart > 0 ? html.slice(blockStart, blockStart + 2000) : '';
    const snippetMatch = afterBlock.match(/(?:<span[^>]*>|<\/h3>)\s*([^<]{30,300})/i);
    const snippet = snippetMatch ? snippetMatch[1].trim() : '';

    if (title || url) {
      let source = '';
      try { source = new URL(url).hostname.replace('www.', ''); } catch {}

      results.push({ title, snippet: snippet.slice(0, 200), url, source });
    }
  }

  // Fallback: look for any h3 tags with related links
  if (results.length === 0) {
    const h3s = html.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
    const h3Texts = h3s.map(h => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim()).filter(Boolean);
    const rawLinks = html.match(/https?:\/\/[^\s"<>]+/gi) || [];
    const externalLinks = rawLinks.filter(l => !l.includes('google.com') && !l.includes('gstatic.com'));

    for (let i = 0; i < Math.min(h3Texts.length, externalLinks.length, maxResults); i++) {
      let source = '';
      try { source = new URL(externalLinks[i]).hostname.replace('www.', ''); } catch {}
      results.push({ title: h3Texts[i], snippet: '', url: externalLinks[i], source });
    }
  }

  return results;
}

async function fetchWebUnlocker(url: string): Promise<string | null> {
  const zone = UNLOCKER_ZONE();
  if (!zone) {
    console.warn("[BrightData] No BRIGHT_DATA_UNLOCKER_ZONE configured");
    return null;
  }

  return makeBrightDataRequest<string>({
    zone,
    url,
    format: "raw",
  });
}

// ── SHARED INFRASTRUCTURE ─────────────────────────────────────────────

async function makeBrightDataRequest<T>(
  body: Record<string, unknown>
): Promise<T | null> {
  const key = API_KEY();
  if (!key) {
    console.warn("[BrightData] No BRIGHT_DATA_API_KEY configured");
    return null;
  }

  const maxRetries = 2;
  const baseDelay = 2000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(BRIGHT_DATA_BASE, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text();

      if (response.status >= 400) {
        console.warn(`[BrightData] HTTP ${response.status}: ${responseText.slice(0, 300)}`);
        if (response.status >= 400 && response.status < 500) {
          return null; // Don't retry client errors
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return responseText as unknown as T;
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn(`[BrightData] Request timed out (attempt ${attempt + 1})`);
      }
      const is4xx = error?.message?.match(/^HTTP 4\d\d/);
      if (is4xx || attempt === maxRetries) {
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
    console.warn("[BrightData] Gemini parsing failed, using regex fallback:", (err as Error).message);
    try {
      return regexParse<T>(systemPrompt, fallback);
    } catch (e2) {
      console.warn("[BrightData] Regex fallback also failed:", (e2 as Error).message);
      return fallback;
    }
  }
}

function regexParse<T>(systemPrompt: string, fallback: T): T {
  const text = systemPrompt;

  // Try to extract headlines + URLs from search result HTML or text
  const headlineMatches = text.match(/TITLE:\s*(.+?)(?:\n|$)/gi) || [];
  const urlMatches = text.match(/URL:\s*(https?:\/\/\S+)/gi) || [];
  const snippetMatches = text.match(/SNIPPET:\s*(.+?)(?:\n|$)/gi) || [];

  const headlines = headlineMatches.map((m: string) => m.replace(/^TITLE:\s*/i, '').trim());
  const urls = urlMatches.map((m: string) => m.replace(/^URL:\s*/i, '').trim());
  const snippets = snippetMatches.map((m: string) => m.replace(/^SNIPPET:\s*/i, '').trim());

  if (headlines.length > 0) {
    const results = headlines.map((title: string, i: number) => ({
      title,
      snippet: snippets[i] || '',
      url: urls[i] || '',
      source: urls[i] ? new URL(urls[i]).hostname.replace('www.', '') : '',
    }));
    return results as unknown as T;
  }

  // Try to extract commodity prices from raw text
  const priceMatch = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:USD|\$)/i);
  if (priceMatch) {
    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    return { price, currency: 'USD' } as unknown as T;
  }

  return fallback;
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

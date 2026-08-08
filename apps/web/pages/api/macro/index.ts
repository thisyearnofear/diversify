/**
 * API Route: Macro Economic Data Proxy
 * Fetches GDP Growth and Corruption Indicators from World Bank
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { PRIORITY_COUNTRIES } from "../../../constants/inflation";

const WORLD_BANK_URL = "https://api.worldbank.org/v2";

// Server-side cache
let serverCache: {
  data: Record<string, {
    gdpGrowth: number | null;
    corruptionControl: number | null;
    year: number;
  }>;
  timestamp: number;
  countries: string;
} | null = null;

const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours (Macro data changes slowly)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { countries } = req.query;
  const countriesStr = (countries as string) || "";

  // Check cache
  if (
    serverCache &&
    Date.now() - serverCache.timestamp < CACHE_TTL &&
    serverCache.countries === countriesStr
  ) {
    // console.log('[Macro API] Serving from server-side cache');
    return res.status(200).json(serverCache.data);
  }

  const targetCountries = countries
    ? (countries as string).split(",").filter(Boolean)
    : PRIORITY_COUNTRIES;

  try {
    const data = await fetchMacroData(targetCountries);

    if (Object.keys(data).length > 0) {
      // console.log(`[Macro API] Fetched data for ${Object.keys(data).length} countries`);
      serverCache = { data, timestamp: Date.now(), countries: countriesStr };
      return res.status(200).json(data);
    }

    throw new Error("No data returned");
  } catch (error) {
    console.warn("[Macro API] Failed to fetch data:", error);
    // Return empty data instead of fake fallbacks
    return res.status(200).json({});
  }
}

interface MacroData {
  gdpGrowth: number | null; // % Annual Growth
  corruptionControl: number | null; // Percentile Rank (0-100)
  politicalStability: number | null; // Percentile Rank (0-100)
  ruleOfLaw: number | null; // Percentile Rank (0-100)
  governmentEffectiveness: number | null; // Percentile Rank (0-100)
  year: number;
}

async function fetchMacroData(
  countryCodes: string[],
): Promise<Record<string, MacroData>> {
  const currentYear = new Date().getFullYear();
  // Fetch slightly wider range to ensure we get latest available data
  const dateRange = `${currentYear - 3}:${currentYear}`;
  const countryParam = countryCodes.join(";");

  const indicators = {
    gdpGrowth: "NY.GDP.MKTP.KD.ZG",
    corruptionControl: "CC.PER",
    politicalStability: "PV.PER",
    ruleOfLaw: "RL.PER",
    governmentEffectiveness: "GE.PER",
  };

  const result: Record<string, MacroData> = {};

  // Fetch all indicators in parallel with settlement protection
  const requests = Object.entries(indicators).map(async ([field, id]) => {
    try {
      const source = field === "gdpGrowth" ? 2 : 3; // Source 2 for GDP, 3 for WGI
      const res = await fetch(
        `${WORLD_BANK_URL}/country/${countryParam}/indicator/${id}?format=json&per_page=1000&date=${dateRange}&source=${source}`,
        { signal: AbortSignal.timeout(12000) },
      );
      if (!res.ok) return { field, data: null };
      const data = await res.json();
      return { field, data };
    } catch (e) {
      console.warn(`[Macro API] Failed to fetch ${field}:`, e);
      return { field, data: null };
    }
  });

  const responses = await Promise.all(requests);

  interface WorldBankItem {
    countryiso3code: string;
    date: string;
    value: number | null;
  }

  responses.forEach(({ field, data }) => {
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1]))
      return;

    data[1].forEach((item: WorldBankItem) => {
      const code = item.countryiso3code;
      if (!code) return;

      const year = parseInt(item.date);
      const value = item.value;

      if (value === null) return;

      if (!result[code]) {
        result[code] = {
          gdpGrowth: null,
          corruptionControl: null,
          politicalStability: null,
          ruleOfLaw: null,
          governmentEffectiveness: null,
          year: 0,
        };
      }

      // WB returns sorted by date DESC usually. First valid value is latest.
      const val = parseFloat(Number(value).toFixed(1));
      const record = result[code];

      if (field === "gdpGrowth" && record.gdpGrowth === null) {
        record.gdpGrowth = val;
      } else if (
        field === "corruptionControl" &&
        record.corruptionControl === null
      ) {
        record.corruptionControl = val;
      } else if (
        field === "politicalStability" &&
        record.politicalStability === null
      ) {
        record.politicalStability = val;
      } else if (field === "ruleOfLaw" && record.ruleOfLaw === null) {
        record.ruleOfLaw = val;
      } else if (
        field === "governmentEffectiveness" &&
        record.governmentEffectiveness === null
      ) {
        record.governmentEffectiveness = val;
      }

      if (year > record.year) record.year = year;
    });
  });

  return result;
}

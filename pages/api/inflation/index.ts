/**
 * API Route: Inflation Data Proxy
 * Fetches from IMF (primary) → World Bank (fallback) → static fallback
 * Handles CORS by making server-side requests
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getFallbackByRegion,
  PRIORITY_COUNTRIES,
  COUNTRY_NAMES
} from '../../../constants/inflation';

const IMF_URL = 'https://www.imf.org/external/datamapper/api/v1/PCPIPCH';
const WORLD_BANK_URL = 'https://api.worldbank.org/v2';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { countries } = req.query;
  const targetCountries = countries 
    ? (countries as string).split(',').filter(Boolean)
    : PRIORITY_COUNTRIES;

  // Try IMF first (most current data with forecasts)
  try {
    const imfData = await fetchFromIMF(targetCountries);
    if (imfData.countries.length > 0) {
      console.log(`[Inflation API] IMF returned ${imfData.countries.length} countries`);
      return res.status(200).json(imfData);
    }
  } catch (error) {
    console.warn('[Inflation API] IMF failed:', error);
  }

  // Fall back to World Bank (historical data)
  try {
    const wbData = await fetchFromWorldBank(targetCountries);
    if (wbData.countries.length > 0) {
      console.log(`[Inflation API] World Bank returned ${wbData.countries.length} countries`);
      return res.status(200).json(wbData);
    }
  } catch (error) {
    console.warn('[Inflation API] World Bank failed:', error);
  }

  // Last resort: static fallback data
  console.warn('[Inflation API] All sources failed, using fallback');

  // Get the fallback data organized by region
  const fallbackByRegion = getFallbackByRegion();

  // Flatten the regional data into a single countries array
  const allCountries = Object.values(fallbackByRegion).flatMap(regionData =>
    regionData.countries.map(country => ({
      country: country.country,
      countryCode: country.country, // Using country as countryCode for simplicity
      value: country.value,
      year: country.year,
      source: 'fallback'
    }))
  );

  res.status(200).json({
    countries: allCountries,
    source: 'fallback',
    lastUpdated: new Date().toISOString()
  });
}

async function fetchFromIMF(countryCodes: string[]) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  
  const response = await fetch(
    `${IMF_URL}?periods=${years.join(',')}`,
    { 
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!response.ok) {
    throw new Error(`IMF API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.values?.PCPIPCH) {
    throw new Error('Invalid IMF response');
  }

  const inflationData = data.values.PCPIPCH;
  
  const countries = countryCodes
    .filter(code => inflationData[code])
    .map(code => {
      const countryData = inflationData[code];
      // Prefer current year, then previous, then forecast
      const value = countryData[currentYear.toString()] ?? 
                   countryData[(currentYear - 1).toString()] ??
                   countryData[(currentYear + 1).toString()];
      
      const year = countryData[currentYear.toString()] !== undefined 
        ? currentYear 
        : currentYear - 1;

      return {
        country: COUNTRY_NAMES[code] || code,
        countryCode: code,
        value: typeof value === 'number' ? parseFloat(value.toFixed(1)) : null,
        year,
        source: 'imf'
      };
    })
    .filter(item => item.value !== null);

  return {
    countries,
    source: 'imf',
    lastUpdated: new Date().toISOString()
  };
}

interface WorldBankIndicatorItem {
  countryiso3code: string;
  date: string;
  value: number | null;
  country: {
    id: string;
    value: string;
  };
}

async function fetchFromWorldBank(countryCodes: string[]) {
  const currentYear = new Date().getFullYear();
  const countryParam = countryCodes.join(';');
  
  const response = await fetch(
    `${WORLD_BANK_URL}/country/${countryParam}/indicator/FP.CPI.TOTL.ZG?format=json&per_page=100&date=${currentYear - 2}:${currentYear}`,
    { signal: AbortSignal.timeout(8000) }
  );

  if (!response.ok) {
    throw new Error(`World Bank API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[1])) {
    throw new Error('Invalid World Bank response');
  }

  // Group by country and get most recent value
  const countryLatest: Record<string, {
    country: string;
    countryCode: string;
    value: number;
    year: number;
    source: string;
  }> = {};
  
  data[1]
    .filter((item: WorldBankIndicatorItem) => item.value !== null)
    .forEach((item: WorldBankIndicatorItem) => {
      const code = item.countryiso3code;
      const year = parseInt(item.date);
      const value = item.value as number;
      
      if (!countryLatest[code] || year > countryLatest[code].year) {
        countryLatest[code] = {
          country: item.country.value,
          countryCode: code,
          value: parseFloat(value.toFixed(1)),
          year,
          source: 'worldbank'
        };
      }
    });

  return {
    countries: Object.values(countryLatest),
    source: 'worldbank',
    lastUpdated: new Date().toISOString()
  };
}

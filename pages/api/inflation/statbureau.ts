/**
 * API Route: Proxy for StatBureau inflation data
 * Avoids CORS issues by making server-side requests
 */

import type { NextApiRequest, NextApiResponse } from 'next';

const STAT_BUREAU_BASE_URL = 'https://www.statbureau.org/get-data-json';

// Country mappings
const COUNTRY_MAPPINGS: Record<string, string> = {
  'USA': 'united-states',
  'CAN': 'canada',
  'DEU': 'germany',
  'GBR': 'united-kingdom',
  'JPN': 'japan',
  'AUS': 'australia',
  'FRA': 'france',
  'ITA': 'italy',
  'ESP': 'spain',
  'BRA': 'brazil',
  'MEX': 'mexico',
  'IND': 'india',
  'CHN': 'china',
  'ZAF': 'south-africa',
  'KEN': 'kenya',
  'NGA': 'nigeria',
};

const REVERSE_MAPPINGS: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_MAPPINGS).map(([code, name]) => [name, code])
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { countries } = req.query;
    
    // Parse countries parameter (comma-separated country codes)
    const countryCodes = countries 
      ? (countries as string).split(',').filter(Boolean)
      : Object.keys(COUNTRY_MAPPINGS);

    const results = [];
    const errors = [];

    // Fetch data for each country
    for (const code of countryCodes) {
      const countryName = COUNTRY_MAPPINGS[code];
      
      if (!countryName) {
        errors.push({ country: code, error: 'Unknown country code' });
        continue;
      }

      try {
        const response = await fetch(
          `${STAT_BUREAU_BASE_URL}?country=${countryName}`,
          {
            headers: {
              'User-Agent': 'DiversiFi/1.0',
            },
            // Add timeout
            signal: AbortSignal.timeout(5000),
          }
        );

        if (!response.ok) {
          errors.push({ 
            country: code, 
            error: `HTTP ${response.status}` 
          });
          continue;
        }

        const data = await response.json();
        
        // Log the raw response for debugging
        console.log(`[StatBureau API] Response for ${countryName}:`, JSON.stringify(data).substring(0, 200));
        
        // Extract inflation rate - StatBureau returns an array with InflationRate field
        let inflationRate = 0;
        
        if (Array.isArray(data) && data.length > 0) {
          // Get the most recent inflation rate (first item in array)
          const latestData = data[0];
          if (latestData.InflationRate) {
            inflationRate = parseFloat(latestData.InflationRate);
          } else if (latestData.InflationRateRounded) {
            inflationRate = parseFloat(latestData.InflationRateRounded);
          }
        } else if (data.inflation_rate) {
          inflationRate = parseFloat(data.inflation_rate);
        } else if (data.value) {
          inflationRate = parseFloat(data.value);
        } else if (data.rate) {
          inflationRate = parseFloat(data.rate);
        } else if (typeof data === 'number') {
          inflationRate = data;
        }
        
        console.log(`[StatBureau API] Extracted rate for ${code}: ${inflationRate}`);
        
        if (!isNaN(inflationRate)) {
          results.push({
            country: normalizeCountryName(countryName),
            countryCode: code,
            value: inflationRate,
            year: new Date().getFullYear(),
            source: 'statbureau',
          });
        } else {
          errors.push({ 
            country: code, 
            error: 'Invalid inflation rate data' 
          });
        }
      } catch (error: any) {
        errors.push({ 
          country: code, 
          error: error.message || 'Fetch failed' 
        });
      }
    }

    // Return results
    res.status(200).json({
      countries: results,
      source: 'statbureau',
      lastUpdated: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('StatBureau proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inflation data',
      message: error.message 
    });
  }
}

function normalizeCountryName(apiCountry: string): string {
  const mappings: Record<string, string> = {
    'united-states': 'United States',
    'united-kingdom': 'United Kingdom',
    'germany': 'Germany',
    'canada': 'Canada',
    'japan': 'Japan',
    'australia': 'Australia',
    'france': 'France',
    'italy': 'Italy',
    'spain': 'Spain',
    'brazil': 'Brazil',
    'mexico': 'Mexico',
    'india': 'India',
    'china': 'China',
    'south-africa': 'South Africa',
    'kenya': 'Kenya',
    'nigeria': 'Nigeria',
  };
  return mappings[apiCountry] || apiCountry.split('-').map(w => 
    w.charAt(0).toUpperCase() + w.slice(1)
  ).join(' ');
}

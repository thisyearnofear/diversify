/**
 * Inflation Data Constants
 * Single source of truth for fallback inflation data
 */

export interface InflationDataEntry {
  avgRate: number;
  data?: Array<{
    year: number;
    rate: number;
  }>;
  countries?: string[];
  stablecoins: string[];
}

export interface CountryInflationData {
  country: string;
  region: string;
  currency: string;
  value: number;
  year: number;
}

export interface RegionalInflationData {
  region: string;
  avgRate: number;
  countries: CountryInflationData[];
  stablecoins: string[];
}

export const FALLBACK_INFLATION_DATA: Record<string, InflationDataEntry> = {
  Africa: {
    avgRate: 12.5,
    data: [
      { year: 2020, rate: 11.8 },
      { year: 2021, rate: 13.2 },
      { year: 2022, rate: 14.1 },
      { year: 2023, rate: 12.5 },
    ],
    countries: ["NG", "KE", "ZA", "EG", "GH"],
    stablecoins: ["USDT", "USDC", "DAI", "UST"]
  },
  Asia: {
    avgRate: 4.2,
    data: [
      { year: 2020, rate: 3.8 },
      { year: 2021, rate: 4.5 },
      { year: 2022, rate: 4.8 },
      { year: 2023, rate: 4.2 },
    ],
    countries: ["IN", "TH", "VN", "PH", "ID"],
    stablecoins: ["USDT", "USDC", "DAI", "PAX"]
  },
  Europe: {
    avgRate: 6.8,
    data: [
      { year: 2020, rate: 1.9 },
      { year: 2021, rate: 3.2 },
      { year: 2022, rate: 9.2 },
      { year: 2023, rate: 6.8 },
    ],
    countries: ["DE", "FR", "IT", "ES", "NL"],
    stablecoins: ["USDT", "USDC", "DAI", "EURT", "EUROC"]
  },
  USA: {
    avgRate: 4.1,
    data: [
      { year: 2020, rate: 1.2 },
      { year: 2021, rate: 4.7 },
      { year: 2022, rate: 8.0 },
      { year: 2023, rate: 4.1 },
    ],
    countries: ["US"],
    stablecoins: ["USDT", "USDC", "DAI", "GUSD", "BUSD"]
  },
  LatAm: {
    avgRate: 8.7,
    data: [
      { year: 2020, rate: 6.5 },
      { year: 2021, rate: 8.2 },
      { year: 2022, rate: 10.1 },
      { year: 2023, rate: 8.7 },
    ],
    countries: ["BR", "AR", "MX", "CO", "CL"],
    stablecoins: ["USDT", "USDC", "DAI", "PAX"]
  }
};

export const INFLATION_DATA_SOURCES = {
  PRIMARY: 'IMF',
  SECONDARY: 'WorldBank',
  FALLBACK: 'LocalConstants'
};

// Country to region mapping
export const COUNTRY_TO_REGION: Record<string, string> = {
  'KEN': 'Africa', 'GHA': 'Africa', 'ZAF': 'Africa', 'EGY': 'Africa', 'NGA': 'Africa',
  'BRA': 'LatAm', 'ARG': 'LatAm', 'MEX': 'LatAm', 'COL': 'LatAm', 'CHL': 'LatAm',
  'IND': 'Asia', 'THA': 'Asia', 'VNM': 'Asia', 'PHL': 'Asia', 'IDN': 'Asia',
  'DEU': 'Europe', 'FRA': 'Europe', 'ITA': 'Europe', 'ESP': 'Europe', 'NLD': 'Europe',
  'USA': 'USA', 'CAN': 'USA'
};

// Currency to country mapping
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  'KES': 'KEN', 'GHS': 'GHA', 'ZAR': 'ZAF', 'EGP': 'EGY', 'NGN': 'NGA',
  'BRL': 'BRA', 'ARS': 'ARG', 'MXN': 'MEX', 'COP': 'COL', 'CLP': 'CHL',
  'INR': 'IND', 'THB': 'THA', 'VND': 'VNM', 'PHP': 'PHL', 'IDR': 'IDN',
  'EUR': 'DEU', 'GBP': 'GBR', 'USD': 'USA', 'CAD': 'CAN'
};

// Priority countries for API requests
export const PRIORITY_COUNTRIES = [
  'USA', 'DEU', 'JPN', 'GBR', 'FRA', 'ITA', 'CAN', 'KOR', 'AUS', 'ESP',
  'BRA', 'IND', 'CHN', 'ZAF', 'NGA', 'EGY', 'MEX', 'ARG', 'COL'
];

// Country code to country name mapping
export const COUNTRY_NAMES: Record<string, string> = {
  'USA': 'United States',
  'DEU': 'Germany',
  'JPN': 'Japan',
  'GBR': 'United Kingdom',
  'FRA': 'France',
  'ITA': 'Italy',
  'CAN': 'Canada',
  'KOR': 'South Korea',
  'AUS': 'Australia',
  'ESP': 'Spain',
  'BRA': 'Brazil',
  'IND': 'India',
  'CHN': 'China',
  'ZAF': 'South Africa',
  'NGA': 'Nigeria',
  'EGY': 'Egypt',
  'MEX': 'Mexico',
  'ARG': 'Argentina',
  'COL': 'Colombia'
};

// Function to get fallback data by region
export function getFallbackByRegion(): Record<string, RegionalInflationData> {
  const result: Record<string, RegionalInflationData> = {};

  for (const [region, data] of Object.entries(FALLBACK_INFLATION_DATA)) {
    // Convert the stored format to the expected format
    const countries: CountryInflationData[] = [];

    if (data.data) {
      // If we have detailed data, use it
      for (const entry of data.data) {
        // For each country in the region, create an entry
        if (data.countries) {
          for (const countryCode of data.countries) {
            countries.push({
              country: COUNTRY_NAMES[countryCode] || countryCode,
              region: region,
              currency: CURRENCY_TO_COUNTRY[countryCode] || 'Unknown',
              value: entry.rate,
              year: entry.year
            });
          }
        }
      }
    } else {
      // If no detailed data, use avgRate for all countries in the region
      if (data.countries) {
        for (const countryCode of data.countries) {
          countries.push({
            country: COUNTRY_NAMES[countryCode] || countryCode,
            region: region,
            currency: CURRENCY_TO_COUNTRY[countryCode] || 'Unknown',
            value: data.avgRate,
            year: new Date().getFullYear()
          });
        }
      }
    }

    result[region] = {
      region,
      avgRate: data.avgRate,
      countries,
      stablecoins: data.stablecoins
    };
  }

  return result;
}
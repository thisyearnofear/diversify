import type { NextApiRequest, NextApiResponse } from 'next';
import { marketPulseService, type StockTrigger } from '../../../utils/market-pulse-service';

export interface MarketPulseResponse {
  success: boolean;
  pulse?: {
    sentiment: number;
    btcPrice: number;
    btcChange24h: number;
    goldPrice: number;
    goldChange24h: number;
    warRisk: number;
    aiMomentum: number;
    defenseSpending: number;
    lastUpdated: number;
    source: string;
  };
  triggers?: StockTrigger[];
  error?: string;
  warnings?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketPulseResponse>
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      warnings: ['Only GET and POST methods are supported']
    });
  }

  try {
    const { includeTriggers } = req.query;
    
    const pulse = await marketPulseService.getMarketPulse();
    
    const warnings: string[] = [];
    
    // Add warnings based on data source
    if (pulse.source === 'fallback') {
      warnings.push('Using synthetic fallback data due to API unavailability');
    } else if (pulse.source === 'mixed') {
      warnings.push('Some data sources are unavailable, using mixed data sources');
    }

    const response: MarketPulseResponse = {
      success: true,
      pulse,
      ...(warnings.length > 0 && { warnings }),
    };

    if (includeTriggers === 'true') {
      response.triggers = marketPulseService.generateTriggers(pulse);
    }

    res.status(200).json(response);
  } catch (error: any) {
    console.error('[Market Pulse API] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch market pulse',
      warnings: ['Service temporarily unavailable, please try again later']
    });
  }
}

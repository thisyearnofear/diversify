import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { SynthDataService } from '../synth-data-service';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, true);

describe('SynthDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('normalization', () => {
    it('normalizes modern forecast payload into stable DTO', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          current_price: 100,
          forecast_future: {
            average_volatility: 0.07,
            percentiles: { p5: 90, p50: 100, p95: 110 }
          },
          forecast_past: {
            average_volatility: 0.03,
            percentiles: { p5: 96, p50: 100, p95: 104 }
          },
          realized: {
            average_volatility: 0.02
          }
        }
      });

      const result = await SynthDataService.getPredictions('BTC');

      expect(result).toBeTruthy();
      expect(result?.current_price).toBe(100);
      expect(result?.forecast_future?.average_volatility).toBe(0.07);
      expect(result?.forecast_past?.average_volatility).toBe(0.03);
      expect(result?.['24H']?.percentiles.p95).toBe(110);
      expect(result?.['1H']?.percentiles.p5).toBe(96);
    });

    it('normalizes legacy-style forecast sections (1H/24H)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        data: {
          current_price: 180,
          '1H': {
            average_volatility: 0.01,
            percentiles: { p5: 175, p50: 180, p95: 185 }
          },
          '24H': {
            average_volatility: 0.04,
            percentiles: { p5: 160, p50: 180, p95: 200 }
          }
        }
      });

      const result = await SynthDataService.getPredictions('NVDAX');

      expect(result).toBeTruthy();
      expect(result?.forecast_past?.average_volatility).toBe(0.01);
      expect(result?.forecast_future?.average_volatility).toBe(0.04);
      expect(result?.['1H']?.percentiles.p50).toBe(180);
      expect(result?.['24H']?.percentiles.p95).toBe(200);
    });
  });

  describe('deterministic fallback', () => {
    it('returns deterministic fallback for unknown asset', async () => {
      const first = (SynthDataService as any).getFallbackForecast('UNKNOWN_ASSET');
      const second = (SynthDataService as any).getFallbackForecast('UNKNOWN_ASSET');

      expect(first).toEqual(second);
      expect(first?.current_price).toBe(100);
      expect(first?.forecast_future?.percentiles?.p95).toBe(115);
    });

    it('returns deterministic fallback for option pricing and liquidation', async () => {
      const optionFirst = (SynthDataService as any).getFallbackOptionPricing('BTC');
      const optionSecond = (SynthDataService as any).getFallbackOptionPricing('BTC');
      const liqFirst = (SynthDataService as any).getFallbackLiquidation('BTC');
      const liqSecond = (SynthDataService as any).getFallbackLiquidation('BTC');

      expect(optionFirst).toEqual(optionSecond);
      expect(liqFirst).toEqual(liqSecond);
      expect(optionFirst?.implied_vol).toBe(0.5);
      expect(liqFirst?.risk_score).toBe(50);
    });
  });

  describe('coverage map', () => {
    it('reports supported and unsupported assets correctly', () => {
      expect(SynthDataService.isSynthAssetCovered('BTC')).toBe(true);
      expect(SynthDataService.isSynthAssetCovered('SPYX')).toBe(true);
      expect(SynthDataService.isSynthAssetCovered('DOGE')).toBe(false);
    });
  });
});

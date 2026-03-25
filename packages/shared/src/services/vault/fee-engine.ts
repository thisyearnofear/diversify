/**
 * Fee Engine — Calculates and tracks vault fees.
 *
 * Three-tier fee model:
 *   1. Management fee: 1% annual, pro-rated daily on AUM
 *   2. Performance fee: 10% of gains above high-water mark
 *   3. Swap spread: 0.10% built into swap quotes (protocol keeps the difference)
 *
 * Fees accumulate in Vault.feesPendingUSD and are settled at withdrawal
 * or via periodic (daily) deduction.
 */

export interface FeeConfig {
  managementFeeRate: number; // Annual rate, e.g., 0.01 = 1%
  performanceFeeRate: number; // e.g., 0.10 = 10% of gains
  swapSpreadBps: number; // e.g., 10 = 0.10%
  minRebalanceFeeUSD: number; // Minimum fee per rebalance
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
  managementFeeRate: 0.01,
  performanceFeeRate: 0.1,
  swapSpreadBps: 10,
  minRebalanceFeeUSD: 0.1,
};

export interface FeeSummary {
  managementFeeUSD: number;
  performanceFeeUSD: number;
  swapFeesUSD: number;
  totalFeeUSD: number;
  breakdown: {
    daysSinceLastCharge: number;
    aumUSD: number;
    gainAboveHighWaterMarkUSD: number;
  };
}

export class FeeEngine {
  private config: FeeConfig;

  constructor(config?: Partial<FeeConfig>) {
    this.config = { ...DEFAULT_FEE_CONFIG, ...config };
  }

  /**
   * Calculate management fee accrued since last charge.
   * Pro-rated daily: (AUM * annualRate) / 365 * daysSinceLastCharge
   */
  calculateManagementFee(
    aumUSD: number,
    lastChargeDate: Date | null | undefined,
    now: Date = new Date()
  ): number {
    if (aumUSD <= 0) return 0;

    const lastCharge = lastChargeDate || new Date(now.getTime() - 86400000); // Default: 1 day ago
    const daysSinceLastCharge = Math.max(
      1,
      Math.floor((now.getTime() - lastCharge.getTime()) / 86400000)
    );

    const dailyRate = this.config.managementFeeRate / 365;
    return aumUSD * dailyRate * daysSinceLastCharge;
  }

  /**
   * Calculate performance fee based on high-water mark.
   * Only charged on net gains above the highest previous value.
   *
   * gain = currentValue - max(highWaterMark, totalDeposited - totalWithdrawn)
   * fee = gain * performanceFeeRate (only if gain > 0)
   */
  calculatePerformanceFee(
    currentValueUSD: number,
    highWaterMarkUSD: number,
    totalDepositedUSD: number,
    totalWithdrawnUSD: number
  ): number {
    const netInvested = totalDepositedUSD - totalWithdrawnUSD;
    const effectiveHWM = Math.max(highWaterMarkUSD, netInvested);
    const gain = currentValueUSD - effectiveHWM;

    if (gain <= 0) return 0;
    return gain * this.config.performanceFeeRate;
  }

  /**
   * Calculate swap spread fee for a single swap.
   * The protocol charges this by routing through a spread-adjusted quote.
   * Returns the fee amount in USD.
   */
  calculateSwapFee(swapAmountUSD: number): number {
    const fee = swapAmountUSD * (this.config.swapSpreadBps / 10000);
    return Math.max(fee, this.config.minRebalanceFeeUSD);
  }

  /**
   * Calculate total fees for a vault snapshot.
   * Used for display in the UI and for settlement at withdrawal.
   */
  calculateTotalFees(params: {
    aumUSD: number;
    lastChargeDate: Date | null | undefined;
    highWaterMarkUSD: number;
    totalDepositedUSD: number;
    totalWithdrawnUSD: number;
    swapVolumeUSD: number;
    now?: Date;
  }): FeeSummary {
    const now = params.now || new Date();
    const daysSinceLastCharge = params.lastChargeDate
      ? Math.max(1, Math.floor((now.getTime() - params.lastChargeDate.getTime()) / 86400000))
      : 1;

    const managementFee = this.calculateManagementFee(params.aumUSD, params.lastChargeDate, now);
    const performanceFee = this.calculatePerformanceFee(
      params.aumUSD,
      params.highWaterMarkUSD,
      params.totalDepositedUSD,
      params.totalWithdrawnUSD
    );
    const swapFees = this.calculateSwapFee(params.swapVolumeUSD);

    const netInvested = params.totalDepositedUSD - params.totalWithdrawnUSD;
    const gainAboveHWM = params.aumUSD - Math.max(params.highWaterMarkUSD, netInvested);

    return {
      managementFeeUSD: managementFee,
      performanceFeeUSD: Math.max(0, performanceFee),
      swapFeesUSD: swapFees,
      totalFeeUSD: managementFee + Math.max(0, performanceFee) + swapFees,
      breakdown: {
        daysSinceLastCharge,
        aumUSD: params.aumUSD,
        gainAboveHighWaterMarkUSD: Math.max(0, gainAboveHWM),
      },
    };
  }

  /**
   * Get human-readable fee description for display.
   */
  describeFees(): string {
    return [
      `Management: ${(this.config.managementFeeRate * 100).toFixed(1)}%/year (pro-rated daily)`,
      `Performance: ${(this.config.performanceFeeRate * 100).toFixed(0)}% of gains above high-water mark`,
      `Swap spread: ${this.config.swapSpreadBps}bps (${(this.config.swapSpreadBps / 100).toFixed(2)}%)`,
    ].join(' · ');
  }
}

export const feeEngine = new FeeEngine();

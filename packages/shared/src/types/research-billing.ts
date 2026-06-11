export type ResearchPaymentStatus =
  | 'free'
  | 'quoted'
  | 'paid'
  | 'credit'
  | 'skipped'
  | 'failed';

export interface ResearchSourceLineItem {
  sourceId: string;
  label: string;
  tier: 'free' | 'paid';
  cost: number;
  dataType?: string;
  category?: string;
  freshnessMinutes?: number;
  reputation?: number;
}

export interface ResearchQuote {
  status: 'free' | 'quoted';
  amount: string;
  currency: 'USDC';
  chainId: number;
  recipient: string;
  nonce: string;
  expires: number;
  currentBalance: string;
  requiredCost: number;
  requestedSources: string[];
  bundleRequested: boolean;
  reason: string;
  sources: Array<ResearchSourceLineItem & { freeRemaining?: number }>;
}

export interface ResearchReceipt {
  status: ResearchPaymentStatus;
  amount: string;
  currency: 'USDC';
  sources: ResearchSourceLineItem[];
  txHash?: string;
  explorer?: string;
  nonce?: string;
  remainingCredit?: string;
  reason?: string;
  arcSettled?: boolean;
  settlementTxHashes?: string[];
  settlementExplorers?: string[];
  error?: string;
  /**
   * On-chain 0G RecommendationLedger anchor for this receipt.
   * Surfaces the verifiable state of the recommendation that
   * produced this receipt — pending | anchored | failed.
   */
  anchor?: {
    status: 'pending' | 'anchored' | 'failed';
    txHash?: string;
    explorerUrl?: string;
    id?: number;
    error?: string;
  };
}

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
  /** Suggested Protection Balance top-up from the challenge (>= requiredCost). */
  suggestedTopup?: string;
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
  /** Total funded into the Protection Balance by this payment (top-up >= amount). */
  fundedAmount?: string;
  remainingCredit?: string;
  reason?: string;
  onChainSettled?: boolean;
  settlementNetwork?: string;
  /** The buyer's real settlement tx (mandate, tx-proof, HSP, gateway_batched). */
  settlementTxHash?: string;
  /** Explorer link — present only when settlementTxHash is an on-chain tx hash. */
  settlementExplorer?: string;
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
    /**
     * True only when a real 0G Storage evidence CID was uploaded and
     * attached to this on-chain record. `anchored`/`pending` can still be
     * true on-chain (the tx itself is real) while this is false — that
     * combination means "real tx, no evidence attached," which the UI
     * must not present as fully verified.
     */
    evidenceUploaded?: boolean;
  };
}

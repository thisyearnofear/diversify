import type { AgentWalletProvider } from '../../types/wallet-provider';
import type { Payment, X402Challenge, DataSource } from '../agent-service';
import type { CircleService } from '../circle-service';
import { zeroGStorageService } from '@diversifi/shared-0g/src/services/storage-service';

type FailureState = Map<string, { count: number; lastFailure: number; openUntil?: number }>;

export class GuardianDataAccessService {
  constructor(private readonly deps: {
    ensureInitialized: () => Promise<void>;
    wallet: AgentWalletProvider;
    circleService: CircleService;
    agentAddress: string;
    spendingLimit: () => number;
    getSpentToday: () => number;
    setSpentToday: (next: number) => void;
    dataSourceFailures: FailureState;
    appBaseUrl: string;
    dataSourceFailureWindowMs: number;
    dataSourceCooldownMs: number;
    dataSourceMaxFailures: number;
  }) {}

  async fetchWithNanopayment(
    url: string,
    payment: Payment,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    console.log(`[Arc Agent] Initiating Nanopayment for ${url} (Amount: ${payment.amount} USDC)`);
    return this.fetchWithX402Payment(url, payment, headers);
  }

  async fetchInflationData(steps: string[], sources: string[], dataSources: DataSource[]) {
    const inflationSources = dataSources.filter((s) => s.dataType === 'inflation')
      .sort((a, b) => a.priority - b.priority);

    return this.fetchSourceGroup(inflationSources.slice(0, 1), steps, sources, 'Retrieved data from');
  }

  async fetchEconomicData(steps: string[], sources: string[], dataSources: DataSource[]) {
    const economicSources = dataSources.filter((s) => s.dataType === 'economic')
      .sort((a, b) => a.priority - b.priority);

    return this.fetchSourceGroup(economicSources.slice(0, 1), steps, sources, 'Purchased data from');
  }

  async fetchYieldData(steps: string[], sources: string[], dataSources: DataSource[]) {
    const yieldSources = dataSources.filter((s) => s.dataType === 'yield');
    return this.fetchSourceGroup(yieldSources.slice(0, 1), steps, sources, 'Retrieved yield data from', true);
  }


  private async fetchSourceGroup(
    sourcesToFetch: DataSource[],
    steps: string[],
    sources: string[],
    successPrefix: string,
    usePoolsSuffix = false,
  ) {
    const data: any = {};
    const hashes: Record<string, string> = {};
    const storageCids: Record<string, string> = {}; // New: Track CIDs for evidence commitment

    for (const source of sourcesToFetch) {
      if (this.isCircuitOpen(source.name)) {
        steps.push(`⚠ ${source.name} temporarily unavailable (circuit open)`);
        continue;
      }
      try {
        steps.push(source.x402Enabled ? `Purchasing data from ${source.name} via x402...` : `Accessing ${source.name}...`);
        const response = await this.fetchWithRetry(async () => {
          if (source.x402Enabled) {
            return await this.fetchWithX402Payment(source.url, source.cost, source.headers, 1);
          }
          const url = usePoolsSuffix ? `${source.url}/pools` : source.url;
          return await fetch(url, { headers: source.headers });
        });

        if (response && response.ok) {
          const rawData = await response.json();
          data[source.name] = rawData;
          sources.push(source.name);
          steps.push(`✓ ${successPrefix} ${source.name}${source.x402Enabled ? ` for ${source.cost.amount} USDC` : ''}`);
          
          // Commitment: Upload evidence to 0G
          try {
            const storage = await zeroGStorageService.uploadEvidence(rawData, {
              agent: this.deps.agentAddress,
              source: source.name,
              timestamp: Date.now()
            });
            storageCids[source.name] = storage.cid;
            steps.push(`✓ Evidence committed to 0G Storage (CID: ${storage.cid.substring(0, 8)}...)`);
          } catch (e) {
            steps.push(`⚠ Evidence commitment to 0G failed`);
          }

          if (response.headers.get('x-payment-proof')) {
            hashes[source.name] = response.headers.get('x-payment-proof')!;
          }
          this.recordSourceSuccess(source.name);
        } else {
          throw new Error(`HTTP ${response?.status || 'unknown'} from ${source.name}`);
        }
      } catch (error) {
        console.warn(`Failed to fetch from ${source.name}:`, error);
        steps.push(`⚠ ${source.name} unavailable`);
        this.recordSourceFailure(source.name);
      }
    }

    return { data, hashes, storageCids };
  }

  private async fetchWithX402Payment(
    url: string,
    payment: Payment,
    headers: Record<string, string> = {},
    retries = 3
  ): Promise<Response> {
    await this.deps.ensureInitialized();

    const currentSpent = this.deps.getSpentToday();
    if (currentSpent + parseFloat(payment.amount) > this.deps.spendingLimit()) {
      throw new Error('Daily spending limit exceeded');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[Arc Agent] x402 payment attempt ${attempt}/${retries} to ${url}`);

        const initialUrl = url.startsWith('/') ? `${this.deps.appBaseUrl}${url}` : url;
        const initialResponse = await fetch(initialUrl, {
          headers: { ...headers, 'Accept': 'application/json' }
        });

        if (initialResponse.status === 402) {
          const challenge: X402Challenge = await initialResponse.json();
          if (!challenge.recipient || !challenge.nonce) {
            throw new Error('Invalid x402 challenge');
          }

          const mandate = await this.deps.circleService.createNanopaymentMandate(
            this.deps.wallet,
            {
              recipient: challenge.recipient,
              amount: challenge.amount || payment.amount,
              nonce: challenge.nonce,
              validAfter: 0,
              validBefore: Math.floor(Date.now() / 1000) + 3600
            }
          );

          const retryResponse = await fetch(initialUrl, {
            headers: {
              ...headers,
              'Accept': 'application/json',
              'X-Payment-Mandate': JSON.stringify(mandate),
              'X-Payment-Sender': this.deps.agentAddress
            }
          });

          if (retryResponse.ok) {
            this.deps.setSpentToday(currentSpent + parseFloat(payment.amount));
            const finalHeaders = new Headers(retryResponse.headers);
            finalHeaders.set('x-payment-proof', `nanopay_${mandate.signature.slice(2, 10)}`);

            return new Response(retryResponse.body, {
              status: retryResponse.status,
              statusText: retryResponse.statusText,
              headers: finalHeaders
            });
          } else if (retryResponse.status === 401) {
            const paymentTx = await this.executeUSDCPayment(challenge.recipient, challenge.amount || payment.amount);
            const legacyRetryResponse = await fetch(initialUrl, {
              headers: {
                ...headers,
                'Accept': 'application/json',
                'X-Payment-Proof': paymentTx.hash,
                'X-Payment-Sender': this.deps.agentAddress,
                'X-Payment-Nonce': challenge.nonce
              }
            });

            if (legacyRetryResponse.ok) {
              this.deps.setSpentToday(currentSpent + parseFloat(payment.amount));
              return legacyRetryResponse;
            }
          }

          throw new Error(`Payment failed: ${retryResponse.status}`);
        }

        return initialResponse;
      } catch (error: any) {
        lastError = error;
        console.error(`[Arc Agent] x402 attempt ${attempt} failed:`, error.message);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError || new Error('x402 payment failed');
  }

  private async executeUSDCPayment(recipient: string, amount: string): Promise<any> {
    console.log(`[Arc Agent] Initiating USDC transfer: ${amount} to ${recipient}`);
    return await this.deps.wallet.transfer(recipient, amount, '0x3600000000000000000000000000000000000000');
  }

  private isCircuitOpen(sourceName: string): boolean {
    const state = this.deps.dataSourceFailures.get(sourceName);
    if (!state) return false;
    return !!(state.openUntil && Date.now() < state.openUntil);
  }

  private recordSourceFailure(sourceName: string) {
    const now = Date.now();
    const existing = this.deps.dataSourceFailures.get(sourceName);

    if (!existing || now - existing.lastFailure > this.deps.dataSourceFailureWindowMs) {
      this.deps.dataSourceFailures.set(sourceName, { count: 1, lastFailure: now });
      return;
    }

    const nextCount = existing.count + 1;
    const updated = {
      count: nextCount,
      lastFailure: now,
      openUntil: existing.openUntil
    };

    if (nextCount >= this.deps.dataSourceMaxFailures) {
      updated.openUntil = now + this.deps.dataSourceCooldownMs;
    }

    this.deps.dataSourceFailures.set(sourceName, updated);
  }

  private recordSourceSuccess(sourceName: string) {
    this.deps.dataSourceFailures.delete(sourceName);
  }

  private async fetchWithRetry<T>(
    action: () => Promise<T>,
    options: { retries?: number; baseDelayMs?: number } = {}
  ): Promise<T> {
    const retries = options.retries ?? 2;
    const baseDelayMs = options.baseDelayMs ?? 750;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await action();
      } catch (error) {
        lastError = error;
        if (attempt >= retries) break;
        const backoff = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 150);
        await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
      }
    }

    throw lastError;
  }
}

import * as crypto from 'crypto';

export type JunoEnvironment = 'stage' | 'production';
export type JunoAsset = 'MXNB' | 'USDC' | 'USDT';
export type JunoTransactionType = 'CONVERSION' | 'REDEMPTION' | 'ISSUANCE' | 'WITHDRAWAL' | string;
export type JunoTransactionStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | string;

export interface JunoServiceConfig {
  apiKey?: string;
  apiSecret?: string;
  environment?: JunoEnvironment;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface JunoBalance {
  asset: string;
  total: number | string;
  on_hold: number | string;
  available: number | string;
  locked: number | string;
}

export interface JunoClabe {
  clabe: string;
  type: string;
  status: string;
  deposit_minimum_amount?: string | number | null;
  deposit_maximum_amounts?: Record<string, string | number | null>;
  created_at?: string;
  updated_at?: string | null;
}

export interface JunoBankAccount {
  id: string;
  tag: string;
  recipient_legal_name: string;
  clabe: string;
  ownership: string;
}

export interface JunoMockDepositRequest {
  amount: string;
  receiver_clabe: string;
  receiver_name: string;
  sender_clabe: string;
  sender_name: string;
}

export interface JunoMockDeposit {
  amount: string;
  tracking_code: string;
  tracking_key: string;
  sender_clabe: string;
  sender_name: string;
  sender_curp?: string;
  receiver_clabe: string;
  receiver_name: string;
  receiver_curp?: string;
  created_at: string;
}

export interface JunoConversionAsset {
  source_asset: JunoAsset | string;
  decimal_precision: number;
  convertible_assets: Array<{
    target_asset: JunoAsset | string;
    decimal_precision: number;
    source_min_amount: string;
    source_max_amount: string;
    target_min_amount: string;
    target_max_amount: string;
  }>;
}

export interface JunoConversionQuoteRequest {
  source_asset: JunoAsset;
  target_asset: JunoAsset;
  source_amount?: string;
  target_amount?: string;
}

export interface JunoConversionQuote {
  quote_id: string;
  source_asset: string;
  target_asset: string;
  source_amount: string;
  target_amount: string;
  exchange_rate: string;
  expires_at: string;
  created_at: string;
}

export interface JunoConversionTransaction {
  id: string;
  created_at: string;
  updated_at: string;
  status: JunoTransactionStatus;
  external_ref?: string;
  type: 'CONVERSION';
  conversion: {
    quote_id: string;
  };
}

export interface JunoRedemptionRequest {
  amount: number;
  destination_bank_account_id: string;
  asset?: 'MXN';
  idempotencyKey?: string;
}

export interface JunoRedemption {
  id: string;
  amount: number | string;
  currency: string;
  transaction_type: 'REDEMPTION';
  method: 'SPEI' | string;
  summary_status: JunoTransactionStatus;
  network: 'ARBITRUM' | string;
  created_at: string;
  updated_at: string;
}

interface JunoApiErrorBody {
  success?: false;
  error?: {
    message?: string;
    code?: string;
  };
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

const JUNO_BASE_URLS: Record<JunoEnvironment, string> = {
  stage: 'https://stage.buildwithjuno.com',
  production: 'https://buildwithjuno.com',
};

export class JunoService {
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: JunoServiceConfig = {}) {
    const environment = config.environment || (process.env.JUNO_ENV === 'production' ? 'production' : 'stage');
    this.apiKey = config.apiKey || process.env.JUNO_API_KEY;
    this.apiSecret = config.apiSecret || process.env.JUNO_API_SECRET;
    this.baseUrl = (config.baseUrl || process.env.JUNO_BASE_URL || JUNO_BASE_URLS[environment]).replace(/\/$/, '');
    this.fetchImpl = config.fetchImpl || fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  getEnvironmentBaseUrl(): string {
    return this.baseUrl;
  }

  async getBalances(): Promise<JunoBalance[]> {
    const payload = await this.request<{ balances: JunoBalance[] }>('GET', '/mint_platform/v1/balances');
    return payload.balances || [];
  }

  async listAutoPaymentClabes(): Promise<JunoClabe[]> {
    const payload = await this.request<{ response?: JunoClabe[] } | JunoClabe[]>(
      'GET',
      '/spei/v1/clabes?clabe_type=AUTO_PAYMENT'
    );
    return Array.isArray(payload) ? payload : payload.response || [];
  }

  async listBankAccounts(): Promise<JunoBankAccount[]> {
    return this.request<JunoBankAccount[]>('GET', '/mint_platform/v1/accounts/banks');
  }

  async createMockMxnbDeposit(input: JunoMockDepositRequest): Promise<JunoMockDeposit> {
    return this.request<JunoMockDeposit>('POST', '/spei/test/deposits', input);
  }

  async redeemMxnb(input: JunoRedemptionRequest): Promise<JunoRedemption> {
    const headers = input.idempotencyKey ? { 'X-Idempotency-Key': input.idempotencyKey } : undefined;
    return this.request<JunoRedemption>(
      'POST',
      '/mint_platform/v1/redemptions',
      {
        amount: input.amount,
        destination_bank_account_id: input.destination_bank_account_id,
        asset: input.asset || 'MXN',
      },
      headers
    );
  }

  async getConversionAssets(): Promise<JunoConversionAsset[]> {
    const payload = await this.request<{ assets: JunoConversionAsset[] }>(
      'GET',
      '/mint_platform/v1/retrieve_conversion_assets'
    );
    return payload.assets || [];
  }

  async requestConversionQuote(input: JunoConversionQuoteRequest): Promise<JunoConversionQuote> {
    if ((input.source_amount && input.target_amount) || (!input.source_amount && !input.target_amount)) {
      throw new Error('Provide exactly one of source_amount or target_amount');
    }

    return this.request<JunoConversionQuote>('POST', '/mint_platform/v1/quotes', input);
  }

  async executeConversionQuote(quoteId: string, externalRef?: string): Promise<JunoConversionTransaction> {
    return this.request<JunoConversionTransaction>('POST', '/mint_platform/v2/transactions', {
      type: 'CONVERSION',
      external_ref: externalRef,
      conversion: {
        quote_id: quoteId,
      },
    });
  }

  createSignedHeaders(method: string, pathWithQuery: string, body = '', extraHeaders?: Record<string, string>) {
    this.assertConfigured();

    const nonce = Date.now().toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret as string)
      .update(`${nonce}${method.toUpperCase()}${pathWithQuery}${body}`)
      .digest('hex');

    return {
      Authorization: `Bitso ${this.apiKey}:${nonce}:${signature}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  private async request<T>(
    method: string,
    pathWithQuery: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    this.assertConfigured();

    const normalizedPath = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
    const bodyText = body === undefined ? '' : JSON.stringify(body);
    const response = await this.fetchImpl(`${this.baseUrl}${normalizedPath}`, {
      method,
      headers: this.createSignedHeaders(method, normalizedPath, bodyText, extraHeaders),
      body: bodyText || undefined,
    });

    const raw = await response.text();
    const json = raw ? JSON.parse(raw) : {};

    if (!response.ok || json.success === false || Array.isArray(json.errors)) {
      throw new Error(this.formatApiError(response.status, json));
    }

    return (json && Object.prototype.hasOwnProperty.call(json, 'payload') ? json.payload : json) as T;
  }

  private assertConfigured(): void {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Juno API credentials are not configured. Set JUNO_API_KEY and JUNO_API_SECRET.');
    }
  }

  private formatApiError(status: number, body: JunoApiErrorBody): string {
    if (body.error?.message) {
      const code = body.error.code ? ` (${body.error.code})` : '';
      return `Juno API error ${status}${code}: ${body.error.message}`;
    }

    if (body.errors?.length) {
      return `Juno API error ${status}: ${body.errors
        .map((error) => `${error.code || 'unknown'} ${error.message || ''}`.trim())
        .join('; ')}`;
    }

    return `Juno API error ${status}`;
  }
}

export const junoService = new JunoService();

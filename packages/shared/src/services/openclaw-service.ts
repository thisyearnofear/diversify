/**
 * OpenClaw Service
 * 
 * Integrates DiversiFi with external OpenClaw instance for autonomous agent execution.
 * Provides chat interface, on-chain execution, and receipt management.
 * 
 * SECURITY: All credentials loaded from environment variables, never hardcoded.
 */

// ============================================================================
// TYPES
// ============================================================================


export interface OpenClawExecuteRequest {
  run_id: string;
  track: string;
  rpc_url: string;
  raw_tx: string;
  explorer_base: string;
  metadata?: Record<string, any>;
}

export interface OpenClawExecuteResponse {
  success: boolean;
  run_id: string;
  track: string;
  tx_hash?: string;
  explorer_url?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

export interface OpenClawReceipt {
  event_id: string;
  run_id: string;
  timestamp: string;
  agent_id: string;
  action_type: string;
  tool: string;
  status: 'success' | 'error' | 'retry' | 'skipped';
  duration_ms: number;
  onchain?: {
    chain: string;
    chain_id: number;
    tx_hash: string;
    explorer_url: string;
    tx_status: string;
  };
}

// Ingested via /api/agent/openclaw/webhook (future enhancement)
export interface OpenClawWebhookPayload {
  type: 'receipt' | 'run_summary' | 'status_change';
  payload: OpenClawReceipt | OpenClawRunSummary | { status: string };
  signature?: string;
}

export interface OpenClawRunSummary {
  schema_version: string;
  run_id: string;
  agent_id: string;
  started_at: string;
  ended_at: string;
  objective: {
    goal: string;
    success_criteria: string[];
  };
  result: {
    status: 'success' | 'partial' | 'failed';
    summary: string;
  };
  metrics: {
    actions_total: number;
    actions_success: number;
    actions_error: number;
    duration_ms: number;
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

interface OpenClawConfig {
  gatewayUrl: string;
  gatewayToken: string;
  wrapperUrl: string;
  wrapperUser: string;
  wrapperPass: string;
  enabled: boolean;
}

function getConfig(): OpenClawConfig {
  // Support both canonical env vars and legacy/execute-loop env var names.
  // The Railway OpenClaw instance uses SETUP_PASSWORD for Basic auth on wrapper endpoints.
  // OPENCLAW_BOT_URL is the legacy name used by execute-loop.ts and mento-swap.ts.
  const wrapperUrl =
    process.env.OPENCLAW_WRAPPER_URL ||
    process.env.OPENCLAW_BOT_URL ||
    '';
  const wrapperPass =
    process.env.OPENCLAW_WRAPPER_PASS ||
    process.env.OPENCLAW_SETUP_PASSWORD ||
    process.env.SETUP_PASSWORD ||
    '';

  return {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || '',
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || '',
    wrapperUrl,
    wrapperUser: process.env.OPENCLAW_WRAPPER_USER || 'user',
    wrapperPass,
    enabled: process.env.OPENCLAW_ENABLED === 'true',
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export class OpenClawService {
  private config: OpenClawConfig;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_RESET_MS = 10 * 60 * 1000; // 10 minutes

  private inMemoryReceipts: Map<string, OpenClawReceipt[]> = new Map();
  private inMemorySummaries: Map<string, OpenClawRunSummary> = new Map();

  constructor() {
    this.config = getConfig();
  }

  // ---------------------------------------------------------------------------
  // Circuit Breaker
  // ---------------------------------------------------------------------------

  private isCircuitOpen(): boolean {
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.CIRCUIT_BREAKER_RESET_MS) {
        return true;
      }
      // Reset circuit breaker after timeout
      this.failureCount = 0;
    }
    return false;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  private recordSuccess(): void {
    this.failureCount = 0;
  }

  // ---------------------------------------------------------------------------
  // HTTP Helpers
  // ---------------------------------------------------------------------------

  private getGatewayHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.gatewayToken}`,
      'Content-Type': 'application/json',
    };
  }

  private getWrapperAuth(): string {
    return `Basic ${Buffer.from(`${this.config.wrapperUser}:${this.config.wrapperPass}`).toString('base64')}`;
  }

  private getWrapperHeaders(): Record<string, string> {
    return {
      'Authorization': this.getWrapperAuth(),
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30s timeout
        });

        if (response.ok) {
          this.recordSuccess();
          return response;
        }

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
        }

        // Retry on 5xx errors
        lastError = new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on abort/timeout after last attempt
        if (attempt === maxRetries - 1) break;
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.recordFailure();
    throw lastError || new Error('OpenClaw API request failed');
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Check if OpenClaw integration is enabled and configured.
   * Accepts either gateway credentials (Bearer token) or wrapper credentials (Basic auth).
   */
  isEnabled(): boolean {
    if (!this.config.enabled) return false;
    const hasGateway = !!this.config.gatewayUrl && !!this.config.gatewayToken;
    const hasWrapper = !!this.config.wrapperUrl && !!this.config.wrapperPass;
    return hasGateway || hasWrapper;
  }

  /**
   * Check if circuit breaker is open (service unavailable)
   */
  isUnavailable(): boolean {
    return this.isCircuitOpen();
  }


  /**
   * Execute a command via OpenClaw wrapper console API
   */
  async executeCommand(command: string): Promise<{ output: string; exitCode: number }> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/console/run`,
      {
        method: 'POST',
        headers: {
          'Authorization': this.getWrapperAuth(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cmd: command }),
      }
    );

    return response.json();
  }

  /**
   * Execute on-chain transaction via OpenClaw synthesis API
   */
  async executeOnchain(request: OpenClawExecuteRequest): Promise<OpenClawExecuteResponse> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/synthesis/onchain/execute`,
      {
        method: 'POST',
        headers: this.getWrapperHeaders(),
        body: JSON.stringify(request),
      }
    );

    return response.json();
  }

  /**
   * Get receipts for a specific run
   */
  async getReceipts(runId: string): Promise<OpenClawReceipt[]> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    // Source of truth: check in-memory cache populated by Webhooks first
    const cached = this.inMemoryReceipts.get(runId);
    if (cached) return cached;

    // TODO (Enhancement First / Clean Architecture)
    // Active polling via shell commands is blocked by the Railway wrapper policy ("Command not allowed").
    // Logs from the webhook ingress should be flushed to local PersistentMissionService/Storage.
    console.warn(`[OpenClaw] No cached receipts for ${runId}. Active polling is disabled.`);
    
    return [];
  }

  /**
   * Get latest receipts across ALL runs for general telemetry
   */
  async getLatestReceipts(): Promise<OpenClawReceipt[]> {
    const all: OpenClawReceipt[] = [];
    this.inMemoryReceipts.forEach(receipts => all.push(...receipts));
    
    // Return last 100 sorted by timestamp
    return all.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ).slice(0, 100);
  }

  /**
   * Get run summary
   */
  async getRunSummary(runId: string): Promise<OpenClawRunSummary | null> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    // Source of truth: check in-memory cache populated by Webhooks first
    const cached = this.inMemorySummaries.get(runId);
    if (cached) return cached;

    // TODO (Performant / Clean)
    // Active polling via shell commands is blocked by the Railway wrapper policy ("Command not allowed").
    console.warn(`[OpenClaw] No cached summary for ${runId}. Active polling is disabled.`);

    return null;
  }

  /**
   * Ingress data from external OpenClaw webhook
   */
  async ingressWebhook(payload: OpenClawWebhookPayload): Promise<{ success: boolean }> {
    if (!this.isEnabled()) return { success: false };

    try {
      if (payload.type === 'receipt') {
        const receipt = payload.payload as OpenClawReceipt;
        const current = this.inMemoryReceipts.get(receipt.run_id) || [];
        
        // Prevent duplicates
        if (!current.some(r => r.event_id === receipt.event_id)) {
          this.inMemoryReceipts.set(receipt.run_id, [...current, receipt].sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          ).slice(0, 50)); // Keep last 50
        }
      } else if (payload.type === 'run_summary') {
        const summary = payload.payload as OpenClawRunSummary;
        this.inMemorySummaries.set(summary.run_id, summary);
      } else if (payload.type === 'status_change') {
        const { status } = payload.payload as { status: string };
        console.log(`[OpenClaw] Agent status update: ${status}`);
      }

      return { success: true };
    } catch (error) {
      console.error('[OpenClaw] Webhook ingestion failed:', error);
      return { success: false };
    }
  }

  /**
   * Get agent identity
   */
  async getIdentity(): Promise<Record<string, any> | null> {
    if (!this.isEnabled()) {
      throw new Error('OpenClaw integration is not enabled');
    }

    if (this.isCircuitOpen()) {
      throw new Error('OpenClaw service is temporarily unavailable (circuit breaker open)');
    }

    const response = await this.fetchWithRetry(
      `${this.config.wrapperUrl}/setup/api/receipts/identity`,
      {
        method: 'GET',
        headers: {
          'Authorization': this.getWrapperAuth(),
        },
      }
    );

    return response.json();
  }

  /**
   * Store a receipt locally (called after successful OpenClaw execution).
   * This ensures the receipt pipeline has data even without webhook push.
   */
  storeReceipt(receipt: OpenClawReceipt): void {
    const current = this.inMemoryReceipts.get(receipt.run_id) || [];
    if (!current.some(r => r.event_id === receipt.event_id)) {
      this.inMemoryReceipts.set(receipt.run_id, [...current, receipt].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 50));
    }
  }

  /**
   * Log an action receipt to the OpenClaw wrapper's action log.
   * POSTs to /setup/api/receipts/action which appends to the JSONL action log.
   */
  async logActionReceipt(data: {
    run_id: string;
    track: string;
    action: string;
    tx_hash: string;
    explorer_url: string;
    metadata?: Record<string, any>;
  }): Promise<{ ok: boolean; error?: string }> {
    if (!this.config.wrapperUrl || !this.config.wrapperPass) {
      return { ok: false, error: 'Wrapper not configured' };
    }

    try {
      const response = await fetch(`${this.config.wrapperUrl}/setup/api/receipts/action`, {
        method: 'POST',
        headers: this.getWrapperHeaders(),
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}` };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  /**
   * Trigger autonomous heartbeat run
   */
  async triggerHeartbeat(): Promise<{ output: string; exitCode: number }> {
    return this.executeCommand(
      'HEARTBEAT_PULSE=1 bash /data/agent_state/scripts/autonomous-ops.sh heartbeat'
    );
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const openClawService = new OpenClawService();
